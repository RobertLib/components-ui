/**
 * A kind of formatting of `RichTextEditor` - what `sanitizeRichText` keeps.
 * Paragraphs and line breaks are always kept.
 */
export type RichTextFormat =
  | "blockquote"
  | "bold"
  | "bulletList"
  | "code"
  | "heading2"
  | "heading3"
  | "horizontalRule"
  | "italic"
  | "link"
  | "numberedList"
  | "strikethrough"
  | "table"
  | "underline";

/** Options of `sanitizeRichText`. */
export interface SanitizeRichTextOptions {
  /**
   * The formatting kept - all of it by default. The rest is reduced the way
   * `RichTextEditor` reduces what its toolbar cannot make: headings, list
   * items and quotes become paragraphs, table rows lines of text (the cells
   * separated by tabs), rules line breaks, and the other formats their text.
   */
  formats?: readonly RichTextFormat[];
}

const ALL_FORMATS: readonly RichTextFormat[] = [
  "blockquote",
  "bold",
  "bulletList",
  "code",
  "heading2",
  "heading3",
  "horizontalRule",
  "italic",
  "link",
  "numberedList",
  "strikethrough",
  "table",
  "underline",
];

interface InlineRules {
  /** Elements kept (upper case) - anything else is unwrapped to its text. */
  tags: ReadonlySet<string>;
  /** Attributes kept on those elements, besides the `href` of safe links. */
  attributes: ReadonlySet<string>;
  /** Classes kept - without it, `class` is kept as it is. */
  isSafeClass?: (className: string) => boolean;
}

// Colors, sizes and other keywords of a utility - `danger-500/50`, `sm`
const KEYWORD = String.raw`[a-z]{2,}(?:-[a-z]+)*(?:-\d{2,3})?(?:/\d{1,3})?`;
// A side of a border - `border-t-2`
const SIDE = "(?:-[xytrblse])?";

// Tailwind utilities that style text in place: color, weight, size and
// decoration, a background, a thin border, a little padding. Whatever could
// move or enlarge an element beyond its line (`fixed inset-0 z-50` over the
// page, a link as an invisible overlay, padding or borders of many rem) is
// left out, as are arbitrary values - a background image would load from
// anywhere.
const SAFE_UTILITY = new RegExp(
  `^(?:${[
    "italic",
    "not-italic",
    "underline",
    "overline",
    "line-through",
    "no-underline",
    "uppercase",
    "lowercase",
    "capitalize",
    "normal-case",
    "truncate",
    `text-(?:${KEYWORD}|[2-9]xl)`,
    `font-${KEYWORD}`,
    `decoration-(?:${KEYWORD}|[0-2])`,
    "underline-offset-(?:auto|[0-2])",
    `tracking-${KEYWORD}`,
    `leading-(?:${KEYWORD}|[3-9]|10)`,
    "whitespace-(?:normal|nowrap|pre|pre-line|pre-wrap|break-spaces)",
    "break-(?:normal|words|all|keep)",
    `bg-${KEYWORD}`,
    String.raw`rounded(?:-[a-z\d]+)*`,
    `border${SIDE}(?:-[0-2])?`,
    `border${SIDE}-${KEYWORD}`,
    String.raw`px-(?:0|px|0\.5|1|1\.5|2|2\.5|3)`,
    String.raw`py-(?:0|px|0\.5|1)`,
  ].join("|")})$`,
);

// Variants that restyle the element itself by its own state or the theme.
// Those reaching other elements or pseudo-elements - children, descendants
// by an arbitrary selector, `has-…`, `before` / `after` - are left out.
const SAFE_VARIANTS = new Set([
  "active",
  "dark",
  "focus",
  "focus-visible",
  "hover",
]);

/**
 * A class of the allowed utilities - also behind the simple variants
 * (`dark:`, `hover:`) and with an `!` - but not a negative or arbitrary
 * value, nor behind a variant that styles other elements.
 */
function isSafeInlineClass(className: string) {
  const variants = className.split(":");
  const utility = variants.pop() ?? "";

  return (
    variants.every((variant) => SAFE_VARIANTS.has(variant)) &&
    SAFE_UTILITY.test(utility.replace(/^!|!$/g, ""))
  );
}

// Inline formatting of a single line, e.g. a calendar event title - with
// classes of text styling, so it can be styled (links get none)
const INLINE_HTML: InlineRules = {
  attributes: new Set(["class"]),
  isSafeClass: isSafeInlineClass,
  tags: new Set([
    "A",
    "B",
    "BR",
    "EM",
    "I",
    "MARK",
    "S",
    "SMALL",
    "SPAN",
    "STRONG",
    "SUB",
    "SUP",
    "U",
  ]),
};

// Removed together with their content, which is never meant as text
const DROPPED_TAGS = new Set([
  "EMBED",
  "HEAD",
  "IFRAME",
  "LINK",
  "MATH",
  "META",
  "NOEMBED",
  "NOFRAMES",
  "NOSCRIPT",
  "OBJECT",
  "PLAINTEXT",
  "SCRIPT",
  "STYLE",
  "SVG",
  "TEMPLATE",
  "TITLE",
  "XMP",
]);

// Blocks of other editors and pages without a counterpart in the editor -
// their content becomes paragraphs
const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "CENTER",
  "DD",
  "DETAILS",
  "DIALOG",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "HEADER",
  "HGROUP",
  "LEGEND",
  "LISTING",
  "MAIN",
  "NAV",
  "PRE",
  "SEARCH",
  "SECTION",
  "SUMMARY",
]);

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

// `menu` and `dir` hold list items like `ul`
const LIST_TAGS = new Set(["DIR", "MENU", "OL", "UL"]);

// Elements of the source that hold blocks rather than text
const SOURCE_BLOCKS = new Set([
  ...BLOCK_TAGS,
  ...HEADING_TAGS,
  ...LIST_TAGS,
  "BLOCKQUOTE",
  "DIV",
  "HR",
  "LI",
  "P",
  "TABLE",
]);

