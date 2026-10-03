// The code blocks of RichTextEditor - `<pre><code>` of plain text, whose
// lines are separated by line breaks. Enter breaks a line there; on the
// empty last line, it leaves the block.
import { createEmptyParagraph, indexOf, placeCaret } from "./dom";
import { isAtEdgeOf } from "./tables";

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
