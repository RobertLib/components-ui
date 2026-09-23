import { describe, expect, it } from "vitest";
import sanitizeRichText, { sanitizeInlineHtml } from "./sanitize-rich-text";

describe("sanitizeRichText", () => {
  it("keeps the editor's formatting and drops everything else", () => {
    expect(
      sanitizeRichText(
        '<p class="x" onclick="steal()">Hi <b>bold</b> <u>under</u>' +
          '<a href="javascript:steal()">bad</a> <a href="/ok">ok</a></p>' +
          "<script>steal()</script><img src=x onerror=steal()>",
      ),
    ).toBe('<p>Hi <b>bold</b> under<a>bad</a> <a href="/ok">ok</a></p>');
  });

  it("removes SVG and MathML together with their content", () => {
    expect(
      sanitizeRichText(
        "<p>Text</p><svg><style>.a{fill:red}</style><title>Icon</title>" +
          '<a href="https://example.com">x</a></svg><math><mi>x</mi></math>',
      ),
    ).toBe("<p>Text</p>");
  });

  it("drops raw text elements whose content would come back as markup", () => {
    expect(
      sanitizeRichText(
        '<p>a</p><noscript><p title="</noscript><img src=x onerror=steal()>"></noscript>' +
          "<noembed><img src=x onerror=steal()></noembed>" +
          "<xmp><img src=x onerror=steal()></xmp>" +
          "<noframes><img src=x onerror=steal()></noframes>",
      ),
    ).toBe("<p>a</p>");
  });

  it("keeps the content of a textarea as text only", () => {
    expect(
      sanitizeRichText("<textarea><img src=x onerror=steal()></textarea>"),
    ).toBe("&lt;img src=x onerror=steal()&gt;");
  });

  it("removes links whose scheme is hidden behind entities", () => {
    expect(
      sanitizeRichText(
        '<a href="&#106;avascript:steal()">a</a>' +
          '<a href="javascript&colon;steal()">b</a>' +
          '<a href="&#x6A;&#x61;vascript:steal()">c</a>' +
          '<a href=" &#14; javascript:steal()">d</a>' +
          '<a href="data:text/html,<script>steal()</script>">e</a>' +
          '<a href="mailto:a@example.com">f</a>',
      ),
    ).toBe(
      '<a>a</a><a>b</a><a>c</a><a>d</a><a>e</a><a href="mailto:a@example.com">f</a>',
    );
  });

  it("strips handlers, styles, ids and names", () => {
    expect(
      sanitizeRichText(
        '<p id="app" name="x" style="position:fixed" onmouseover="steal()" ' +
          'ONCLICK="steal()" data-x="1">Hi <a href="/ok" target="_blank" ' +
          'id="login" name="login" onfocus="steal()">ok</a></p>',
      ),
    ).toBe('<p>Hi <a href="/ok">ok</a></p>');
  });
});

describe("sanitizeInlineHtml", () => {
  it("keeps inline formatting with classes, without scripts or styles", () => {
    expect(
      sanitizeInlineHtml(
        '<span class="font-bold" style="color:red" onmouseover="steal()">Team</span>' +
          ' <small>(3)</small><div>block</div><img src=x onerror="steal()">',
      ),
    ).toBe('<span class="font-bold">Team</span> <small>(3)</small>block');
  });

  it("keeps only classes that style text in place, and none on links", () => {
    expect(
      sanitizeInlineHtml(
        '<a class="fixed inset-0 z-50 opacity-0" href="https://example.com">Win</a>' +
          '<span class="fixed inset-0 z-50 -translate-x-4 w-screen">Over</span>' +
          '<b class="text-danger-600 dark:text-danger-400 hover:underline font-bold! ' +
          'bg-[url(https://evil.example/x.png)] text-[100vh] rounded px-1">Team</b>',
      ),
    ).toBe(
      '<a href="https://example.com">Win</a><span>Over</span>' +
        '<b class="text-danger-600 dark:text-danger-400 hover:underline font-bold! rounded px-1">Team</b>',
    );
  });
});
