// The characters of RichTextEditor as `maxLength` counts them - those of
// its text, as it shows. Line breaks, the ends of paragraphs and images
// count none; a run of spaces and new lines of the source counts as the one
// space it shows (in code blocks each character counts, as it shows). The
// characters are UTF-16 code units, like those of a native field.

// Elements whose whitespace right inside is source formatting between
// their blocks - it shows nothing
const BLOCK_CONTAINERS = new Set([
  "BLOCKQUOTE",
  "OL",
  "TABLE",
  "TBODY",
  "TFOOT",
  "THEAD",
  "TR",
  "UL",
]);

// Whitespace of HTML - not the no-break space typed spaces become
const WHITESPACE = /[\t\n\f\r ]+/g;
const BLANK = /^[\t\n\f\r ]*$/;

const BLOCK_ELEMENTS = new Set([
  // Keep the names literal: spreading a Set makes an unused source copy
  // retain its iterator as a possible side effect during tree shaking.
  "BLOCKQUOTE",
  "OL",
  "TABLE",
  "TBODY",
  "TFOOT",
  "THEAD",
  "TR",
  "UL",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "P",
  "PRE",
  "TD",
  "TH",
]);
const INLINE_BREAKS = new Set(["BR", "HR", "IMG"]);

/** Whether a text node is in a code block, whose whitespace all shows. */
function isInCode(node: Node, root: Node) {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (parent.nodeName === "PRE") return true;
    if (parent === root) return false;
  }
  return false;
}

/** Source formatting between blocks, rather than a space between inline marks. */
function isBetweenBlocks(text: Text, root: Node) {
  const parent = text.parentNode;
  return (
    !parent ||
    BLOCK_CONTAINERS.has(parent.nodeName) ||
    (parent === root &&
      ((!text.previousSibling && !text.nextSibling) ||
        BLOCK_ELEMENTS.has(text.previousSibling?.nodeName ?? "") ||
        BLOCK_ELEMENTS.has(text.nextSibling?.nodeName ?? "")))
  );
}

/** The line whose inline nodes share collapsing whitespace. */
function lineOf(text: Text, root: Node) {
  for (
    let parent = text.parentNode;
    parent && parent !== root;
    parent = parent.parentNode
  ) {
    if (BLOCK_ELEMENTS.has(parent.nodeName)) return parent;
  }
  return root;
}

/** Text nodes in document order; null separates independent whitespace runs. */
function* contentParts(root: Node) {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, 0x5 /* SHOW_ELEMENT | SHOW_TEXT */);
  let line: Node | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 1) {
      if (
        BLOCK_ELEMENTS.has(node.nodeName) ||
        INLINE_BREAKS.has(node.nodeName)
      ) {
        yield null;
      }
      continue;
    }

    const text = node as Text;
    const nextLine = lineOf(text, root);
    if (nextLine !== line) yield null;
    line = nextLine;
    if (
      !isInCode(text, root) &&
      isBetweenBlocks(text, root) &&
      BLANK.test(text.data)
    ) {
      continue;
    }
    yield text;
  }
}

/**
 * The text as it shows, collapsing whitespace across inline nodes. Code
 * and no-break spaces keep their literal characters.
 */
function* shownTexts(root: Node) {
  let endsWithSpace = false;
  for (const text of contentParts(root)) {
    if (!text) {
      endsWithSpace = false;
      continue;
    }
    if (isInCode(text, root)) {
      endsWithSpace = false;
      yield { text, shown: text.data };
      continue;
    }

    let shown = text.data.replace(WHITESPACE, " ");
    if (endsWithSpace && shown.startsWith(" ")) shown = shown.slice(1);
    if (shown) endsWithSpace = shown.endsWith(" ");
    yield { text, shown };
  }
}

/** The characters of the content of a node - an element or a fragment. */
export function countCharacters(root: Node) {
  let count = 0;
  for (const { shown } of shownTexts(root)) count += shown.length;
  return count;
}

/**
 * The characters a selection replaces in its original context. A collapsed
 * whitespace run frees one character only when the whole run is selected;
 * deleting part of it leaves the same visible space in the editor.
 */
export function countRangeCharacters(root: Node, range: Range) {
  if (range.collapsed) return 0;

  let count = 0;
  let selectedSpace: boolean | undefined;
  const endSpace = () => {
    if (selectedSpace) count += 1;
    selectedSpace = undefined;
  };
  for (const text of contentParts(root)) {
    if (!text) {
      endSpace();
      continue;
    }
    const intersects = range.intersectsNode(text);
    const start = intersects
      ? range.startContainer === text
        ? range.startOffset
        : 0
      : 0;
    const end = intersects
      ? range.endContainer === text
        ? range.endOffset
        : text.length
      : 0;
    if (isInCode(text, root)) {
      endSpace();
      count += end - start;
      continue;
    }

    for (const part of text.data.matchAll(/[\t\n\f\r ]+|[^\t\n\f\r ]+/g)) {
      const from = part.index;
      const to = from + part[0].length;
      if (BLANK.test(part[0])) {
        selectedSpace = (selectedSpace ?? true) && start <= from && end >= to;
      } else {
        endSpace();
        count += Math.max(0, Math.min(end, to) - Math.max(start, from));
      }
    }
  }
  endSpace();
  return count;
}

/** The content of HTML - parsed, not rendered: nothing of it loads. */
function parseHtml(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template;
}

/** The characters of HTML. Needs a DOM - there is none on a server. */
export const countHtmlCharacters = (html: string) =>
  html ? countCharacters(parseHtml(html).content) : 0;

/** `length` code units of `text` - not half of a surrogate pair. */
function cutAt(text: string, length: number) {
  const code = text.charCodeAt(length - 1);
  return length > 0 && code >= 0xd800 && code <= 0xdbff ? length - 1 : length;
}

// The parts of a table - a cut keeps them, so its rows keep their cells
const TABLE_PARTS = new Set([
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
]);

/**
 * The outermost element `text` starts - a cut at its start takes the
 * element along, instead of leaving it empty (an empty paragraph or list
 * item would be inserted). Not a part of a table.
 */
function startedBy(text: Text, root: Node) {
  let node: Node = text;
  while (
    !node.previousSibling &&
    node.parentNode &&
    node.parentNode !== root &&
    !TABLE_PARTS.has(node.parentNode.nodeName)
  ) {
    node = node.parentNode;
  }
  return node;
}

/**
 * HTML cut after `max` characters - whatever follows goes, its elements
 * closed where they are cut, and those it would leave empty with it.
 */
export function truncateHtml(html: string, max: number) {
  const template = parseHtml(html);
  const root = template.content;
  let count = 0;

  for (const { text, shown } of shownTexts(root)) {
    if (count + shown.length <= max) {
      count += shown.length;
      continue;
    }

    // The text as it shows - so its characters are those counted
    text.data = shown;
    const cut = cutAt(shown, Math.max(max - count, 0));
    const range = root.ownerDocument.createRange();
    if (cut > 0) range.setStart(text, cut);
    else range.setStartBefore(startedBy(text, root));
    range.setEnd(root, root.childNodes.length);
    range.deleteContents();
    break;
  }

  return template.innerHTML;
}

/** The characters of plain text inserted into the editor - new lines none. */
export const countTextCharacters = (text: string) =>
  text.replace(/[\r\n]/g, "").length;

/** Plain text cut after `max` characters - new lines count none. */
export function truncateText(text: string, max: number) {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n" || text[index] === "\r") continue;
    if (count === max) return text.slice(0, cutAt(text, index));
    count += 1;
  }
  return text;
}
