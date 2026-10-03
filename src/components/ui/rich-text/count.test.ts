import { describe, expect, it } from "vitest";
import {
  countCharacters,
  countHtmlCharacters,
  countRangeCharacters,
  countTextCharacters,
  truncateHtml,
  truncateText,
} from "./count";

describe("countHtmlCharacters", () => {
  it("counts the text as it shows", () => {
    expect(countHtmlCharacters("")).toBe(0);
    expect(countHtmlCharacters("<p>Hello</p><p>world</p>")).toBe(10);
    // Source formatting between blocks and runs of whitespace
    expect(
      countHtmlCharacters("\n<ul>\n  <li>a  \n b</li>\n</ul>\n<p>c</p>"),
    ).toBe(4);
    // No-break spaces are typed spaces, line breaks and images none
    expect(
      countHtmlCharacters('<p>a&nbsp;&nbsp;b<br><img src="/a.png"></p>'),
    ).toBe(4);
    // Code keeps its whitespace
    expect(countHtmlCharacters("<pre><code>a  b</code></pre>")).toBe(4);
    // Code units, like a native field - an emoji is two
    expect(countHtmlCharacters("<p>😀</p>")).toBe(2);
  });

  it("counts a selection in the editor", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<p>Hello <b>world</b></p>";
    const range = document.createRange();
    range.setStart(editor.querySelector("b")?.firstChild as Node, 0);
    range.setEnd(editor.querySelector("b")?.firstChild as Node, 3);

    expect(countCharacters(editor)).toBe(11);
    expect(countRangeCharacters(editor, range)).toBe(3);
  });
});

describe("countRangeCharacters", () => {
  it.each([
    { html: "a b", text: "a b", start: 1, end: 2, expected: 1 },
    { html: "<p>a b</p>", text: "a b", start: 1, end: 2, expected: 1 },
    { html: "<p> </p>", text: " ", start: 0, end: 1, expected: 1 },
    {
      html: "<p>a   b</p>",
      text: "a   b",
      start: 1,
      end: 4,
      expected: 1,
    },
    {
      html: "<pre><code>a \n b</code></pre>",
      text: "a \n b",
      start: 1,
      end: 4,
      expected: 3,
    },
    {
      html: "<p>a</p>\n  <p>b</p>",
      text: "\n  ",
      start: 0,
      end: 3,
      expected: 0,
    },
    {
      html: "<ul>\n  <li>a</li></ul>",
      text: "\n  ",
      start: 0,
      end: 3,
      expected: 0,
    },
  ])(
    "keeps the whitespace context of $html",
    ({ html, text, start, end, expected }) => {
      const editor = document.createElement("div");
      editor.innerHTML = html;
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node && node.textContent !== text) node = walker.nextNode();
      const range = document.createRange();
      range.setStart(node as Text, start);
      range.setEnd(node as Text, end);

      expect(countRangeCharacters(editor, range)).toBe(expected);
      range.collapse(true);
      expect(countRangeCharacters(editor, range)).toBe(0);
    },
  );

  it("counts only the selected portions across text nodes and blocks", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<p>ab<b>cd</b>ef</p>\n<pre><code>g  h</code></pre>";
    const paragraph = editor.querySelector("p") as HTMLParagraphElement;
    const code = editor.querySelector("code") as HTMLElement;
    const range = document.createRange();
    range.setStart(paragraph.firstChild as Text, 1);
    range.setEnd(code.firstChild as Text, 3);
    expect(countRangeCharacters(editor, range)).toBe(8);

    range.setStart(paragraph, 1);
    range.setEnd(paragraph, 2);
    expect(countRangeCharacters(editor, range)).toBe(2);

    range.selectNodeContents(editor);
    expect(countRangeCharacters(editor, range)).toBe(countCharacters(editor));
  });
});

describe("truncateHtml", () => {
  it("cuts HTML after its characters, closing the elements it cuts", () => {
    expect(truncateHtml("<p>ab<b>cd</b>ef</p><p>gh</p>", 3)).toBe(
      "<p>ab<b>c</b></p>",
    );
    expect(truncateHtml("<p>abc</p><ul><li>de</li></ul>", 4)).toBe(
      "<p>abc</p><ul><li>d</li></ul>",
    );
    // Images count none - one before the cut stays
    expect(truncateHtml('<p>ab</p><p><img src="/a.png">c</p><p>d</p>', 2)).toBe(
      '<p>ab</p><p><img src="/a.png"></p>',
    );
    // Not half of an emoji
    expect(truncateHtml("<p>a😀</p>", 2)).toBe("<p>a</p>");
  });
});

describe("truncateText", () => {
  it("cuts text after its characters - new lines count none", () => {
    expect(countTextCharacters("ab\r\ncd")).toBe(4);
    expect(truncateText("ab\ncd", 3)).toBe("ab\nc");
    expect(truncateText("abc", 5)).toBe("abc");
    expect(truncateText("abc", 0)).toBe("");
    expect(truncateText("a😀b", 2)).toBe("a");
  });
});
