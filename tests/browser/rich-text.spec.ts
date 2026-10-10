import { expect, test, type Page } from "@playwright/test";

// The editing of RichTextEditor in each browser - what typing and
// `execCommand` leave differs between them, jsdom has neither

const open = (page: Page, value = "") =>
  page.goto(`/tests/browser/rich-text.html?value=${encodeURIComponent(value)}`);

const editor = (page: Page) => page.getByRole("textbox", { name: /Note/ });
const value = (page: Page) => page.getByLabel("Value");
const tool = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

/** Selects the editor's content from the text `from` to the end of `to`. */
const selectText = (page: Page, from: string, to: string) =>
  editor(page).evaluate(
    (element, [from, to]) => {
      const find = (text: string) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if ((node as Text).data.includes(text)) return node as Text;
        }
        throw new Error(`No text "${text}"`);
      };
      const start = find(from);
      const end = find(to);
      const range = document.createRange();
      range.setStart(start, start.data.indexOf(from));
      range.setEnd(end, end.data.indexOf(to) + to.length);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
    },
    [from, to],
  );

/** Puts the caret at the end of the first element of `selector`. */
const caretAtEnd = (page: Page, selector: string) =>
  editor(page).evaluate((element, selector) => {
    const range = document.createRange();
    range.selectNodeContents(element.querySelector(selector) as Node);
    range.collapse(false);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  }, selector);

// A space typed after code is the end of the line - a plain one collapses,
// and the caret after it falls back into the code
test("text typed after inline code is no code, with its space", async ({
  page,
}) => {
  await open(page);
  await editor(page).click();
  await page.keyboard.type("`code` more");
  await expect(value(page)).toHaveText(
    /^<p><code>code<\/code>(?: |&nbsp;)more<\/p>$/,
  );

  // Code switched off at the caret
  await page.keyboard.press("Enter");
  await page.keyboard.type("a ");
  await tool(page, "Code").click();
  await page.keyboard.type("x");
  await tool(page, "Code").click();
  await page.keyboard.type(" b");
  await expect(value(page)).toHaveText(
    /<p>a(?: |&nbsp;)<code>x<\/code>(?: |&nbsp;)b<\/p>$/,
  );
});

// Safari breaks a line of preformatted text with "\n" - the lines of a code
// block are separated by line breaks
test("Enter leaves a code block, whose lines become paragraphs", async ({
  page,
}) => {
  await open(page);
  await editor(page).click();
  await page.keyboard.type("```");
  await page.keyboard.type("line1");
  await page.keyboard.press("Enter");
  await page.keyboard.type("line2");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("after");
  await expect(value(page)).toHaveText(
    "<pre><code>line1<br>line2</code></pre><p>after</p>",
  );

  // A line after the last one with text
  await editor(page).evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element.querySelector("code") as Node);
    range.collapse(false);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("line3");
  await selectText(page, "line1", "line3");
  await tool(page, "Code block").click();
  await expect(value(page)).toHaveText(
    "<p>line1</p><p>line2</p><p>line3</p><p>after</p>",
  );
});

// Chrome on a Mac and Safari take the bold of the start of a selection -
// of a heading - for that of all of it
for (const [name, html, bolded] of [
  ["heading", "<h2>Title</h2><p>text</p>", "<h2>Title</h2><p><b>text</b></p>"],
  [
    "header cell",
    "<table><thead><tr><th>Head</th></tr></thead><tbody><tr><td>cell</td></tr></tbody></table>",
    "<table><thead><tr><th>Head</th></tr></thead><tbody><tr><td><b>cell</b></td></tr></tbody></table>",
  ],
] as const) {
  test(`bold makes the text after a ${name} bold and plain again`, async ({
    page,
  }) => {
    await open(page, html);
    await editor(page).click();
    await selectText(
      page,
      name === "heading" ? "Title" : "Head",
      name === "heading" ? "text" : "cell",
    );

    await tool(page, "Bold").click();
    await expect(value(page)).toHaveText(bolded);
    await expect(tool(page, "Bold")).toHaveAttribute("aria-pressed", "true");

    await tool(page, "Bold").click();
    await expect(value(page)).toHaveText(html);
  });
}

// Chrome and Safari end a heading at an inserted line break, the line after
// it left as text outside of any block
test("lines dropped at the end of a heading stay in it", async ({ page }) => {
  await open(page, "<h2>Head</h2><p>after</p>");
  await editor(page).click();
  await editor(page).evaluate((element) => {
    const text = element.querySelector("h2")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, text.length - 1);
    range.setEnd(text, text.length);
    const { bottom, right, top } = range.getBoundingClientRect();

    const data = new DataTransfer();
    data.setData("text/html", "<p>one</p><p>two</p>");
    element.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        clientX: right - 1,
        clientY: (top + bottom) / 2,
        dataTransfer: data,
      }),
    );
  });
  await expect(value(page)).toHaveText("<h2>Headone<br>two</h2><p>after</p>");
});

test("lines pasted into a heading stay in it", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName === "firefox",
    "Firefox gives a ClipboardEvent made by the page no data",
  );
  const paste = (html: string) =>
    editor(page).evaluate((element, html) => {
      const data = new DataTransfer();
      data.setData("text/html", html);
      data.setData("text/plain", "one\ntwo");
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    }, html);

  await open(page, "<h2>Head</h2><p>after</p>");
  await editor(page).click();
  await caretAtEnd(page, "h2");
  await paste("<p>one</p><p>two</p>");
  await expect(value(page)).toHaveText("<h2>Headone<br>two</h2><p>after</p>");

  // In its middle - Safari splits it in two
  await open(page, "<h2>Head</h2><p>after</p>");
  await editor(page).click();
  await editor(page).evaluate((element) => {
    const range = document.createRange();
    range.setStart(element.querySelector("h2")?.firstChild as Node, 2);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  });
  await paste("<p>one</p><p>two</p>");
  await expect(value(page)).toHaveText("<h2>Heone<br>twoad</h2><p>after</p>");
});