// The blocks of the output - what paragraphs and lines are made around
const OUTPUT_BLOCKS = new Set([
  "BLOCKQUOTE",
  "DIV",
  "H2",
  "H3",
  "HR",
  "OL",
  "P",
  "TABLE",
  "UL",
]);

// Elements of the output holding a line of text - their runs of inline
// content take a mark that spans blocks
const LINE_ELEMENTS = new Set(["DIV", "H2", "H3", "LI", "P", "TD", "TH"]);

// Lines of the output bold by themselves - a bold mark around them has
// nothing to add there
const BOLD_LINES = new Set(["H2", "H3", "TH"]);

type Mark = "bold" | "code" | "italic" | "link" | "strike" | "underline";

const MARK_FORMATS: Record<Mark, RichTextFormat> = {
  bold: "bold",
  code: "code",
  italic: "italic",
  link: "link",
  strike: "strikethrough",
  underline: "underline",
};

// The elements of a mark, and the element each becomes - `<strike>` of
// `execCommand("strikeThrough")` and `<del>` become `<s>`, `<kbd>` and the
// like `<code>`
const MARK_TAGS: Record<string, { mark: Mark; tag: string }> = {
  A: { mark: "link", tag: "a" },
  B: { mark: "bold", tag: "b" },
  CODE: { mark: "code", tag: "code" },
  DEL: { mark: "strike", tag: "s" },
  EM: { mark: "italic", tag: "em" },
  I: { mark: "italic", tag: "i" },
  KBD: { mark: "code", tag: "code" },
  S: { mark: "strike", tag: "s" },
  SAMP: { mark: "code", tag: "code" },
  STRIKE: { mark: "strike", tag: "s" },
  STRONG: { mark: "bold", tag: "strong" },
  TT: { mark: "code", tag: "code" },
  U: { mark: "underline", tag: "u" },
};

// The order of the marks a style adds - the first one innermost
const STYLE_MARKS = [
  ["bold", "b"],
  ["italic", "i"],
  ["underline", "u"],
  ["strike", "s"],
  ["code", "code"],
] as const;

// Font families of code - Google Docs and Word have no code format
const MONOSPACE = /\bmono(?:space)?\b|courier|consol|menlo|monaco/i;

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

// The node types and tree walker flags by their values - a server with a
// `DOMParser` of its own (jsdom) has no globals `Node` and `NodeFilter`
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const SHOW_ELEMENT = 0x1;
const SHOW_TEXT = 0x4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;

// A table beyond these limits is too big to edit - one row of cells with
// `colspan="50"` and many rows under it would make millions of cells. Its
// spans are left out, and where it is still too big, its rows become lines
// of text. The table tools of RichTextEditor stop at them.
export const MAX_TABLE_COLUMNS = 50;
export const MAX_TABLE_CELLS = 10_000;

// Elements nested deeper than this give their text only - no document
// nests so deep (Chrome's parser stops at 512), and the copy recurses
const MAX_DEPTH = 100;

// Whitespace of HTML - not the no-break space of an intentionally empty line
const BLANK = /^[ \t\n\f\r]*$/;

// Elements of the source that hold blocks rather than text, as a selector
const SOURCE_BLOCK_SELECTOR = [...SOURCE_BLOCKS]
  .map((tag) => tag.toLowerCase())
  .join();

/**
 * Whether a link is safe to follow - an absolute one of `http:`, `https:`,
 * `mailto:` or `tel:`, or a relative one. `javascript:` and `data:` links
 * are not, also behind tricks like `java\tscript:`. Runs anywhere.
 */
export function isSafeHref(href: string) {
  try {
    // The URL parser sees through tricks like `java\tscript:`
    return SAFE_PROTOCOLS.has(
      new URL(href, "https://relative.invalid/").protocol,
    );
  } catch {
    return false;
  }
}

/** The formatting around the content being copied. */
type Formatting = Record<Mark, boolean> & {
  /** Inside `<pre>` - line breaks are part of the text. */
  pre: boolean;
};

const NO_FORMATTING: Formatting = {
  bold: false,
  code: false,
  italic: false,
  link: false,
  pre: false,
  strike: false,
  underline: false,
};

/**
 * Where content is copied to:
 * - `flow` - the top level, which holds any block,
 * - `quote` - a kept quote, which holds paragraphs,
 * - `item` - a list item: text and the lists nested in it,
 * - `line` - a paragraph, heading or table cell: text, whose blocks become
 *   its lines.
 */
type Context = "flow" | "item" | "line" | "quote";

interface CopyState {
  /** How many elements deep in the source the copy is. */
  depth: number;
  formats: ReadonlySet<RichTextFormat>;
  /** The elements of the source that hold blocks, at any depth. */
  holdsBlocks: ReadonlySet<Element>;
  output: Document;
  /**
   * Inline styles are read as marks - those of other editors are. Those in
   * RichTextEditor's own content are the browser's: a heading merged into a
   * paragraph keeps its size and weight in a `<span style>`, no bold mark.
   */
  readsStyles: boolean;
}

/**
 * The elements that hold blocks at any depth - found in one walk up from
 * each block, which stops where an earlier walk went, instead of a search
 * in every element that would repeat for each element around it.
 */
function findBlockHolders(root: Element) {
  const holders = new Set<Element>();

  for (const block of Array.from(
    root.querySelectorAll(SOURCE_BLOCK_SELECTOR),
  )) {
    let parent = block.parentElement;
    while (parent && !holders.has(parent)) {
      holders.add(parent);
      parent = parent.parentElement;
    }
  }
  return holders;
}

// A paragraph of a list of Word: `mso-list: l1 level2 lfo1` in its style -
// the list, and the level in it
const WORD_LIST_ITEM = /mso-list:\s*(l\d+)\s+level(\d+)/i;
// The element of the bullet or number of such a paragraph - text that Word
// has other programs skip
const WORD_LIST_MARKER = /mso-list:\s*ignore/i;

interface WordList {
  id: string;
  level: number;
  list: Element;
}

/** Whether the bullet or number of a Word list numbers it - `1.`, `a)`, `iv.` */
const isNumbering = (marker: string) =>
  /\d/.test(marker) || /^\(?[a-z]{1,4}[.)]$/i.test(marker);

