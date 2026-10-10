// The inline commands of RichTextEditor that `execCommand` has none of -
// inline code and clearing the formatting - and the helpers of links.
// They work line by line: a mark never spans two blocks.
import {
  closestIn,
  indexOf,
  isBlockNode,
  isElement,
  lineOf,
  splitAt,
  unwrap,
} from "./dom";

// The formatting "Clear formatting" removes - links and line breaks stay
const FORMATTING_TAGS = new Set([
  "B",
  "CODE",
  "DEL",
  "EM",
  "FONT",
  "I",
  "INS",
  "KBD",
  "MARK",
  "S",
  "SAMP",
  "SMALL",
  "SPAN",
  "STRIKE",
  "STRONG",
  "SUB",
  "SUP",
  "TT",
  "U",
]);

/** A part of a selection within one line. */
interface Segment {
  end: [Node, number];
  line: HTMLElement;
  start: [Node, number];
}

/** The text nodes the selection has text of. */
function selectedTexts(editor: HTMLElement, range: Range) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!range.intersectsNode(text)) continue;

    const start = text === range.startContainer ? range.startOffset : 0;
    const end = text === range.endContainer ? range.endOffset : text.length;
    if (end > start) texts.push(text);
  }
  return texts;
}

/** The parts of a selection in the lines it spans. */
function segmentsOf(editor: HTMLElement, range: Range): Segment[] {
  const segments: Segment[] = [];

  for (const text of selectedTexts(editor, range)) {
    const line = lineOf(editor, text);
    const start: [Node, number] = [
      text,
      text === range.startContainer ? range.startOffset : 0,
    ];
    const end: [Node, number] = [
      text,
      text === range.endContainer ? range.endOffset : text.length,
    ];

    const last = segments.at(-1);
    if (last?.line === line) last.end = end;
    else segments.push({ end, line, start });
  }
  return segments;
}

/**
 * Whether every text of the selection is in one of `tags` - leaving out the
 * texts in the elements of `ignored` (headings, bold anyway).
 */
export function isAllIn(
  editor: HTMLElement,
  range: Range,
  tags: string,
  ignored?: string,
) {
  const texts = selectedTexts(editor, range).filter(
    (text) => !ignored || !closestIn(editor, text, ignored),
  );
  return (
    texts.length > 0 && texts.every((text) => !!closestIn(editor, text, tags))
  );
}

/**
 * Where the selected text outside of the elements of `selector` starts -
 * for a selection that starts in one of them and has text after it. `null`
 * for any other.
 */
export function startOutside(
  editor: HTMLElement,
  range: Range,
  selector: string,
): [Node, number] | null {
  if (!closestIn(editor, range.startContainer, selector)) return null;

  const text = selectedTexts(editor, range).find(
    (node) => !closestIn(editor, node, selector),
  );
  // The start is in an element of `selector` - the text found is after it
  return text ? [text, 0] : null;
}

/**
 * Changes the selected content of each line - `change` gets the nodes
 * between the split points (children of the line) and returns the nodes
 * that are there then. The selection goes around the changed content.
 */
function changeSegments(
  editor: HTMLElement,
  range: Range,
  change: (line: HTMLElement, nodes: Node[]) => Node[],
): Range | null {
  const segments = segmentsOf(editor, range);
  if (segments.length === 0) return null;

  let first: Node | null = null;
  let last: Node | null = null;

  // From the last one - splitting a line leaves the points before it be
  for (const { end, line, start } of segments.reverse()) {
    const endIndex = splitAt(line, ...end);
    const before = line.childNodes.length;
    const startIndex = splitAt(line, ...start);
    const nodes = Array.from(line.childNodes).slice(
      startIndex,
      endIndex + line.childNodes.length - before,
    );
    if (nodes.length === 0) continue;

    const changed = change(line, nodes);
    first = changed[0] ?? first;
    last ??= changed.at(-1) ?? null;
  }

  if (!first || !last) return null;
  const result = document.createRange();
  result.setStartBefore(first);
  result.setEndAfter(last);
  return result;
}

/** Unwraps the elements of `tags` in `nodes` - returns the nodes then. */
function unwrapIn(nodes: Node[], tags: ReadonlySet<string>): Node[] {
  return nodes.flatMap((node) => {
    if (!isElement(node)) return [node];

    for (const inner of Array.from(node.querySelectorAll("*")).reverse()) {
      if (tags.has(inner.tagName)) unwrap(inner);
    }
    if (!tags.has(node.tagName)) return [node];

    const children = Array.from(node.childNodes);
    unwrap(node);
    return children;
  });
}

/** Joins an element with the elements of its tag right next to it. */
function joinSiblings(element: Element) {
  const { tagName } = element;
  const previous = element.previousSibling;
  if (isElement(previous) && previous.tagName === tagName) {
    previous.append(...Array.from(element.childNodes));
    element.remove();
    element = previous;
  }
  const next = element.nextSibling;
  if (isElement(next) && next.tagName === tagName) {
    element.append(...Array.from(next.childNodes));
    next.remove();
  }
  return element;
}

/**
 * Wraps the selected text in `tag` - or unwraps it, when all of it is in
 * one. Returns the selection around the changed text.
 */
function toggleMark(editor: HTMLElement, range: Range, tag: "code" | "u") {
  const removes = isAllIn(editor, range, tag);
  const tags = new Set([tag.toUpperCase()]);

  return changeSegments(editor, range, (line, nodes) => {
    const plain = unwrapIn(nodes, tags);
    if (removes || plain.length === 0) return plain;

    const mark = line.ownerDocument.createElement(tag);
    line.insertBefore(mark, plain[0]);
    mark.append(...plain);
    // A run of a mark is one element - the background of code is not
    // broken up
    return [joinSiblings(mark)];
  });
}

