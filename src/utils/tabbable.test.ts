import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  focusFirst,
  getNextTabbable,
  getPreviousTabbable,
  getTabbableElements,
  getTabStopsBeside,
} from "./tabbable";

const mount = (html: string) => {
  document.body.innerHTML = html;
  return document.body;
};

const names = (elements: HTMLElement[]) =>
  elements.map(
    (element) => element.getAttribute("aria-label") ?? element.textContent,
  );

afterEach(() => {
  document.body.innerHTML = "";
});

describe("getTabbableElements", () => {
  it("skips what Tab skips", () => {
    const body = mount(`
      <button>A</button>
      <button disabled>B</button>
      <button tabindex="-1">C</button>
      <div aria-hidden="true"><button>D</button></div>
      <div inert><button>E</button></div>
      <input type="hidden" />
      <a href="/x">F</a>
    `);

    expect(names(getTabbableElements(body))).toEqual(["A", "F"]);
  });

  it("stops at what Tab reaches without a tabindex - summaries, frames, media, editing hosts", () => {
    const body = mount(`
      <details><summary>More</summary><summary>Not a summary</summary></details>
      <iframe aria-label="Map"></iframe>
      <video aria-label="Clip" controls></video>
      <video aria-label="Muted"></video>
      <audio aria-label="Podcast" controls></audio>
      <div aria-label="Notes" contenteditable="true"><p contenteditable="true">x</p></div>
      <div aria-label="Read only" contenteditable="false"></div>
      <div aria-label="Skipped" contenteditable tabindex="-1"></div>
    `);

    expect(names(getTabbableElements(body))).toEqual([
      "More",
      "Map",
      "Clip",
      "Podcast",
      "Notes",
    ]);
  });

  it("passes over the links of editable text, as Tab does - not over its controls or a part that is not editable", () => {
    const body = mount(`
      <button>Before</button>
      <div aria-label="Notes" contenteditable="true">
        <p>See <a href="/a">Link</a> or <a href="/b" tabindex="0">Link with a tabindex</a></p>
        <button>Embedded</button>
        <figure contenteditable="false"><a href="/c">Caption link</a></figure>
      </div>
      <button>After</button>
    `);

    expect(names(getTabbableElements(body))).toEqual([
      "Before",
      "Notes",
      "Link with a tabindex",
      "Embedded",
      "Caption link",
      "After",
    ]);
  });

  it("makes a radio group a single stop - the checked radio", () => {
    const body = mount(`
      <button>Before</button>
      <input type="radio" name="size" aria-label="S" />
      <input type="radio" name="size" aria-label="M" checked />
      <input type="radio" name="size" aria-label="L" />
      <button>After</button>
    `);

    expect(names(getTabbableElements(body))).toEqual(["Before", "M", "After"]);
  });

  it("stops at the focused radio of a group - also an unchecked one", () => {
    const body = mount(`
      <input type="radio" name="size" aria-label="S" checked />
      <input type="radio" name="size" aria-label="M" />
      <button>After</button>
    `);
    const [, medium] = document.querySelectorAll("input");
    // A controlled group refused the change the arrow key asked for
    medium.focus();

    expect(names(getTabbableElements(body))).toEqual(["M", "After"]);
  });

  it("stops at the first radio of a group without a checked one", () => {
    const body = mount(`
      <input type="radio" name="size" aria-label="S" disabled />
      <input type="radio" name="size" aria-label="M" />
      <input type="radio" name="size" aria-label="L" />
    `);

    expect(names(getTabbableElements(body))).toEqual(["M"]);
  });

  it("keeps groups of other names and forms apart, and unnamed radios", () => {
    const body = mount(`
      <form><input type="radio" name="a" aria-label="A1" /></form>
      <form><input type="radio" name="a" aria-label="A2" /></form>
      <input type="radio" name="b" aria-label="B1" />
      <input type="radio" aria-label="X" />
      <input type="radio" aria-label="Y" />
    `);

    expect(names(getTabbableElements(body))).toEqual([
      "A1",
      "A2",
      "B1",
      "X",
      "Y",
    ]);
  });
});

describe("getNextTabbable", () => {
  it("moves from a radio past the rest of its group", () => {
    mount(`
      <input type="radio" name="size" aria-label="S" checked />
      <input type="radio" name="size" aria-label="M" />
      <button>Next</button>
    `);
    const [small] = document.querySelectorAll("input");

    expect(getNextTabbable(small)?.textContent).toBe("Next");
  });

  it("moves from an editing host past the links in its text", () => {
    mount(`
      <div aria-label="Notes" contenteditable="true">See <a href="/a">Link</a></div>
      <button>Next</button>
    `);
    const notes = screen.getByLabelText("Notes");

    expect(getNextTabbable(notes)?.textContent).toBe("Next");
    expect(getPreviousTabbable(screen.getByText("Next"))).toBe(notes);
  });
});