/**
 * Word's lists as lists. Word writes the items as paragraphs, with their
 * list and level in the style and the bullet or number as text of their
 * own - consecutive items become a list (numbered by their numbers), a
 * deeper level a list in the item before, and the bullets and numbers go.
 */
function convertWordLists(root: Element) {
  const doc = root.ownerDocument;
  // The lists the next item can go on - the outermost first
  let open: WordList[] = [];

  for (const paragraph of Array.from(
    root.querySelectorAll('p[style*="mso-list"], div[style*="mso-list"]'),
  )) {
    const match = WORD_LIST_ITEM.exec(paragraph.getAttribute("style") ?? "");
    if (!match) continue;

    const id = match[1];
    const level = Number(match[2]);
    let numbered = false;
    for (const marker of Array.from(paragraph.querySelectorAll("[style]"))) {
      if (!WORD_LIST_MARKER.test(marker.getAttribute("style") ?? "")) continue;
      numbered ||= isNumbering((marker.textContent ?? "").replace(/\s/g, ""));
      marker.remove();
    }
    const tag = numbered ? "OL" : "UL";

    // A list goes on after its item right before - at the item's level,
    // or out of the levels deeper than it
    const first = open.at(0);
    if (paragraph.previousElementSibling !== first?.list || first.id !== id) {
      open = [];
    }
    while ((open.at(-1)?.level ?? 0) > level) open.pop();
    const last = open.at(-1);
    if (last?.level === level && last.list.tagName !== tag) open.pop();

    let current = open.at(-1);
    if (!current || current.level < level) {
      const list = doc.createElement(tag);
      if (current) {
        const item =
          current.list.lastElementChild ??
          current.list.appendChild(doc.createElement("li"));
        item.append(list);
      } else {
        paragraph.before(list);
      }
      current = { id, level, list };
      open.push(current);
    }

    current.list.append(
      appendAll(doc.createElement("li"), Array.from(paragraph.childNodes)),
    );
    paragraph.remove();
  }
}

/**
 * The text styles of an element - `true` / `false` where its inline style
 * says so, `undefined` where it does not. Google Docs sets the weight on
 * every span and wraps the whole content in `<b style="font-weight:normal">`,
 * and underlines by a style.
 */
function readTextStyle(element: Element) {
  const {
    fontFamily = "",
    fontStyle = "",
    fontWeight = "",
    textDecoration = "",
    textDecorationLine = "",
  } = (element as Partial<HTMLElement>).style ?? {};

  const weight =
    fontWeight === "bold" || fontWeight === "bolder"
      ? 700
      : fontWeight === "normal" || fontWeight === "lighter"
        ? 400
        : Number.parseInt(fontWeight, 10);
  const decoration = `${textDecorationLine} ${textDecoration}`;

  return {
    bold: Number.isNaN(weight) ? undefined : weight >= 600,
    code: MONOSPACE.test(fontFamily) || undefined,
    italic: /^(italic|oblique)/.test(fontStyle)
      ? true
      : fontStyle === "normal"
        ? false
        : undefined,
    strike: /\bline-through\b/.test(decoration) || undefined,
    underline: /\bunderline\b/.test(decoration) || undefined,
  };
}

/** The text styles of an element whose inline styles are not read. */
const NO_TEXT_STYLE: ReturnType<typeof readTextStyle> = {
  bold: undefined,
  code: undefined,
  italic: undefined,
  strike: undefined,
  underline: undefined,
};

const isElement = (node: Node): node is Element =>
  node.nodeType === ELEMENT_NODE;

const isOutputBlock = (node: Node) =>
  isElement(node) && OUTPUT_BLOCKS.has(node.tagName);

const isList = (node: Node) =>
  isElement(node) && (node.tagName === "UL" || node.tagName === "OL");

/**
 * Appends nodes one by one - spread into the arguments of `append`, a long
 * list (a paragraph of 150,000 line breaks) would throw.
 */
function appendAll<T extends Node>(parent: T, nodes: Node[]) {
  for (const node of nodes) parent.appendChild(node);
  return parent;
}

function createElement(output: Document, tag: string, children: Node[] = []) {
  return appendAll(output.createElement(tag), children);
}

/** Text of HTML whitespace only - source formatting, nothing that shows. */
const isBlank = (node: Node) =>
  node.nodeType === TEXT_NODE && BLANK.test(node.textContent ?? "");

// The content of the paragraphs inside a line - apart from them, until the
// line element they end up in makes lines of it (`toLines`)
const paragraphContent = new WeakMap<Node, Node[]>();
// The paragraphs inside a line that show nothing
const emptyParagraphs = new WeakSet<Node>();

/** Whether content shows nothing - whitespace, or paragraphs of nothing. */
const showsNothing = (nodes: Node[]) =>
  nodes.every((node) => isBlank(node) || emptyParagraphs.has(node));

/**
 * A paragraph inside a line (a `<div>` in a cell, a list item in a heading)
 * - its content is kept as it is copied, not moved into it: content nested
 * many paragraphs deep is moved once, into the line element.
 */
function createLineParagraph(output: Document, tag: string, content: Node[]) {
  const paragraph = output.createElement(tag);
  paragraphContent.set(paragraph, content);
  if (showsNothing(content)) emptyParagraphs.add(paragraph);
  return paragraph;
}

const contentOf = (node: Node) =>
  paragraphContent.get(node) ?? Array.from(node.childNodes);

/**
 * The text of a node without that of the elements never meant as text -
 * walked, not recursed, as the content is deeper than the copy goes.
 */
function textOf(node: Node, output: Document) {
  const walker = output.createTreeWalker(node, SHOW_ELEMENT | SHOW_TEXT, {
    acceptNode: (current) =>
      isElement(current) && DROPPED_TAGS.has(current.tagName.toUpperCase())
        ? FILTER_REJECT
        : FILTER_ACCEPT,
  });

  let text = "";
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    if (current.nodeType === TEXT_NODE) text += current.textContent;
  }
  return text;
}

