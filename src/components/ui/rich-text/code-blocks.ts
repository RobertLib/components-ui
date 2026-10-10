// The code blocks of RichTextEditor - `<pre><code>` of plain text, whose
// lines are separated by line breaks. Enter breaks a line there; on the
// empty last line, it leaves the block.
import { createEmptyParagraph, indexOf, placeCaret, select } from "./dom";
import { isAtEdgeOf } from "./tables";

/** A boundary point of the selection - moved as its text is split. */
interface Point {
  node: Node;
  offset: number;
}

/**
 * Splits a text at its new lines ("\r\n" is one) into lines and line breaks
 * between them. A point in it goes to the same place - into the text of its
 * line, or before the line break after an empty one.
 */
function splitLines(text: Text, points: Point[]) {
  const doc = text.ownerDocument;
  const parent = text.parentNode as Node;
  const start = indexOf(text);
  const inText = points.filter((point) => point.node === text);
  const nodes: Node[] = [];
  let lineStart = 0;

  const addLine = (end: number) => {
    const line = text.data.slice(lineStart, end);
    const node = line ? doc.createTextNode(line) : null;
    for (const point of inText) {
      if (point.node !== text || point.offset > end) continue;
      point.node = node ?? parent;
      point.offset = node ? point.offset - lineStart : start + nodes.length;
    }
    if (node) nodes.push(node);
  };

  for (const match of text.data.matchAll(/\r\n?|\n/g)) {
    addLine(match.index);
    // Within "\r\n" - after the line break
    for (const point of inText) {
      if (point.node === text && point.offset < match.index + match[0].length) {
        point.node = parent;
        point.offset = start + nodes.length + 1;
      }
    }
    nodes.push(doc.createElement("br"));
    lineStart = match.index + match[0].length;
  }
  addLine(text.data.length);

  text.replaceWith(...nodes);
}

/**
 * Makes the new lines in the text of code blocks line breaks. WebKit breaks
 * a line of preformatted text with "\n", but the lines of a code block are
 * separated by `<br>` - leaving it by Enter, the block commands and the
 * value go by them. The selection keeps its place. Returns whether there
 * were any.
 */
export function breakCodeLines(editor: HTMLElement) {
  const texts: Text[] = [];
  for (const pre of Array.from(editor.getElementsByTagName("pre"))) {
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (/[\r\n]/.test((node as Text).data)) texts.push(node as Text);
    }
  }
  if (texts.length === 0) return false;

  const selection = document.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const points: Point[] = range
    ? [
        { node: range.startContainer, offset: range.startOffset },
        { node: range.endContainer, offset: range.endOffset },
      ]
    : [];
  const split = new Set<Node>(texts);
  const moves = points.map((point) => split.has(point.node));

  // In document order - a split moves only the points after it
  for (const text of texts) splitLines(text, points);

  if (range && moves.some(Boolean)) {
    const [start, end] = points;
    const restored = document.createRange();
    // A point elsewhere is where the live range has moved it
    if (moves[0]) restored.setStart(start.node, start.offset);
    else restored.setStart(range.startContainer, range.startOffset);
    if (moves[1]) restored.setEnd(end.node, end.offset);
    else restored.setEnd(range.endContainer, range.endOffset);
    select(restored);
  }
  return true;
}

/**
 * Leaves a code block by Enter on its empty last line - the line goes, and
 * a new paragraph after the block takes the caret. Returns whether it did:
 * on a line with text, or an empty line with more after it, Enter breaks
 * the line.
 */
export function leaveCodeBlock(pre: HTMLElement, range: Range) {
  if (!range.collapsed || !isAtEdgeOf(pre, range, true)) return false;

  // The line break before the caret - the line after it has no text
  const breaks = Array.from(pre.getElementsByTagName("br")).filter(
    (br) => range.comparePoint(br.parentNode as Node, indexOf(br) + 1) <= 0,
  );
  const lineBreak = breaks.at(-1);
  if (!lineBreak) return false;

  const line = document.createRange();
  line.setStartAfter(lineBreak);
  line.setEnd(range.startContainer, range.startOffset);
  if (line.toString() !== "") return false;

  const rest = document.createRange();
  rest.setStartBefore(lineBreak);
  rest.setEnd(pre, pre.childNodes.length);
  rest.deleteContents();

  // A line break left at the end shows nothing - an empty block keeps one
  const code = pre.querySelector("code") ?? pre;
  const last = code.lastChild;
  if (
    last?.nodeName === "BR" &&
    last.previousSibling &&
    last.previousSibling.nodeName !== "BR"
  ) {
    last.remove();
  }
  if (!code.textContent && !code.querySelector("br")) {
    code.replaceChildren(document.createElement("br"));
  }

  const paragraph = createEmptyParagraph(pre.ownerDocument);
  pre.after(paragraph);
  placeCaret(paragraph);
  return true;
}
