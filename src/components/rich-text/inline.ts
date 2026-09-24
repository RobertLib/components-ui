// The inline commands of RichTextEditor that `execCommand` has none of -
// inline code and clearing the formatting - and the helpers of links.
// They work line by line: a mark never spans two blocks.
import { closestIn, indexOf, isElement, lineOf, splitAt, unwrap } from "./dom";

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

/** Whether every text of the selection is in one of `tags`. */
export function isAllIn(editor: HTMLElement, range: Range, tags: string) {
  const texts = selectedTexts(editor, range);
  return (
    texts.length > 0 && texts.every((text) => !!closestIn(editor, text, tags))
  );
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

const CODE = new Set(["CODE"]);

/** Joins a code element with the code elements right next to it. */
function joinCode(code: Element) {
  const previous = code.previousSibling;
  if (isElement(previous) && previous.tagName === "CODE") {
    previous.append(...Array.from(code.childNodes));
    code.remove();
    code = previous;
  }
  const next = code.nextSibling;
  if (isElement(next) && next.tagName === "CODE") {
    code.append(...Array.from(next.childNodes));
    next.remove();
  }
  return code;
}

/**
 * Makes the selected text inline code - or plain text again, when all of
 * it is code. Returns the selection around the changed text.
 */
export function toggleCode(editor: HTMLElement, range: Range) {
  const removes = isAllIn(editor, range, "code");

  return changeSegments(editor, range, (line, nodes) => {
    const plain = unwrapIn(nodes, CODE);
    if (removes || plain.length === 0) return plain;

    const code = line.ownerDocument.createElement("code");
    line.insertBefore(code, plain[0]);
    code.append(...plain);
    // A run of code is one element, so its background is not broken up
    const joined = joinCode(code);
    return [joined];
  });
}

/**
 * Removes bold, italic, underline, strikethrough, code and the styles other
 * editors leave from the selected text - links stay.
 */
export function clearFormatting(editor: HTMLElement, range: Range) {
  return changeSegments(editor, range, (_, nodes) =>
    unwrapIn(nodes, FORMATTING_TAGS),
  );
}

/**
 * Puts typed text into (or out of) inline code at a caret: in, a code
 * element of the text; out of the code the caret is in, the code is split
 * there and the text goes between. Returns the text node.
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

  return node;
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