/**
 * Wraps the runs of inline content into paragraphs - blocks stay as they
 * are, and whitespace between them (source formatting) is no paragraph.
 */
function toParagraphs(nodes: Node[], output: Document) {
  const blocks: Node[] = [];
  let run: Node[] = [];

  const flush = () => {
    const hasContent = run.some(
      (node) => node.nodeType !== TEXT_NODE || node.textContent?.trim(),
    );

    if (hasContent) blocks.push(createElement(output, "p", run));
    run = [];
  };

  for (const node of nodes) {
    if (isOutputBlock(node)) {
      flush();
      blocks.push(node);
    } else {
      run.push(node);
    }
  }
  flush();

  return blocks;
}

/**
 * The content of paragraphs as lines of one line element - the paragraphs
 * Google Docs puts into every table cell, the lines a heading or quote gets
 * in a cell. Paragraphs in paragraphs are lines as well - made so in one
 * walk into `lines`, so content nested deep is not gone through again at
 * every level.
 */
function toLines(nodes: Node[], output: Document, lines: Node[] = []) {
  let hasContent = false;
  // A paragraph ends its line
  let breaksLine = false;

  for (const node of nodes) {
    if (node.nodeType === TEXT_NODE && !node.textContent?.trim()) {
      lines.push(node);
      continue;
    }

    const isParagraph =
      isElement(node) && (node.tagName === "P" || node.tagName === "DIV");

    if (hasContent && (isParagraph || breaksLine)) {
      lines.push(output.createElement("br"));
    }
    if (isParagraph) {
      toLines(contentOf(node), output, lines);
    } else {
      lines.push(node);
    }
    hasContent = true;
    breaksLine = isParagraph;
  }

  return lines;
}

/** The content of a list item - its lines, and the lists nested in it. */
function toItemContent(nodes: Node[], output: Document) {
  const content: Node[] = [];
  let run: Node[] = [];

  const flush = () => {
    toLines(run, output, content);
    run = [];
  };

  for (const node of nodes) {
    if (isList(node)) {
      flush();
      content.push(node);
    } else {
      run.push(node);
    }
  }
  flush();

  return content;
}

/** Whether a run is worth a mark - not whitespace or a lone line break. */
const hasText = (nodes: Node[]) =>
  nodes.some((node) =>
    node.nodeType === TEXT_NODE
      ? !!node.textContent?.trim()
      : node.nodeName !== "BR",
  );

/** A mark around content - the element it wraps the runs of the content in. */
interface Wrapper {
  mark: Mark;
  wrap: (run: Node[]) => Element;
}

/**
 * `nodes` with their runs of inline content wrapped by `wrapper` - also the
 * runs in the lines of blocks among them, so a mark around paragraphs (a
 * bold `<div>`, a link around a table) ends up inside them. Nothing is
 * marked bold in what is bold anyway (a heading, a header cell).
 */
function wrapRuns(nodes: Node[], wrapper: Wrapper): Node[] {
  const result: Node[] = [];
  let run: Node[] = [];

  const flush = () => {
    if (hasText(run)) result.push(wrapper.wrap(run));
    else for (const node of run) result.push(node);
    run = [];
  };

  for (const node of nodes) {
    if (isOutputBlock(node)) {
      flush();
      wrapRunsIn(node as Element, wrapper);
      result.push(node);
    } else {
      run.push(node);
    }
  }
  flush();

  return result;
}

function wrapRunsIn(element: Element, wrapper: Wrapper) {
  if (wrapper.mark === "bold" && BOLD_LINES.has(element.tagName)) return;

  if (LINE_ELEMENTS.has(element.tagName)) {
    const content = wrapRuns(contentOf(element), wrapper);
    if (paragraphContent.has(element)) {
      paragraphContent.set(element, content);
    } else {
      element.replaceChildren();
      appendAll(element, content);
    }
  } else {
    // Lists, quotes and the parts of tables hold the lines
    for (const child of Array.from(element.children)) {
      wrapRunsIn(child, wrapper);
    }
  }
}

function copyText(text: string, pre: boolean, output: Document) {
  if (!pre) return [output.createTextNode(text)];

  return text
    .split(/\r?\n/)
    .flatMap((line, index) =>
      index === 0
        ? [output.createTextNode(line)]
        : [output.createElement("br"), output.createTextNode(line)],
    );
}

/** The heading of the editor a heading becomes - the closest one kept. */
function headingTag(tag: string, formats: ReadonlySet<RichTextFormat>) {
  const order: RichTextFormat[] =
    tag === "H1" || tag === "H2"
      ? ["heading2", "heading3"]
      : ["heading3", "heading2"];
  const format = order.find((candidate) => formats.has(candidate));

  return format ? (format === "heading2" ? "h2" : "h3") : null;
}

/** The list a list becomes - the other kind when only that one is kept. */
function listTag(tag: string, formats: ReadonlySet<RichTextFormat>) {
  const order: RichTextFormat[] =
    tag === "OL"
      ? ["numberedList", "bulletList"]
      : ["bulletList", "numberedList"];
  const format = order.find((candidate) => formats.has(candidate));

  return format ? (format === "numberedList" ? "ol" : "ul") : null;
}

/**
 * The marks around the content of `element`: the formatting its content is
 * copied with, and the wrappers that make the output keep it - first those
 * of its text styles (a bold `<span>`), then its own element when it is a
 * mark that is kept. Nothing is marked twice, and nothing is marked bold in
 * what is bold anyway (`boldBlock` - a heading, a header cell).
 */
