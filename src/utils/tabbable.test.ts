import { afterEach, describe, expect, it } from "vitest";
import { getNextTabbable, getTabbableElements } from "./tabbable";

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
