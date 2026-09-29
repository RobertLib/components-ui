import { describe, expect, it } from "vitest";
import {
  countCharacters,
  countHtmlCharacters,
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

  it("counts a fragment of the editor - a selection", () => {
    const editor = document.createElement("div");
    editor.innerHTML = "<p>Hello <b>world</b></p>";
    const range = document.createRange();
    range.setStart(editor.querySelector("b")?.firstChild as Node, 0);
    range.setEnd(editor.querySelector("b")?.firstChild as Node, 3);

    expect(countCharacters(editor)).toBe(11);
    expect(countCharacters(range.cloneContents())).toBe(3);
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
