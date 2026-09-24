import { afterEach, describe, expect, it } from "vitest";
import { splitAt } from "./dom";
import {
  clearFormatting,
  insertTextWithCode,
  isAllIn,
  linkAt,
  removeLink,
  toggleCode,
} from "./inline";

afterEach(() => {
  document.body.innerHTML = "";
});

function createEditor(html: string) {
  const editor = document.createElement("div");
  editor.innerHTML = html;
  document.body.append(editor);
  return editor;
}

function textNode(editor: HTMLElement, text: string) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.includes(text)) return node as Text;
  }
  throw new Error(`No text "${text}"`);
}

/** A range over `text` - from its start to its end (within one node). */
function rangeOver(editor: HTMLElement, from: string, to = from) {
  const start = textNode(editor, from);
  const end = textNode(editor, to);
  const range = document.createRange();
  range.setStart(start, start.data.indexOf(from));
  range.setEnd(end, end.data.indexOf(to) + to.length);
  return range;
}

describe("splitAt", () => {
  it("splits the inline elements around a point up to the line", () => {
    const editor = createEditor("<p>a<b>bc<i>de</i></b>f</p>");
    const line = editor.firstChild as HTMLElement;

    const index = splitAt(line, textNode(editor, "de"), 1);
    expect(line.innerHTML).toBe("a<b>bc<i>d</i></b><b><i>e</i></b>f");
    expect(index).toBe(2);

    // At an edge nothing is split
    expect(splitAt(line, textNode(editor, "a"), 0)).toBe(0);
    expect(line.childNodes).toHaveLength(4);
  });
});

describe("toggleCode", () => {
  it("makes the selected text code, and plain again", () => {
    const editor = createEditor("<p>Run npm test now</p>");

    const range = toggleCode(editor, rangeOver(editor, "npm test"));
    expect(editor.innerHTML).toBe("<p>Run <code>npm test</code> now</p>");
    expect(range?.toString()).toBe("npm test");

    toggleCode(editor, rangeOver(editor, "npm test"));
    expect(editor.innerHTML).toBe("<p>Run npm test now</p>");
  });

  it("marks each line on its own and joins code next to it", () => {
    const editor = createEditor(
      "<p>ab <code>cd</code></p><ul><li>ef</li></ul>",
    );

    toggleCode(editor, rangeOver(editor, "ab", "ef"));
    expect(editor.innerHTML).toBe(
      "<p><code>ab cd</code></p><ul><li><code>ef</code></li></ul>",
    );
    expect(isAllIn(editor, rangeOver(editor, "ab", "ef"), "code")).toBe(true);
  });

  it("takes formatting across element boundaries into the code", () => {
    const editor = createEditor("<p>a<b>bold</b>c</p>");

    toggleCode(editor, rangeOver(editor, "ol", "c"));
    expect(editor.innerHTML).toBe("<p>a<b>b</b><code><b>old</b>c</code></p>");
  });
});

describe("insertTextWithCode", () => {
  it("types into new code, or out of the code at the caret", () => {
    const editor = createEditor("<p>ab<br></p>");
    const range = document.createRange();
    range.setStart(textNode(editor, "ab"), 2);

    insertTextWithCode(editor, range, "x", true);
    expect(editor.innerHTML).toBe("<p>ab<code>x</code></p>");

    const inCode = document.createRange();
    inCode.setStart(textNode(editor, "x"), 1);
    insertTextWithCode(editor, inCode, "y", false);
    expect(editor.innerHTML).toBe("<p>ab<code>x</code>y</p>");
  });

  it("splits the code for text typed in its middle", () => {
    const editor = createEditor("<p><code>abcd</code></p>");
    const range = document.createRange();
    range.setStart(textNode(editor, "abcd"), 2);

    insertTextWithCode(editor, range, " ", false);
    expect(editor.innerHTML).toBe("<p><code>ab</code> <code>cd</code></p>");
  });
});

describe("clearFormatting", () => {
  it("removes the marks of the selected text, keeping links", () => {
    const editor = createEditor(
      '<p><b>bold <i>both</i></b> <u>under</u> <a href="/x"><s>link</s></a> <span style="color:red">red</span></p>',
    );

    const range = clearFormatting(editor, rangeOver(editor, "both", "red"));
    expect(editor.innerHTML).toBe(
      '<p><b>bold </b>both under <a href="/x">link</a> red</p>',
    );
    expect(range?.toString()).toBe("both under link red");
  });

  it("does nothing without selected text", () => {
    const editor = createEditor("<p><b>bold</b></p>");
    const range = document.createRange();
    range.setStart(textNode(editor, "bold"), 2);

    expect(clearFormatting(editor, range)).toBeNull();
    expect(editor.innerHTML).toBe("<p><b>bold</b></p>");
  });
});

describe("links", () => {
  it("finds the link of the selection and removes it", () => {
    const editor = createEditor(
      '<p>See <a href="/docs">the <b>docs</b></a>.</p>',
    );

    const caret = document.createRange();
    caret.setStart(textNode(editor, "docs"), 1);
    const link = linkAt(editor, caret) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/docs");

    // A selection out of the link is not in it
    expect(linkAt(editor, rangeOver(editor, "See", "docs"))).toBeNull();

    const range = removeLink(link);
    expect(editor.innerHTML).toBe("<p>See the <b>docs</b>.</p>");
    expect(range?.toString()).toBe("the docs");
  });
});
