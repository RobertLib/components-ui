import { afterEach, describe, expect, it } from "vitest";
import {
  applyLineCommand,
  getBlockState,
  isInEmptyItem,
  setLineType,
  shiftLevels,
  toggleList,
  type Line,
} from "./blocks";

afterEach(() => {
  document.body.innerHTML = "";
});

function createEditor(html: string) {
  const editor = document.createElement("div");
  editor.innerHTML = html;
  document.body.append(editor);
  return editor;
}

/** The text node of `editor` that holds `text`. */
function textNode(editor: HTMLElement, text: string) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.includes(text)) return node as Text;
  }
  throw new Error(`No text "${text}"`);
}

/** Selects from `from` to the end of `to` - a caret in `from` without it. */
function selectText(editor: HTMLElement, from: string, to?: string) {
  const start = textNode(editor, from);
  const range = document.createRange();
  range.setStart(start, start.data.indexOf(from));

  if (to === undefined) {
    range.collapse(true);
  } else {
    const end = textNode(editor, to);
    range.setEnd(end, end.data.indexOf(to) + to.length);
  }

  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  return range;
}

const run = (
  editor: HTMLElement,
  range: Range,
  transform: (lines: Line[]) => boolean,
) => applyLineCommand(editor, range, transform);

const selection = () => document.getSelection()?.getRangeAt(0) as Range;

describe("block types", () => {
  it("makes a paragraph a heading and back, keeping the caret", () => {
    const editor = createEditor("<p>Hello</p><p>World</p>");
    const text = textNode(editor, "Hello");

    expect(
      run(editor, selectText(editor, "Hello"), (lines) =>
        setLineType(lines, "h2"),
      ),
    ).toBe(true);
    expect(editor.innerHTML).toBe("<h2>Hello</h2><p>World</p>");
    expect(selection().startContainer).toBe(text);

    run(editor, selection(), (lines) => setLineType(lines, "h2"));
    expect(editor.innerHTML).toBe("<p>Hello</p><p>World</p>");

    run(editor, selection(), (lines) => setLineType(lines, "h3"));
    expect(editor.innerHTML).toBe("<h3>Hello</h3><p>World</p>");
  });

  it("changes nothing for a paragraph made a paragraph", () => {
    const editor = createEditor("<p>Hello</p>");
    expect(
      run(editor, selectText(editor, "Hello"), (lines) =>
        setLineType(lines, "p"),
      ),
    ).toBe(false);
  });

  it("wraps the line of text right in the editor, up to a line break", () => {
    const editor = createEditor("Hello<br>World<b>!</b>");

    run(editor, selectText(editor, "World"), (lines) =>
      setLineType(lines, "h2"),
    );
    expect(editor.innerHTML).toBe("Hello<br><h2>World<b>!</b></h2>");
  });

  it("quotes the selected paragraphs together, and splits a quote", () => {
    const editor = createEditor("<p>A</p><p>B</p><p>C</p>");

    run(editor, selectText(editor, "A", "C"), (lines) =>
      setLineType(lines, "quote"),
    );
    expect(editor.innerHTML).toBe(
      "<blockquote><p>A</p><p>B</p><p>C</p></blockquote>",
    );

    run(editor, selectText(editor, "B"), (lines) =>
      setLineType(lines, "quote"),
    );
    expect(editor.innerHTML).toBe(
      "<blockquote><p>A</p></blockquote><p>B</p><blockquote><p>C</p></blockquote>",
    );

    // Quoted again, the line joins the quotes next to it
    run(editor, selectText(editor, "B"), (lines) =>
      setLineType(lines, "quote"),
    );
    expect(editor.innerHTML).toBe(
      "<blockquote><p>A</p><p>B</p><p>C</p></blockquote>",
    );
  });

  it("makes text right in a quote its paragraphs", () => {
    const editor = createEditor("<blockquote>One<br>Two</blockquote>");

    run(editor, selectText(editor, "Two"), (lines) => setLineType(lines, "p"));
    expect(editor.innerHTML).toBe(
      "<blockquote><p>One</p></blockquote><p>Two</p>",
    );
  });

  it("leaves out a line the selection only touches", () => {
    const editor = createEditor("<p>First</p><p>Second</p>");
    // A triple click selects up to the start of the next paragraph
    const range = document.createRange();
    range.setStart(textNode(editor, "First"), 0);
    range.setEnd(textNode(editor, "Second"), 0);

    run(editor, range, (lines) => setLineType(lines, "h2"));
    expect(editor.innerHTML).toBe("<h2>First</h2><p>Second</p>");
  });

  it("leaves tables and rules as they are", () => {
    const editor = createEditor(
      "<p>A</p><table><tbody><tr><td>x</td></tr></tbody></table><hr><p>B</p>",
    );

    run(editor, selectText(editor, "A", "B"), (lines) =>
      setLineType(lines, "h3"),
    );
    expect(editor.innerHTML).toBe(
      "<h3>A</h3><table><tbody><tr><td>x</td></tr></tbody></table><hr><h3>B</h3>",
    );
  });
});