describe("getPreviousTabbable", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("finds the Tab stop before an element, skipping what Tab skips", () => {
    mount(`
      <button>First</button>
      <button disabled>Disabled</button>
      <div aria-hidden="true"><button>Hidden</button></div>
      <label><input type="radio" name="size" value="s"> S</label>
      <label><input type="radio" name="size" value="m" checked> M</label>
      <div id="row"><button>Delete</button></div>
      <button>After</button>
    `);
    const row = document.getElementById("row") as HTMLElement;

    // Of the radio group the checked radio is the stop
    expect(getPreviousTabbable(row)).toHaveProperty("value", "m");
    expect(getNextTabbable(row)?.textContent).toBe("After");

    const first = screen.getByText("First");
    expect(getPreviousTabbable(first)).toBeUndefined();
  });
});

describe("getTabStopsBeside", () => {
  it("finds the stop next to each ancestor - the next row past a button of the row", () => {
    mount(`
      <button>Before</button>
      <ul>
        <li id="a"><button>Actions A</button><button>Open A</button></li>
        <li id="b"><button>Actions B</button><button>Open B</button></li>
      </ul>
      <button>After</button>
    `);
    const actionsA = screen.getByText("Actions A");

    // Past the button, the row, the list
    expect(names(getTabStopsBeside(actionsA, false))).toEqual([
      "Open A",
      "Actions B",
      "After",
    ]);
    expect(names(getTabStopsBeside(actionsA, true))).toEqual(["Before"]);
    expect(names(getTabStopsBeside(screen.getByText("After"), false))).toEqual(
      [],
    );
  });
});

describe("Tab order through shadow roots", () => {
  const attachShadow = (host: Element, html: string) => {
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = html;
    return shadow;
  };

  it("enters nested shadow roots in place and leaves them in both directions", () => {
    const body = mount(`
      <button>Before</button>
      <div id="host"><button>Unslotted</button></div>
      <button>After</button>
    `);
    const host = document.getElementById("host")!;
    const shadow = attachShadow(
      host,
      `
      <button>First</button>
      <div id="nested"></div>
      <button>Last</button>
    `,
    );
    const nested = attachShadow(
      shadow.getElementById("nested")!,
      `
      <button>Nested first</button><button>Nested last</button>
    `,
    );
    const [first, last] = shadow.querySelectorAll("button");
    const [nestedFirst, nestedLast] = nested.querySelectorAll("button");

    expect(names(getTabbableElements(body))).toEqual([
      "Before",
      "First",
      "Nested first",
      "Nested last",
      "Last",
      "After",
    ]);
    expect(getNextTabbable(screen.getByText("Before"))).toBe(first);
    expect(getNextTabbable(first)).toBe(nestedFirst);
    expect(getPreviousTabbable(nestedFirst)).toBe(first);
    expect(getNextTabbable(nestedLast)).toBe(last);
    expect(getPreviousTabbable(last)).toBe(nestedLast);
    expect(getNextTabbable(last)).toBe(screen.getByText("After"));
    expect(getPreviousTabbable(first)).toBe(screen.getByText("Before"));
    expect(getPreviousTabbable(screen.getByText("After"))).toBe(last);
  });

  it("skips a host's shadow descendants, including a skipped portal region", () => {
    mount(`<button>Before</button><div id="host"></div><button>After</button>`);
    const host = document.getElementById("host")!;
    attachShadow(host, `<button>Panel action</button>`);

    expect(getNextTabbable(host)).toBe(screen.getByText("After"));
    expect(getNextTabbable(screen.getByText("Before"), host)).toBe(
      screen.getByText("After"),
    );
    expect(getPreviousTabbable(screen.getByText("After"), host)).toBe(
      screen.getByText("Before"),
    );
  });

  it("can leave a closed shadow root when the reference is inside it", () => {
    mount(`<button>Before</button><div id="host"></div><button>After</button>`);
    const shadow = document
      .getElementById("host")!
      .attachShadow({ mode: "closed" });
    shadow.innerHTML = `<button>First</button><button>Last</button>`;
    const [first, last] = shadow.querySelectorAll("button");

    expect(getNextTabbable(first)).toBe(last);
    expect(getNextTabbable(last)).toBe(screen.getByText("After"));
    expect(getPreviousTabbable(first)).toBe(screen.getByText("Before"));
    expect(names(getTabStopsBeside(first, false))).toEqual(["Last", "After"]);
  });

  it("uses slot order and fallback content, excluding unassigned children", () => {
    const body = mount(`
      <div id="host">
        <button slot="second">Second</button>
        <button slot="first">First</button>
        <button>Unassigned</button>
      </div>
      <button>After</button>
    `);
    attachShadow(
      document.getElementById("host")!,
      `
      <slot name="first"><button>Unused fallback</button></slot>
      <button>Middle</button>
      <slot name="second"></slot>
      <slot name="empty"><button>Fallback</button></slot>
    `,
    );

    expect(names(getTabbableElements(body))).toEqual([
      "First",
      "Middle",
      "Second",
      "Fallback",
      "After",
    ]);
    expect(getNextTabbable(screen.getByText("First"))?.textContent).toBe(
      "Middle",
    );
    expect(getPreviousTabbable(screen.getByText("Second"))?.textContent).toBe(
      "Middle",
    );
  });

  it("respects inert and hidden ancestors across shadow hosts and slots", () => {
    const body = mount(`
      <div id="inert" inert></div>
      <div aria-hidden="true"><div id="hidden"></div></div>
      <div id="slotted"><button>Hidden by slot</button></div>
      <button>Visible</button>
    `);
    attachShadow(document.getElementById("inert")!, `<button>Inert</button>`);
    attachShadow(document.getElementById("hidden")!, `<button>Hidden</button>`);
    attachShadow(document.getElementById("slotted")!, `<slot inert></slot>`);

    expect(names(getTabbableElements(body))).toEqual(["Visible"]);
  });

  it("keeps radio groups in separate trees and uses the focused shadow radio", () => {
    const body = mount(`
      <input type="radio" name="size" aria-label="Page" checked />
      <div id="host"></div>
      <button>After</button>
    `);
    const shadow = attachShadow(
      document.getElementById("host")!,
      `
      <input type="radio" name="size" aria-label="Small" checked />
      <input type="radio" name="size" aria-label="Medium" />
    `,
    );
    const [small, medium] = shadow.querySelectorAll("input");
    expect(names(getTabbableElements(body))).toEqual([
      "Page",
      "Small",
      "After",
    ]);
    expect(getNextTabbable(screen.getByRole("radio", { name: "Page" }))).toBe(
      small,
    );

    medium.focus();
    expect(names(getTabbableElements(body))).toEqual([
      "Page",
      "Medium",
      "After",
    ]);
    expect(getPreviousTabbable(screen.getByText("After"))).toBe(medium);
  });

  it("retains ancestor fallbacks beyond the shadow host", () => {
    mount(`<button>Before</button><div id="host"></div><button>After</button>`);
    const shadow = attachShadow(
      document.getElementById("host")!,
      `
      <ul>
        <li><button>Actions A</button><button>Open A</button></li>
        <li><button>Actions B</button></li>
      </ul>
      <button>Outside list</button>
    `,
    );
    const actions = shadow.querySelector("button")!;

    expect(names(getTabStopsBeside(actions, false))).toEqual([
      "Open A",
      "Actions B",
      "Outside list",
      "After",
    ]);
    expect(names(getTabStopsBeside(actions, true))).toEqual(["Before"]);
  });
});