function formattingOf(
  element: Element,
  tag: string,
  formatting: Formatting,
  state: CopyState,
  boldBlock: boolean,
) {
  const { formats, output } = state;
  const own = MARK_TAGS[tag];
  const style = state.readsStyles ? readTextStyle(element) : NO_TEXT_STYLE;
  const allows = (mark: Mark) => formats.has(MARK_FORMATS[mark]);
  const href = own?.mark === "link" ? element.getAttribute("href") : null;

  // A `<b>` of normal weight is none - the wrapper of Google Docs. A link
  // in a link (the parser nests them across a table) would split the outer
  // one when the output is parsed again. A link without a safe `href` is
  // its text - an `<a>` of none would look like a link that leads nowhere.
  const isKept =
    !!own &&
    allows(own.mark) &&
    !formatting[own.mark] &&
    !(own.mark === "bold" && (style.bold === false || boldBlock)) &&
    !(own.mark === "italic" && style.italic === false) &&
    !(own.mark === "link" && (href === null || !isSafeHref(href)));

  const inner: Formatting = {
    ...formatting,
    bold: formatting.bold || boldBlock,
    pre: formatting.pre || tag === "PRE" || tag === "LISTING",
  };
  const wrappers: Wrapper[] = [];

  for (const [mark, markTag] of STYLE_MARKS) {
    // A link is underlined anyway - Google Docs underlines it by a style
    const adds =
      style[mark] === true &&
      !inner[mark] &&
      own?.mark !== mark &&
      allows(mark) &&
      !(mark === "underline" && (formatting.link || own?.mark === "link"));

    if (adds) {
      inner[mark] = true;
      wrappers.push({
        mark,
        wrap: (run) => createElement(output, markTag, run),
      });
    }
  }

  if (own && isKept) {
    inner[own.mark] = true;
    wrappers.push({
      mark: own.mark,
      wrap: (run) => {
        const copy = createElement(output, own.tag, run);
        if (href !== null) copy.setAttribute("href", href);
        return copy;
      },
    });
  }

  return { inner, wrappers };
}

function copyChildren(
  parent: Node,
  state: CopyState,
  formatting: Formatting,
  context: Context,
): Node[] {
  return Array.from(parent.childNodes).flatMap((child) =>
    copyNode(child, state, formatting, context),
  );
}

/**
 * The sanitized copy of a node in `context` - elements that are kept are
 * created anew with only the allowed attributes, so nothing else of the
 * source comes along (not even the "is value" the serializer would write
 * back from a removed `is` attribute).
 */
function copyNode(
  node: Node,
  state: CopyState,
  formatting: Formatting,
  context: Context,
): Node[] {
  if (node.nodeType === TEXT_NODE) {
    return copyText(node.textContent ?? "", formatting.pre, state.output);
  }

  if (!isElement(node)) return [];

  // SVG and MathML elements keep the case of their names (`svg`, `style`)
  const tag = node.tagName.toUpperCase();
  if (DROPPED_TAGS.has(tag)) return [];

  if (state.depth >= MAX_DEPTH) {
    return copyText(textOf(node, state.output), formatting.pre, state.output);
  }

  state.depth += 1;
  const content = copyElementWithMarks(node, tag, state, formatting, context);
  state.depth -= 1;

  return content;
}

/** The copy of an element and the marks around its content. */
function copyElementWithMarks(
  node: Element,
  tag: string,
  state: CopyState,
  formatting: Formatting,
  context: Context,
) {
  // Only HTML elements - an `<a>` inside an SVG is no link
  if (node.namespaceURI !== HTML_NAMESPACE) {
    return copyChildren(node, state, formatting, context);
  }

  const heading =
    HEADING_TAGS.has(tag) && context === "flow"
      ? headingTag(tag, state.formats)
      : null;
  const { inner, wrappers } = formattingOf(
    node,
    tag,
    formatting,
    state,
    heading !== null,
  );

  let content = copyElement(node, tag, heading, state, inner, context);
  if (wrappers.length > 0) {
    // A mark goes around the lines of the paragraphs inside a line - made
    // lines of here, at most once for each kind of mark around them
    for (const paragraph of content) {
      const lines = paragraphContent.get(paragraph);
      if (lines) paragraphContent.set(paragraph, toLines(lines, state.output));
    }
  }
  for (const wrapper of wrappers) content = wrapRuns(content, wrapper);

  return content;
}

/** The output of an element, before the marks around its content. */
function copyElement(
  element: Element,
  tag: string,
  heading: string | null,
  state: CopyState,
  formatting: Formatting,
  context: Context,
): Node[] {
  const { formats, output } = state;
  const children = (childContext: Context) =>
    copyChildren(element, state, formatting, childContext);
  const isBlockContext = context === "flow" || context === "quote";
  // The text of the element - its blocks as its lines
  const lines = () => toLines(children("line"), output);
  // The paragraphs of the element - inside a line, paragraphs of the line
  const paragraph = isBlockContext ? createElement : createLineParagraph;
  // A block in the text of a heading, an item or a cell - a line of it
  const asLine = () => [createLineParagraph(output, "p", children("line"))];

  if (tag === "BR") return [output.createElement("br")];

  if (tag === "HR") {
    const isKept = context === "flow" && formats.has("horizontalRule");
    // A rule is a line break where it is not kept
    return [output.createElement(isKept ? "hr" : "br")];
  }

  if (tag === "P" || tag === "DIV") {
    // A wrapper of blocks - the page layout of pasted content - is none,
    // also with inline elements between (`<div><b><p>`)
    if (isBlockContext && state.holdsBlocks.has(element)) {
      return toParagraphs(children(context), output);
    }

    // Its blocks are its lines - a paragraph in a paragraph would be split
    // when the output is parsed again. A paragraph that shows nothing (a
    // leftover of stray tags or a dropped image) is none.
    const content = isBlockContext ? lines() : children("line");
    return showsNothing(content)
      ? []
      : [paragraph(output, tag.toLowerCase(), content)];
  }

  if (heading) {
    const content = lines();
    return content.length > 0 ? [createElement(output, heading, content)] : [];
  }

  if (LIST_TAGS.has(tag)) {
    const kept =
      context === "flow" || context === "item" ? listTag(tag, formats) : null;

    if (kept) return copyList(element, kept, state, formatting);
    // Its items become paragraphs, or lines of the text around
    return isBlockContext
      ? toParagraphs(children(context), output)
      : children("line");
  }

  if (tag === "BLOCKQUOTE") {
    if (context === "flow" && formats.has("blockquote")) {
      const paragraphs = toParagraphs(children("quote"), output);
      return paragraphs.length > 0
        ? [createElement(output, "blockquote", paragraphs)]
        : [];
    }
    // A quote in a quote is part of it - elsewhere its paragraphs remain
    if (context === "quote") return children("quote");
    return isBlockContext
      ? toParagraphs(children(context), output)
      : children("line");
  }

  if (tag === "TABLE") {
    return context === "flow" && formats.has("table")
      ? copyTable(element, state, formatting)
      : copyRowsAsLines(element, state, formatting, paragraph);
  }

  // The parts of a table outside of a table that is kept
  if (tag === "TR") {
    return [paragraph(output, "p", copyRow(element, state, formatting))];
  }
  if (tag === "COL" || tag === "COLGROUP") return [];
  if (tag === "THEAD" || tag === "TBODY" || tag === "TFOOT") {
    return isBlockContext
      ? toParagraphs(children(context), output)
      : children("line");
  }

  if (
    HEADING_TAGS.has(tag) ||
    BLOCK_TAGS.has(tag) ||
    tag === "LI" ||
    tag === "CAPTION" ||
    tag === "TD" ||
    tag === "TH"
  ) {
    return isBlockContext ? toParagraphs(children(context), output) : asLine();
  }

  // Inline elements - their text, with the marks kept around it
  return children(context);
}

