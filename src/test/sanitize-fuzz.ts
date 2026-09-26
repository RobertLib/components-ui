// Random malformed HTML for the tests of `sanitizeRichText` - in the
// browser's DOM and on a server with only jsdom's DOMParser. Whatever comes
// in, the output holds only the allowed elements and attributes, and its
// output is the same again.
import sanitizeRichText, {
  isSafeHref,
  sanitizeEditorContent,
  sanitizeInlineHtml,
  sanitizeRichTextLines,
  sanitizeRichTextParagraphs,
  type RichTextFormat,
} from "../utils/sanitize-rich-text";

const RICH_TAGS = new Set(
  "P DIV H2 H3 UL OL LI BLOCKQUOTE TABLE THEAD TBODY TR TD TH HR BR B STRONG I EM U S CODE A".split(
    " ",
  ),
);
const INLINE_TAGS = new Set(
  "A B BR EM I MARK S SMALL SPAN STRONG SUB SUP U".split(" "),
);

const TAGS = (
  "p div b i u s a ul ol li table tr td th thead tbody tfoot caption h1 h2 " +
  "h4 blockquote hr br pre span code strong em del kbd font listing menu " +
  "col colgroup dl dt dd section form button select option textarea img " +
  "input svg math mi mtext mglyph foreignObject desc annotation-xml " +
  "template noscript style title xmp iframe object"
).split(" ");
const ATTRIBUTES = [
  "",
  ' href="https://example.com/"',
  ' href="javascript:steal()"',
  ' href=" java\tscript:steal()"',
  ' href="&#106;avascript:steal()"',
  ' href="data:text/html,x"',
  ' xlink:href="javascript:steal()"',
  ' formaction="javascript:steal()"',
  ' srcset="javascript:steal()"',
  ' src=x onerror="steal()"',
  ' onclick="steal()"',
  ' class="text-red-500 fixed"',
  ' style="font-weight:700"',
  ' style="font-style:italic"',
  ' style="text-decoration:underline"',
  ' style="font-family:monospace"',
  ' style="mso-list:l1 level1 lfo1"',
  ' style="mso-list:Ignore"',
  ' colspan="3"',
  ' rowspan="0"',
];
const TEXTS = [
  "x",
  " ",
  "\n",
  "a b",
  "&lt;img src=x onerror=steal()&gt;",
  "&amp;",
  "&nbsp;",
  "1.",
  "</p>",
  "<!--<img src=x onerror=steal()>-->",
  "<![CDATA[x]]>",
];

const EVERY_FORMAT: RichTextFormat[] = [
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
const FORMATS: (RichTextFormat[] | undefined)[] = [
  undefined,
  ["bold", "italic", "link"],
  ["bulletList", "link", "bold"],
  ["table", "code", "link"],
  ["heading3", "blockquote", "underline", "strikethrough"],
  [],
];

/** A random number generator of a seed - the same HTML for the same seed. */
function random(seed: number) {
  let state = seed;
  return (count: number) => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return Math.floor((state / 0x7fffffff) * count);
  };
}

function randomHtml(pick: (count: number) => number, depth = 0): string {
  let html = "";
  for (let index = pick(4); index > 0; index -= 1) {
    if (depth > 6 || pick(10) < 3) {
      html += TEXTS[pick(TEXTS.length)];
      continue;
    }
    const tag = TAGS[pick(TAGS.length)];
    html += `<${tag}${ATTRIBUTES[pick(ATTRIBUTES.length)]}>`;
    html += randomHtml(pick, depth + 1);
    // Some are left open
    if (pick(10) < 8) html += `</${tag}>`;
  }
  return html;
}

/** Why the output is unsafe - `null` when it is not. */
function unsafeMarkup(
  html: string,
  tags: ReadonlySet<string>,
  attributes: ReadonlySet<string>,
) {
  const { body } = new DOMParser().parseFromString(
    `<!DOCTYPE html><body>${html}`,
    "text/html",
  );
  for (const element of Array.from(body.getElementsByTagName("*"))) {
    if (!tags.has(element.tagName)) return `<${element.tagName}>`;
    for (const { name, value } of Array.from(element.attributes)) {
      const isSafeLink =
        element.tagName === "A" && name === "href" && isSafeHref(value);
      if (!isSafeLink && !attributes.has(name)) return `${name}="${value}"`;
    }
  }
  return null;
}

/**
 * Sanitizes the random HTML of `seeds` seeds in every way - the problems
 * found, empty when there are none.
 */
export function fuzzSanitizer(seeds: number) {
  const problems: string[] = [];
  const noAttributes = new Set<string>();

  for (let seed = 1; seed <= seeds; seed += 1) {
    const html = randomHtml(random(seed));
    const formats = FORMATS[seed % FORMATS.length];
    const sanitizers: [string, (input: string) => string, Set<string>][] = [
      ["flow", (input) => sanitizeRichText(input, { formats }), RICH_TAGS],
      ["lines", (input) => sanitizeRichTextLines(input, formats), RICH_TAGS],
      [
        "paragraphs",
        (input) => sanitizeRichTextParagraphs(input, formats),
        RICH_TAGS,
      ],
      [
        "editor",
        (input) => sanitizeEditorContent(input, formats ?? EVERY_FORMAT).html,
        RICH_TAGS,
      ],
      ["inline", sanitizeInlineHtml, INLINE_TAGS],
    ];

    for (const [name, sanitize, tags] of sanitizers) {
      const once = sanitize(html);
      const unsafe = unsafeMarkup(
        once,
        tags,
        name === "inline" ? new Set(["class"]) : noAttributes,
      );
      if (unsafe) problems.push(`${name} of ${html} keeps ${unsafe}`);
      if (sanitize(once) !== once) {
        problems.push(`${name} of ${html} changes again: ${once}`);
      }
    }
  }
  return problems;
}