describe("lists", () => {
  it("makes paragraphs items, of the other kind, and paragraphs again", () => {
    const editor = createEditor("<p>A</p><p>B</p>");

    run(editor, selectText(editor, "A", "B"), (lines) =>
      toggleList(lines, "ul"),
    );
    expect(editor.innerHTML).toBe("<ul><li>A</li><li>B</li></ul>");

    run(editor, selectText(editor, "A", "B"), (lines) =>
      toggleList(lines, "ol"),
    );
    expect(editor.innerHTML).toBe("<ol><li>A</li><li>B</li></ol>");

    run(editor, selectText(editor, "A", "B"), (lines) =>
      toggleList(lines, "ol"),
    );
    expect(editor.innerHTML).toBe("<p>A</p><p>B</p>");
  });

  it("joins new items to the list next to them", () => {
    const editor = createEditor(
      "<ul><li>A</li></ul>\n<p>B</p><ul><li>C</li></ul>",
    );

    run(editor, selectText(editor, "B"), (lines) => toggleList(lines, "ul"));
    expect(editor.innerHTML).toBe("<ul><li>A</li><li>B</li><li>C</li></ul>");
  });

  it("takes an item out of a list as a heading", () => {
    const editor = createEditor("<ul><li>A</li><li>B</li><li>C</li></ul>");

    run(editor, selectText(editor, "B"), (lines) => setLineType(lines, "h2"));
    expect(editor.innerHTML).toBe(
      "<ul><li>A</li></ul><h2>B</h2><ul><li>C</li></ul>",
    );
  });

  it("keeps an empty line editable, with the caret in it", () => {
    const editor = createEditor("<p><br></p>");
    const range = document.createRange();
    range.setStart(editor.firstChild as Node, 0);

    run(editor, range, (lines) => toggleList(lines, "ul"));
    expect(editor.innerHTML).toBe("<ul><li><br></li></ul>");
    expect(selection().startContainer).toBe(editor.querySelector("li"));
  });

  it("makes the blocks of an item its lines", () => {
    const editor = createEditor("<ul><li><p>A</p><p>B</p></li></ul>");

    run(editor, selectText(editor, "A"), (lines) => toggleList(lines, "ol"));
    expect(editor.innerHTML).toBe("<ol><li>A<br>B</li></ol>");
  });
});