function copyList(
  list: Element,
  tag: string,
  state: CopyState,
  formatting: Formatting,
): Node[] {
  const { output } = state;
  const copy = output.createElement(tag);
  let lastItem: Element | null = null;

  for (const child of Array.from(list.childNodes)) {
    if (isElement(child) && child.tagName === "LI") {
      lastItem = copyListItem(child, state, formatting);
      copy.append(lastItem);
    } else if (isElement(child) && LIST_TAGS.has(child.tagName)) {
      // A list right in a list (Chrome indents so) is nested in the item
      // before it
      const nested = copyNode(child, state, formatting, "item");
      if (!lastItem) {
        lastItem = output.createElement("li");
        copy.append(lastItem);
      }
      appendAll(lastItem, nested);
    } else if (child.nodeType !== TEXT_NODE || child.textContent?.trim()) {
      // Content outside of an item is an item of its own
      const content = copyNode(child, state, formatting, "item");
      if (hasText(content)) {
        lastItem = createElement(output, "li", toItemContent(content, output));
        copy.append(lastItem);
      }
    }
  }

  return copy.childNodes.length > 0 ? [copy] : [];
}

function copyListItem(item: Element, state: CopyState, formatting: Formatting) {
  const { inner, wrappers } = formattingOf(
    item,
    "LI",
    formatting,
    state,
    false,
  );

  let content = toItemContent(
    copyChildren(item, state, inner, "item"),
    state.output,
  );
  for (const wrapper of wrappers) content = wrapRuns(content, wrapper);

  return createElement(state.output, "li", content);
}

const cellsOf = (row: Element) =>
  Array.from(row.children).filter(
    (child) => child.tagName === "TD" || child.tagName === "TH",
  );

/** The rows of a table in order - also those of its sections. */
function rowsOf(table: Element) {
  return Array.from(table.children).flatMap((child) =>
    child.tagName === "TR"
      ? [child]
      : ["THEAD", "TBODY", "TFOOT"].includes(child.tagName)
        ? Array.from(child.children).filter((row) => row.tagName === "TR")
        : [],
  );
}

/** The cells of a row on one line, separated by tabs. */
function copyRow(row: Element, state: CopyState, formatting: Formatting) {
  return cellsOf(row).flatMap((cell, index) => [
    ...(index > 0 ? [state.output.createTextNode("\t")] : []),
    ...toLines(copyChildren(cell, state, formatting, "line"), state.output),
  ]);
}

/**
 * Makes a paragraph - one of the output (`createElement`), or one inside a
 * line (`createLineParagraph`).
 */
type ParagraphMaker = (output: Document, tag: string, content: Node[]) => Node;

/** Rows as lines of text - a paragraph of each, its cells separated by tabs. */
function rowsAsLines(
  rows: Element[],
  state: CopyState,
  formatting: Formatting,
  paragraph: ParagraphMaker,
) {
  const lines: Node[] = [];

  for (const row of rows) {
    const line = copyRow(row, state, formatting);
    if (hasText(line)) lines.push(paragraph(state.output, "p", line));
  }
  return lines;
}

/** A table that is not kept - a line of text for each of its rows. */
function copyRowsAsLines(
  table: Element,
  state: CopyState,
  formatting: Formatting,
  paragraph: ParagraphMaker,
) {
  const caption = Array.from(table.children).find(
    (child) => child.tagName === "CAPTION",
  );
  const lines: Node[] = [];

  if (caption) {
    const text = toLines(
      copyChildren(caption, state, formatting, "line"),
      state.output,
    );
    if (hasText(text)) lines.push(paragraph(state.output, "p", text));
  }

  for (const line of rowsAsLines(rowsOf(table), state, formatting, paragraph)) {
    lines.push(line);
  }
  return lines;
}

/**
 * The source cells of rows by their columns - `null` where a cell of an
 * earlier row or column spans over (with `spans`). Every row of the output
 * has a cell in every column, so the columns of a pasted table stay in
 * line. `null` when the table would be too big to edit - it stops as soon
 * as it gets there, so a table of huge spans costs no more than a small one.
 */
function layOutCells(rows: Element[], spans: boolean) {
  const grid: (Element | null | undefined)[][] = rows.map(() => []);
  let cells = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    let column = 0;

    for (const cell of cellsOf(rows[rowIndex])) {
      while (grid[rowIndex][column] !== undefined) column += 1;

      const { colSpan = 1, rowSpan = 1 } = spans
        ? (cell as HTMLTableCellElement)
        : {};
      const columns = Math.max(colSpan, 1);
      // 0 spans the rest of the rows
      const remaining = rows.length - rowIndex;
      const rowsSpanned = Math.min(rowSpan || remaining, remaining);

      cells += columns * rowsSpanned;
      if (column + columns > MAX_TABLE_COLUMNS || cells > MAX_TABLE_CELLS) {
        return null;
      }

      for (let dRow = 0; dRow < rowsSpanned; dRow += 1) {
        for (let dColumn = 0; dColumn < columns; dColumn += 1) {
          grid[rowIndex + dRow][column + dColumn] =
            dRow === 0 && dColumn === 0 ? cell : null;
        }
      }
      column += columns;
    }
  }

  // Short rows are filled up to the widest one
  let width = 0;
  for (const row of grid) width = Math.max(width, row.length);
  return width * rows.length > MAX_TABLE_CELLS ? null : { grid, width };
}