/**
 * Makes the selected text inline code - or plain text again, when all of
 * it is code. Returns the selection around the changed text.
 */
export const toggleCode = (editor: HTMLElement, range: Range) =>
  toggleMark(editor, range, "code");

/**
 * Underlines the selected text - or removes its underline, when all of it
 * is underlined. For a selection with links: the browser takes a link for
 * underlined by its style and does nothing, its `<u>` is what counts.
 */
export const toggleUnderline = (editor: HTMLElement, range: Range) =>
  toggleMark(editor, range, "u");

/**
 * Removes bold, italic, underline, strikethrough, code and the styles other
 * editors leave from the selected text - links stay.
 */
export function clearFormatting(editor: HTMLElement, range: Range) {
  return changeSegments(editor, range, (_, nodes) =>
    unwrapIn(nodes, FORMATTING_TAGS),
  );
}

// Whitespace the browser collapses - not the no-break space
const COLLAPSIBLE = /[\t\n\f\r ]/;

/**
 * The character of the line right before (or after) a node - `""` at an
 * edge of the line or a line break, any letter for an image.
 */
function charBeside(editor: HTMLElement, node: Node, forward: boolean) {
  const walker = document.createTreeWalker(
    lineOf(editor, node),
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  walker.currentNode = node;

  for (
    let next = forward ? walker.nextNode() : walker.previousNode();
    next;
    next = forward ? walker.nextNode() : walker.previousNode()
  ) {
    if (next.nodeType === Node.TEXT_NODE) {
      const { data } = next as Text;
      if (data) return forward ? data[0] : data.at(-1);
    } else if (next.nodeName === "BR" || isBlockNode(next)) {
      return "";
    } else if (next.nodeName === "IMG") {
      return "x";
    }
  }
  return "";
}

/**
 * Makes the spaces of inserted text no-break ones where they would collapse
 * - at an edge of the line, next to another space - as the browser types
 * them. A plain space at the end of the line shows nothing, and the caret
 * after it falls back into the code before it.
 */
function keepSpaces(editor: HTMLElement, text: Text) {
  let data = text.data.replace(/ {2}/g, " \u00a0");
  if (
    data.startsWith(" ") &&
    COLLAPSIBLE.test(charBeside(editor, text, false) || " ")
  ) {
    data = `\u00a0${data.slice(1)}`;
  }
  if (
    data.endsWith(" ") &&
    COLLAPSIBLE.test(charBeside(editor, text, true) || " ")
  ) {
    data = `${data.slice(0, -1)}\u00a0`;
  }
  if (data !== text.data) text.data = data;
}

/**
 * Puts typed text into (or out of) inline code at a caret: in, a code
 * element of the text; out of the code the caret is in, the code is split
 * there and the text goes between - its spaces that would collapse are
 * no-break ones. Returns the text node.
 */
export function insertTextWithCode(
  editor: HTMLElement,
  range: Range,
  text: string,
  inCode: boolean,
) {
  const doc = editor.ownerDocument;
  const node = doc.createTextNode(text);
  const code = closestIn(editor, range.startContainer, "code");

  if (inCode) {
    const element = doc.createElement("code");
    element.append(node);
    range.insertNode(element);
  } else if (code?.parentNode) {
    const parent = code.parentNode;
    const index = splitAt(parent, range.startContainer, range.startOffset);
    parent.insertBefore(node, parent.childNodes[index] ?? null);
    // A split at an edge of the code leaves an empty code element there
    for (const sibling of [node.previousSibling, node.nextSibling]) {
      if (
        isElement(sibling) &&
        sibling.tagName === "CODE" &&
        !sibling.textContent
      ) {
        sibling.remove();
      }
    }
  } else {
    range.insertNode(node);
  }

  // Inserting at the end of a text node leaves an empty one behind it
  const inserted = inCode ? (node.parentNode as Node) : node;
  if (
    inserted.nextSibling?.nodeType === Node.TEXT_NODE &&
    !inserted.nextSibling.textContent
  ) {
    inserted.nextSibling.remove();
  }

  // The line break that held an empty line open is no longer needed
  const next = inserted.nextSibling;
  if (
    next?.nodeName === "BR" &&
    !next.nextSibling &&
    inserted.previousSibling?.nodeName !== "BR"
  ) {
    next.remove();
  }

  keepSpaces(editor, node);
  return node;
}

/** Whether the selection is in a link or has text of one. */
export function hasLink(editor: HTMLElement, range: Range) {
  return range.collapsed
    ? !!closestIn(editor, range.startContainer, "a")
    : selectedTexts(editor, range).some((text) => closestIn(editor, text, "a"));
}

/** The link the selection is in - `null` when it spans more or none. */
export function linkAt(editor: HTMLElement, range: Range) {
  const start = closestIn(editor, range.startContainer, "a");
  const end = closestIn(editor, range.endContainer, "a");
  return start && start === end ? (start as HTMLAnchorElement) : null;
}

/** Removes a link, keeping its text - returns the selection around it. */
export function removeLink(link: HTMLAnchorElement) {
  const children = Array.from(link.childNodes);
  const parent = link.parentNode;
  if (!parent || children.length === 0) {
    link.remove();
    return null;
  }

  const index = indexOf(link);
  unwrap(link);

  const range = document.createRange();
  range.setStart(parent, index);
  range.setEnd(parent, index + children.length);
  return range;
}