describe("indentation", () => {
  it("nests an item in the item before it", () => {
    const editor = createEditor("<ul><li>A</li><li>B</li><li>C</li></ul>");
    const text = textNode(editor, "B");

    run(editor, selectText(editor, "B"), (lines) => shiftLevels(lines, 1));
    expect(editor.innerHTML).toBe(
      "<ul><li>A<ul><li>B</li></ul></li><li>C</li></ul>",
    );
    expect(selection().startContainer).toBe(text);
  });

  it("does not indent the first item of a list", () => {
    const editor = createEditor("<ul><li>A</li><li>B</li></ul>");
    const range = selectText(editor, "A");

    expect(run(editor, range, (lines) => shiftLevels(lines, 1))).toBe(false);
    expect(getBlockState(editor, range).canIndent).toBe(false);
    expect(getBlockState(editor, selectText(editor, "B")).canIndent).toBe(true);
  });

  it("moves the nested items with their item", () => {
    const editor = createEditor(
      "<ul><li>A</li><li>B<ul><li>C</li></ul></li></ul>",
    );

    run(editor, selectText(editor, "B"), (lines) => shiftLevels(lines, 1));
    expect(editor.innerHTML).toBe(
      "<ul><li>A<ul><li>B<ul><li>C</li></ul></li></ul></li></ul>",
    );
  });

  it("nests the items after an outdented one in it", () => {
    const editor = createEditor(
      "<ul><li>A<ul><li>B</li><li>C</li><li>D</li></ul></li></ul>",
    );

    run(editor, selectText(editor, "C"), (lines) => shiftLevels(lines, -1));
    expect(editor.innerHTML).toBe(
      "<ul><li>A<ul><li>B</li></ul></li><li>C<ul><li>D</li></ul></li></ul>",
    );
  });

  it("makes an item of the top level a paragraph", () => {
    const editor = createEditor(
      "<ol><li>A</li><li>B<ol><li>B1</li></ol></li><li>C</li></ol>",
    );

    run(editor, selectText(editor, "B"), (lines) => shiftLevels(lines, -1));
    expect(editor.innerHTML).toBe(
      "<ol><li>A</li></ol><p>B</p><ol><li>B1</li><li>C</li></ol>",
    );
  });

  it("reads a list right in a list as nested", () => {
    // Chrome indents so
    const editor = createEditor("<ul><li>A</li><ul><li>B</li></ul></ul>");

    expect(getBlockState(editor, selectText(editor, "B")).nested).toBe(true);
    run(editor, selectText(editor, "B"), (lines) => shiftLevels(lines, -1));
    expect(editor.innerHTML).toBe("<ul><li>A</li><li>B</li></ul>");
  });
});

describe("getBlockState", () => {
  it("tells the type of the selected lines", () => {
    const editor = createEditor(
      "<h2>T</h2><p>P</p><blockquote><p>Q</p></blockquote><ul><li>U</li></ul>" +
        "<table><tbody><tr><td>cell</td></tr></tbody></table>",
    );

    expect(getBlockState(editor, selectText(editor, "T")).type).toBe("h2");
    expect(getBlockState(editor, selectText(editor, "Q")).type).toBe("quote");
    expect(getBlockState(editor, selectText(editor, "U"))).toEqual({
      canIndent: false,
      canOutdent: true,
      hasLines: true,
      nested: false,
      type: "ul",
    });
    // Mixed
    expect(getBlockState(editor, selectText(editor, "T", "P")).type).toBeNull();
    // In a table there are no lines
    expect(getBlockState(editor, selectText(editor, "cell")).hasLines).toBe(
      false,
    );
    // Reading changes nothing
    expect(editor.querySelectorAll("p")).toHaveLength(2);
  });
});

describe("isInEmptyItem", () => {
  it("tells an item without text", () => {
    const editor = createEditor(
      "<ul><li>A</li><li><br></li><li>B<ul><li>C</li></ul></li></ul>",
    );
    const [, empty, withNested] = Array.from(editor.querySelectorAll("li"));

    expect(isInEmptyItem(editor, empty)).toBe(true);
    expect(isInEmptyItem(editor, textNode(editor, "A"))).toBe(false);
    expect(isInEmptyItem(editor, withNested)).toBe(false);
    expect(isInEmptyItem(editor, editor)).toBe(false);
  });
});
