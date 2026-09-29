import { afterEach, describe, expect, it } from "vitest";
import { applyAutoformat, findAutoformat } from "./autoformat";
import type { RichTextTool } from "./tools";

afterEach(() => {
  document.body.innerHTML = "";
});

const TOOLS: RichTextTool[] = [
  "blockquote",
  "bulletList",
  "code",
  "codeBlock",
  "heading2",
  "heading3",
  "horizontalRule",
  "numberedList",
];

/** An editor with a caret after the `|` of its HTML - the `|` goes. */
function editorWithCaret(html: string) {
  const editor = document.createElement("div");
  editor.innerHTML = html;
  document.body.append(editor);

  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const offset = text.data.indexOf("|");
    if (offset === -1) continue;

    text.deleteData(offset, 1);
    const range = document.createRange();
    range.setStart(text, offset);
    return { editor, range };
  }
  throw new Error("No caret");
}

/** What typing the last character before the caret makes - `null` for nothing. */
function format(html: string, tools = TOOLS) {
  const { editor, range } = editorWithCaret(html);
  const typed = range.startContainer.textContent?.[range.startOffset - 1];
  const shortcut = findAutoformat(editor, range, typed ?? "", tools);
  if (!shortcut) return null;

  applyAutoformat(editor, shortcut);
  return editor.innerHTML;
}

describe("findAutoformat", () => {
  it("formats paragraphs of the top level by their start", () => {
    expect(format("<p>1) |Step</p>")).toBe("<ol><li>Step</li></ol>");
    expect(format("<p>#&nbsp;|</p>")).toBe("<h2><br></h2>");
    // Not in the middle of a line, nor after a line break
    expect(format("<p>a # |b</p>")).toBeNull();
    expect(format("<p>a<br># |b</p>")).toBeNull();
    // Not more than three levels, nor other numbers
    expect(format("<p>#### |</p>")).toBeNull();
    expect(format("<p>2. |</p>")).toBeNull();
    // Only in paragraphs of the top level
    expect(format("<blockquote><p>- |a</p></blockquote>")).toBeNull();
    expect(
      format("<table><tbody><tr><td>- |a</td></tr></tbody></table>"),
    ).toBeNull();
  });

  it("makes a rule only of a whole line of ---", () => {
    expect(format("<p>---|</p><p>b</p>")).toBe("<hr><p><br></p><p>b</p>");
    expect(format("<p>---|a</p>")).toBeNull();
    expect(format("<p>---|</p>", ["bulletList"])).toBeNull();
  });

  it("makes a code block of ``` with the rest of its line", () => {
    expect(format("<p>```|npm <b>test</b></p>")).toBe(
      "<pre><code>npm test</code></pre>",
    );
  });

  it("makes inline code of text between backticks", () => {
    expect(format("<p>a `b c`|</p>")).toBe("<p>a <code>b c</code></p>");
    // Not of nothing, whitespace or a double backtick
    expect(format("<p>a ``|</p>")).toBeNull();
    expect(format("<p>a ` `|</p>")).toBeNull();
    expect(format("<p>a ``b`|</p>")).toBeNull();
    // Not in code
    expect(format("<p><code>`a`|</code></p>")).toBeNull();
    expect(format("<pre><code>`a`|</code></pre>")).toBeNull();
  });
});
