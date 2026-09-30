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

/** Whether a text node is in a code block, whose whitespace all shows. */
function isInCode(node: Node, root: Node) {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (parent.nodeName === "PRE") return true;
    if (parent === root) return false;
  }
  return false;
}

/** The text of a text node as it shows - its whitespace collapsed. */
function shownText(text: Text, root: Node, data = text.data) {
  if (isInCode(text, root)) return data;

  const parent = text.parentNode;
  const isBetweenBlocks =
    !parent || parent === root || BLOCK_CONTAINERS.has(parent.nodeName);
  if (isBetweenBlocks && BLANK.test(text.data)) return "";

  return data.replace(WHITESPACE, " ");
}

function textNodesOf(root: Node) {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, 0x4 /* SHOW_TEXT */);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    texts.push(node as Text);
  }
  return texts;
}

/** The characters of the content of a node - an element or a fragment. */
export function countCharacters(root: Node) {
  let count = 0;
  for (const text of textNodesOf(root)) count += shownText(text, root).length;
  return count;
}

/**
 * The characters of a selection in its original context. Cloning the range
 * would lose its surrounding paragraph or code block, changing how its
 * whitespace is counted.
 */
export function countRangeCharacters(root: Node, range: Range) {
  if (range.collapsed) return 0;

  let count = 0;
  for (const text of textNodesOf(root)) {
    if (!range.intersectsNode(text)) continue;
    const start = text === range.startContainer ? range.startOffset : 0;
    const end = text === range.endContainer ? range.endOffset : text.length;
    count += shownText(text, root, text.data.slice(start, end)).length;
  }
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

/**
 * HTML cut after `max` characters - whatever follows goes, its elements
 * closed where they are cut.
 */
export function truncateHtml(html: string, max: number) {
  const template = parseHtml(html);
  const root = template.content;
  let count = 0;

  for (const text of textNodesOf(root)) {
    const shown = shownText(text, root);
    if (count + shown.length <= max) {
      count += shown.length;
      continue;
    }

    // The text as it shows - so its characters are those counted
    text.data = shown;
    const range = root.ownerDocument.createRange();
    range.setStart(text, cutAt(shown, Math.max(max - count, 0)));
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
