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

  it("collapses whitespace across inline marks without combining separate lines", () => {
    expect(countHtmlCharacters("<p>a<b>x </b> y</p>")).toBe(4);
    expect(countHtmlCharacters("<p>a <b> <i> </i> </b> y</p>")).toBe(3);
    expect(countHtmlCharacters("<b>a</b> <b>b</b>")).toBe(3);
    expect(countHtmlCharacters("<p>a </p><p> b</p>")).toBe(4);
    expect(countHtmlCharacters("<p>a <br> b</p>")).toBe(4);
    expect(countHtmlCharacters('<p>a <img src="/a.png"> b</p>')).toBe(4);
    expect(countHtmlCharacters("<p>a&nbsp;<b> </b> b</p>")).toBe(4);
    expect(countHtmlCharacters("<pre><code>a <b> </b> b</code></pre>")).toBe(5);
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

  it("counts selected whitespace across inline marks once in its original line", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<p>a<b>x </b> y</p>";
    const bold = editor.querySelector("b")?.firstChild as Text;
    const after = editor.querySelector("p")?.lastChild as Text;
    const range = document.createRange();
    range.setStart(bold, 1);
    range.setEnd(after, 1);
    expect(countRangeCharacters(editor, range)).toBe(1);
    range.selectNodeContents(editor);
    expect(countRangeCharacters(editor, range)).toBe(4);
  });

  it("does not free a collapsed space when only part of its run is selected", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<p>a <b> y</b></p>";
    const first = editor.querySelector("p")?.firstChild as Text;
    const second = editor.querySelector("b")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(second, 0);
    range.setEnd(second, 1);
    expect(countRangeCharacters(editor, range)).toBe(0);
    range.setStart(first, 1);
    range.setEnd(first, 2);
    expect(countRangeCharacters(editor, range)).toBe(0);
    range.setEnd(second, 1);
    expect(countRangeCharacters(editor, range)).toBe(1);

    editor.innerHTML = "<p>a   b</p>";
    const text = editor.querySelector("p")?.firstChild as Text;
    range.setStart(text, 2);
    range.setEnd(text, 3);
    expect(countRangeCharacters(editor, range)).toBe(0);
  });
});

describe("truncateHtml", () => {
  it("keeps text that fits after collapsing whitespace across inline marks", () => {
    const html = "<p>a<b>x </b> y</p>";
    expect(truncateHtml(html, 4)).toBe(html);
    expect(truncateHtml(html, 3)).toBe("<p>a<b>x </b></p>");
    const cut = truncateHtml("<p>a <b> yZ</b></p>", 3);
    expect(cut).toBe("<p>a <b>y</b></p>");
    expect(countHtmlCharacters(cut)).toBe(3);
  });

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

  it("takes the elements a cut at their start would leave empty along", () => {
    expect(truncateHtml("<p>ab</p><ul><li>c</li><li>d</li></ul>", 3)).toBe(
      "<p>ab</p><ul><li>c</li></ul>",
    );
    expect(truncateHtml("<p>ab</p><p><b>cd</b></p>", 2)).toBe("<p>ab</p>");
    expect(truncateHtml("<p>ab <b>cd</b></p>", 3)).toBe("<p>ab </p>");
    expect(truncateHtml("<p>ab</p>", 0)).toBe("");
    // A table keeps the cells of its rows
    expect(
      truncateHtml(
        "<table><tbody><tr><td>ab</td><td>cd</td></tr></tbody></table>",
        2,
      ),
    ).toBe("<table><tbody><tr><td>ab</td><td></td></tr></tbody></table>");
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