describe("finding the Tab stops next to an element", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("compares it with a few elements of a long table, not with all", () => {
    // Each comparison may walk the rows - comparing with every element grew
    // worse than linear
    mount(
      `<table>${Array.from(
        { length: 1000 },
        (_, row) => `<tr><td><button>Row ${row}</button></td></tr>`,
      ).join("")}</table>`,
    );
    const compare = vi.spyOn(Node.prototype, "compareDocumentPosition");
    const middle = screen.getByText("Row 500");

    expect(getNextTabbable(middle)?.textContent).toBe("Row 501");
    expect(names(getTabStopsBeside(middle, true))[0]).toBe("Row 499");
    // Its own comparisons - the DOM of the tests compares on its own too
    const own = compare.mock.contexts.filter((node) => node === middle);
    expect(own.length).toBeLessThan(50);
  });
});

describe("focusFirst", () => {
  it("focuses the first element that takes the focus", () => {
    mount(
      "<button>Skipped</button><button>Taken</button><button>Last</button>",
    );
    const [skipped, taken] = screen.getAllByRole("button");
    // As Firefox does with a link in editable text
    vi.spyOn(skipped, "focus").mockImplementation(() => {});

    expect(focusFirst(screen.getAllByRole("button"))).toBe(true);
    expect(taken).toHaveFocus();
  });

  it("tells when none takes it - also in a shadow root", () => {
    mount("<div></div>");
    const root = document.body.firstElementChild!.attachShadow({
      mode: "open",
    });
    root.innerHTML = "<button>Inside</button><span>Text</span>";
    const [button, span] = root.children as unknown as HTMLElement[];

    expect(focusFirst([span])).toBe(false);
    expect(focusFirst([span, button])).toBe(true);
    expect(root.activeElement).toBe(button);
  });
});