function copyCell(
  source: Element | null | undefined,
  tag: string,
  state: CopyState,
  formatting: Formatting,
) {
  const cell = state.output.createElement(tag);
  if (!source) return cell;

  const { inner, wrappers } = formattingOf(
    source,
    source.tagName,
    formatting,
    state,
    tag === "th",
  );
  let content = toLines(
    copyChildren(source, state, inner, "line"),
    state.output,
  );
  for (const wrapper of wrappers) content = wrapRuns(content, wrapper);

  return appendAll(cell, content);
}

/**
 * A table the editor can edit: a header (`<thead>`) and a body of rows with
 * a cell in every column - merged cells are split into cells of their own,
 * and the caption becomes a paragraph before the table.
 */
function copyTable(table: Element, state: CopyState, formatting: Formatting) {
  const { output } = state;
  const result: Node[] = [];
  const head: Element[] = [];
  const body: Element[] = [];

  for (const child of Array.from(table.children)) {
    if (child.tagName === "CAPTION") {
      const caption = toLines(
        copyChildren(child, state, formatting, "line"),
        output,
      );
      if (hasText(caption)) result.push(createElement(output, "p", caption));
    } else if (child.tagName === "THEAD") {
      for (const row of rowsOf(child)) head.push(row);
    } else if (child.tagName === "TBODY" || child.tagName === "TFOOT") {
      for (const row of rowsOf(child)) body.push(row);
    } else if (child.tagName === "TR") {
      body.push(child);
    }
  }

  // A first row of header cells is the header
  const firstCells = body.length > 0 ? cellsOf(body[0]) : [];
  if (
    head.length === 0 &&
    firstCells.length > 0 &&
    firstCells.every((cell) => cell.tagName === "TH")
  ) {
    head.push(body.shift() as Element);
  }

  const rows = [...head, ...body];
  const layout = layOutCells(rows, true) ?? layOutCells(rows, false);
  if (!layout) {
    for (const line of rowsAsLines(rows, state, formatting, createElement)) {
      result.push(line);
    }
    return result;
  }

  const { grid, width: columns } = layout;
  if (columns === 0) return result;

  const copyRowAt = (rowIndex: number) => {
    const isHead = rowIndex < head.length;
    const row = output.createElement("tr");

    for (let column = 0; column < columns; column += 1) {
      const source = grid[rowIndex][column];
      const tag = source ? source.tagName.toLowerCase() : isHead ? "th" : "td";
      row.append(copyCell(source, tag, state, formatting));
    }
    return row;
  };

  const copy = output.createElement("table");
  if (head.length > 0) {
    copy.append(
      createElement(
        output,
        "thead",
        head.map((_, index) => copyRowAt(index)),
      ),
    );
  }
  if (body.length > 0) {
    copy.append(
      createElement(
        output,
        "tbody",
        body.map((_, index) => copyRowAt(head.length + index)),
      ),
    );
  }
  result.push(copy);

  return result;
}

// The formats of a list of them, by the list - the rules of an editor are
// asked for on every change
const formatSets = new Map<string, ReadonlySet<RichTextFormat>>();

function toFormatSet(formats: readonly RichTextFormat[] = ALL_FORMATS) {
  const key = formats.join();
  let set = formatSets.get(key);

  if (!set) {
    set = new Set(formats);
    formatSets.set(key, set);
  }
  return set;
}

/**
 * The document of HTML - parsed as the page it is shown in parses it (in
 * standards mode), where a table ends a paragraph. In the quirks mode of a
 * document without a doctype it would not. Right in the body, like the
 * HTML of an element: whitespace at the start stays (the head would take
 * it), so the output of the output is the same.
 */
