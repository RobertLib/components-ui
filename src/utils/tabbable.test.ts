import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getNextTabbable,
  getPreviousTabbable,
  getTabbableElements,
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
