// @vitest-environment node
// @ts-expect-error - jsdom, the DOM of the tests, comes without its types
import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";
import sanitizeRichText, { sanitizeInlineHtml } from "./sanitize-rich-text";
import { fuzzSanitizer } from "../test/sanitize-fuzz";

// A server gives the sanitizer a DOMParser - no other globals of a DOM
afterEach(() => {
  delete (globalThis as { DOMParser?: unknown }).DOMParser;
});

it("throws on a server without a DOMParser", () => {
  expect(() => sanitizeRichText("<p>Hi</p>")).toThrow();
});

it("runs on a server with only the DOMParser of jsdom", () => {
  globalThis.DOMParser = new JSDOM().window.DOMParser;
  expect(typeof Node).toBe("undefined");

  expect(
    sanitizeRichText(
      '<h1 onclick="steal()">Plan</h1><p>Hi <span style="font-weight:700">bold</span>' +
        '<a href="javascript:steal()">bad</a></p><table><tr><td colspan="2">a</td></tr>' +
        '<tr><td>b</td><td>c</td></tr></table><p style="mso-list:l0 level1 lfo1">' +
        '<span style="mso-list:Ignore">1.</span>Item</p>',
    ),
  ).toBe(
    "<h2>Plan</h2><p>Hi <b>bold</b>bad</p><table><tbody><tr><td>a</td><td></td></tr>" +
      "<tr><td>b</td><td>c</td></tr></tbody></table><ol><li>Item</li></ol>",
  );
  // Content too deep is copied as its text - by a tree walker
  expect(
    sanitizeRichText(`${"<span>".repeat(150)}deep${"</span>".repeat(150)}`),
  ).toBe("deep");
  expect(sanitizeInlineHtml('<b class="font-bold">Team</b><div>x</div>')).toBe(
    '<b class="font-bold">Team</b>x',
  );
});

it("leaves nothing behind on the window of jsdom", () => {
  // A document queried by a selector gets a selector engine of jsdom, whose
  // listeners on the window stay - a server sanitizing with one window
  // leaked them on every call, each call slower than the one before
  const { window } = new JSDOM();
  globalThis.DOMParser = window.DOMParser;
  const addEventListener = vi.spyOn(
    window.EventTarget.prototype,
    "addEventListener",
  );

  sanitizeRichText(
    '<div><p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1.</span>Item</p>' +
      "<table><tr><td>a</td></tr></table><ul><li>b</li></ul></div>",
  );
  sanitizeInlineHtml("<b>Team</b><div>x</div>");

  expect(
    addEventListener.mock.contexts.filter(
      (context: unknown) => context === window,
    ),
  ).toEqual([]);
});

it("keeps random hostile markup to the allowed elements, the same again", () => {
  globalThis.DOMParser = new JSDOM().window.DOMParser;
  expect(fuzzSanitizer(300)).toEqual([]);
});