const parse = (html: string) =>
  new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}`, "text/html");

/** The sanitized copy of HTML in an element of its own - `null` for none. */
function sanitizeRich(
  html: string,
  formats: readonly RichTextFormat[] | undefined,
  context: Context,
  readsStyles: boolean,
) {
  if (!html) return null;

  const document = parse(html);
  if (readsStyles && html.includes("mso-list")) {
    convertWordLists(document.body);
  }
  const state: CopyState = {
    depth: 0,
    formats: toFormatSet(formats),
    holdsBlocks: findBlockHolders(document.body),
    output: document,
    readsStyles,
  };
  const content = copyChildren(document.body, state, NO_FORMATTING, context);

  const container = document.createElement("div");
  appendAll(
    container,
    context === "line"
      ? toLines(content, document)
      : context === "quote"
        ? toParagraphs(content, document)
        : withoutBlankAroundBlocks(content),
  );
  return container;
}

/**
 * The output without the whitespace around its blocks - source formatting,
 * and what the head of a pasted page leaves (the parser puts it into the
 * body). Whitespace next to text stays: pasted into a line, it is a space.
 */
function withoutBlankAroundBlocks(nodes: Node[]) {
  const result: Node[] = [];
  let blanks: Node[] = [];
  const keepBlanks = (next: Node | undefined) => {
    const last = result.at(-1);
    if (!(last && isOutputBlock(last)) && !(next && isOutputBlock(next))) {
      for (const blank of blanks) result.push(blank);
    }
    blanks = [];
  };

  for (const node of nodes) {
    if (isBlank(node)) {
      blanks.push(node);
    } else {
      keepBlanks(node);
      result.push(node);
    }
  }
  keepBlanks(undefined);

  return result;
}

/**
 * Reduces HTML to what RichTextEditor produces - paragraphs, headings (h2,
 * h3), bulleted and numbered lists, quotes, tables, horizontal rules, bold,
 * italic, underline, strikethrough, inline code and links with safe URLs -
 * without any styles, classes or other attributes, so neither a loaded
 * value nor pasted content can run scripts or bring foreign styles. The
 * content of other editors keeps its shape: `h1` becomes `h2` and `h4` -
 * `h6` become `h3`, merged table cells are split, the list paragraphs of
 * Word become lists (without their bullets and numbers as text), and the
 * bold, italic, underlined, struck and monospace text styles of Google
 * Docs and Word become `<b>`, `<i>`, `<u>`, `<s>` and `<code>`. A table too
 * big to edit (over 50 columns or 10,000 cells, also without its merged
 * cells) becomes lines of text, and content nested over 100 elements deep
 * its text - the output never grows far beyond the input, and its output
 * is the same again. `formats` narrows it down to what an editor with
 * fewer tools makes. Also the way to render stored HTML of the editor:
 * `dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}` inside an
 * element with the `rich-text` class.
 *
 * Needs `DOMParser` - it runs in the browser, and on a server with a
 * global `DOMParser` (e.g. jsdom's: `globalThis.DOMParser = new
 * JSDOM().window.DOMParser`), which is all it takes of a DOM. It throws on
 * a server without one (importing it is safe anywhere). A page rendered on
 * the server without it calls it once it is hydrated - see the docs of
 * RichTextEditor.
 */
export default function sanitizeRichText(
  html: string,
  { formats }: SanitizeRichTextOptions = {},
) {
  return sanitizeRich(html, formats, "flow", true)?.innerHTML ?? "";
}

/**
 * `sanitizeRichText` for content that goes into a line of text, like a
 * table cell - its blocks become lines separated by line breaks.
 */
export function sanitizeRichTextLines(
  html: string,
  formats?: readonly RichTextFormat[],
) {
  return sanitizeRich(html, formats, "line", true)?.innerHTML ?? "";
}

/**
 * `sanitizeRichText` for content that goes into a quote - its blocks
 * become paragraphs, the only blocks a quote holds.
 */
export function sanitizeRichTextParagraphs(
  html: string,
  formats?: readonly RichTextFormat[],
) {
  return sanitizeRich(html, formats, "quote", true)?.innerHTML ?? "";
}

/**
 * `sanitizeRichText` of the content of RichTextEditor - and whether it has
 * any text. The inline styles of its own content are left out: the
 * browser's editing puts them there (a heading merged into a paragraph
 * keeps its size and weight in a `<span style>`), they are no formatting
 * of the user. Those of a value loaded from outside are read (`readsStyles`)
 * like those of pasted content.
 */
export function sanitizeEditorContent(
  html: string,
  formats: readonly RichTextFormat[],
  readsStyles = false,
) {
  const container = sanitizeRich(html, formats, "flow", readsStyles);

  return {
    hasText: !!container?.textContent?.trim(),
    html: container?.innerHTML ?? "",
  };
}

function copyInlineNode(
  node: Node,
  rules: InlineRules,
  inLink: boolean,
  pre: boolean,
  output: Document,
  depth: number,
): Node[] {
  if (node.nodeType === TEXT_NODE) {
    return copyText(node.textContent ?? "", pre, output);
  }

  if (!isElement(node)) return [];

  const tag = node.tagName.toUpperCase();
  if (DROPPED_TAGS.has(tag)) return [];
  if (depth >= MAX_DEPTH) return copyText(textOf(node, output), pre, output);

  // Only HTML elements - an `<a>` inside an SVG is no link. A link in a
  // link would split the outer one when the output is parsed again, and a
  // link without a safe `href` is its text.
  const href = tag === "A" ? node.getAttribute("href") : null;
  const isKept =
    node.namespaceURI === HTML_NAMESPACE &&
    rules.tags.has(tag) &&
    !(tag === "A" && (inLink || href === null || !isSafeHref(href)));

  const content = Array.from(node.childNodes).flatMap((child) =>
    copyInlineNode(
      child,
      rules,
      inLink || (isKept && tag === "A"),
      pre || tag === "PRE" || tag === "LISTING",
      output,
      depth + 1,
    ),
  );

  if (!isKept) return content;

  const copy = output.createElement(tag.toLowerCase());

  for (const { name, value } of Array.from(node.attributes)) {
    const isSafeLink = tag === "A" && name === "href" && isSafeHref(value);
    if (isSafeLink || rules.attributes.has(name)) {
      copy.setAttribute(name, value);
    }
  }

  if (copy.hasAttribute("class")) cleanClasses(copy, rules);

  return [appendAll(copy, content)];
}

function cleanClasses(element: Element, rules: InlineRules) {
  const { isSafeClass } = rules;
  if (!isSafeClass) return;

  // A styled link could be stretched into a click trap over the page
  const kept =
    element.tagName === "A"
      ? []
      : Array.from(element.classList).filter((className) =>
          isSafeClass(className),
        );

  if (kept.length > 0) {
    element.setAttribute("class", kept.join(" "));
  } else {
    element.removeAttribute("class");
  }
}

/**
 * Reduces HTML to inline formatting (bold, italic, `span`, `small`, links, …)
 * - no scripts, event handlers or styles. Elements other than links keep
 * the classes of text styling (`text-*`, `font-*`, `bg-*`, `underline`,
 * `rounded`, `border`, small `px-*` / `py-*`, …) - also behind `dark:`,
 * `hover:`, `focus:` or `active:` - nothing that positions or sizes them,
 * nor variants that style other elements. Links without a safe `href` are
 * their text. Needs `DOMParser`, like `sanitizeRichText`.
 */
export function sanitizeInlineHtml(html: string) {
  if (!html) return "";

  const document = parse(html);
  const container = document.createElement("div");

  appendAll(
    container,
    Array.from(document.body.childNodes).flatMap((child) =>
      copyInlineNode(child, INLINE_HTML, false, false, document, 0),
    ),
  );

  return container.innerHTML;
}
