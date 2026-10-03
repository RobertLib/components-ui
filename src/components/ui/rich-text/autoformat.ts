// The Markdown shortcuts of RichTextEditor - typed at the start of a
// paragraph, "# " makes it a heading, "- " a list item, "> " a quote, "---"
// a rule and "```" a code block; "`code`" makes inline code anywhere. Each
// only with its tool. The editor keeps the typed text as a step of its undo
// history, so one undo brings it back.
import { applyLineCommand, setLineType, toggleList, type Line } from "./blocks";
import {
  closestIn,
  indexOf,
  isEmptyLine,
  lineOf,
  placeCaret,
  select,
} from "./dom";
import { insertBlock } from "./tables";
import type { RichTextTool } from "./tools";

type BlockTool =
  "blockquote" | "bulletList" | "heading2" | "heading3" | "numberedList";

/** What a Markdown shortcut typed at the caret makes. */
export type Autoformat =
  | {
      kind: "block";
      line: HTMLElement;
      /** The typed shortcut - from the start of the line to the caret. */
      prefix: Range;
      tool: BlockTool;
    }
  | { kind: "codeBlock"; line: HTMLElement; prefix: Range }
  | { kind: "horizontalRule"; line: HTMLElement; prefix: Range }
  | {
      /** The text of the backticks - `end` is right after the closing one. */
      end: number;
      kind: "code";
      start: number;
      text: Text;
    };

// The shortcuts of a paragraph, as typed up to its space - `#` is the top
// heading of the editor, like the `<h1>` that pasted content has
const BLOCK_SHORTCUTS: [RegExp, BlockTool][] = [
  [/^#{1,2} $/, "heading2"],
  [/^### $/, "heading3"],
  [/^[-*] $/, "bulletList"],
  [/^1[.)] $/, "numberedList"],
  [/^> $/, "blockquote"],
];

const TRANSFORMS: Record<BlockTool, (lines: Line[]) => boolean> = {
  blockquote: (lines) => setLineType(lines, "quote"),
  bulletList: (lines) => toggleList(lines, "ul"),
  heading2: (lines) => setLineType(lines, "h2"),
  heading3: (lines) => setLineType(lines, "h3"),
  numberedList: (lines) => toggleList(lines, "ol"),
};

/**
 * The shortcut at a line start - the typed text of the line up to the
 * caret, which must be all text (no image or line break before it).
 */
function lineShortcut(
  editor: HTMLElement,
  range: Range,
  typed: string,
  tools: readonly RichTextTool[],
): Autoformat | null {
  // No shortcut is longer - also no need to read a long line
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType === Node.TEXT_NODE && startOffset > 4) {
    return null;
  }

  const line = lineOf(editor, startContainer);
  // A paragraph of the top level - not a heading, item, quote or cell
  const isParagraph =
    (line.tagName === "P" || line.tagName === "DIV") &&
    line.parentNode === editor;
  if (!isParagraph) return null;

  const prefix = document.createRange();
  prefix.setStart(line, 0);
  prefix.setEnd(startContainer, startOffset);
  if (prefix.cloneContents().querySelector("br, img")) return null;
  // A typed space at the end of a line is a no-break space
  const text = prefix.toString().replace(/ /g, " ");

  if (typed === " ") {
    const match = BLOCK_SHORTCUTS.find(
      ([pattern, tool]) => pattern.test(text) && tools.includes(tool),
    );
    return match ? { kind: "block", line, prefix, tool: match[1] } : null;
  }

  // The whole line - a rule has no text after it
  const after = document.createRange();
  after.setStart(startContainer, startOffset);
  after.setEnd(line, line.childNodes.length);
  if (
    typed === "-" &&
    text === "---" &&
    tools.includes("horizontalRule") &&
    !after.toString().trim()
  ) {
    return { kind: "horizontalRule", line, prefix };
  }
  if (typed === "`" && text === "```" && tools.includes("codeBlock")) {
    return { kind: "codeBlock", line, prefix };
  }
  return null;
}

/**
 * The Markdown shortcut just typed at a caret - `typed` is the character
 * the input added. `null` for none, or one whose tool is not in `tools`.
 */
export function findAutoformat(
  editor: HTMLElement,
  range: Range,
  typed: string,
  tools: readonly RichTextTool[],
): Autoformat | null {
  const node = range.startContainer;
  if (!range.collapsed || closestIn(editor, node, "code, pre")) return null;

  // A space some browsers type as a no-break one - only the last characters
  // of shortcuts can make one
  const key = typed === " " ? " " : typed;
  if (key !== " " && key !== "-" && key !== "`") return null;
  const shortcut = lineShortcut(editor, range, key, tools);
  if (shortcut) return shortcut;

  // `code` - the closing backtick typed, with text since the opening one
  if (typed !== "`" || !tools.includes("code")) return null;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const text = node as Text;
  const end = range.startOffset;
  const before = text.data.slice(0, end);
  if (!before.endsWith("`")) return null;

  const start = before.lastIndexOf("`", before.length - 2);
  const content = before.slice(start + 1, -1);
  return start >= 0 && content.trim() && before[start - 1] !== "`"
    ? { end, kind: "code", start, text }
    : null;
}

/** The text and line breaks of inline content - for a code block. */
function plainNodes(nodes: Node[], result: Node[] = []) {
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE || node.nodeName === "BR") {
      result.push(node);
    } else {
      plainNodes(Array.from(node.childNodes), result);
    }
  }
  return result;
}

/**
 * Makes what a shortcut makes - the typed shortcut goes. For inline code,
 * returns the caret after the code, where the text typed next is no code.
 */
export function applyAutoformat(
  editor: HTMLElement,
  shortcut: Autoformat,
): { node: Node; offset: number } | null {
  const doc = editor.ownerDocument;

  if (shortcut.kind === "code") {
    const { end, start, text } = shortcut;
    const after = text.splitText(end);
    const code = doc.createElement("code");
    code.textContent = text.data.slice(start + 1, end - 1);
    text.data = text.data.slice(0, start);
    text.after(code);
    if (!text.data) text.remove();
    if (!after.data) after.remove();

    const parent = code.parentNode as Node;
    const offset = indexOf(code) + 1;
    const caret = doc.createRange();
    caret.setStart(parent, offset);
    select(caret);
    return { node: parent, offset };
  }

  const { line, prefix } = shortcut;
  prefix.deleteContents();

  if (shortcut.kind === "horizontalRule") {
    const caret = placeCaret(line);
    placeCaret(insertBlock(editor, caret, doc.createElement("hr")));
  } else if (shortcut.kind === "codeBlock") {
    const pre = doc.createElement("pre");
    const code = doc.createElement("code");
    code.append(...plainNodes(Array.from(line.childNodes)));
    if (isEmptyLine(code)) code.replaceChildren(doc.createElement("br"));
    pre.append(code);
    line.replaceWith(pre);
    placeCaret(code);
  } else {
    // An emptied line keeps its height
    if (isEmptyLine(line)) line.replaceChildren(doc.createElement("br"));
    applyLineCommand(editor, placeCaret(line), TRANSFORMS[shortcut.tool]);
  }
  return null;
}
