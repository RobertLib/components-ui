import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Select from "./select";

const stylesheet = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../styles.css"),
  "utf8",
);

const sizes = [
  { label: "Small", value: "s" },
  { label: "Medium", value: "m" },
  { label: "Large", value: "l" },
];

const combobox = (name: RegExp | string = /Size/) =>
  screen.getByRole<HTMLSelectElement>("combobox", { name });

describe("Select script writes", () => {
  it.each([
    { defaults: ["a", "b"], written: "a,b" },
    { defaults: [], written: "" },
  ])(
    "keeps the single option $written distinct from $defaults",
    async ({ defaults, written }) => {
      const options = ["", "a", "b", "a,b"].map((value) => ({
        label: value,
        value,
      }));
      const onChange = vi.fn();
      const field = (title: string) => (
        <form aria-label="Choices">
          <Select
            defaultValue={defaults}
            label="Choice"
            multiple
            name="choice"
            onChange={onChange}
            options={options}
            title={title}
          />
        </form>
      );
      const { rerender } = render(field("Before"));
      const select = screen.getByRole<HTMLSelectElement>("listbox");
      const form = screen.getByRole<HTMLFormElement>("form");

      act(() => {
        select.value = written;
      });
      expect(select).toHaveValue([written]);
      rerender(field("After"));
      expect(select).toHaveValue([written]);
      expect(new FormData(form).getAll("choice")).toEqual([written]);
      expect(onChange).not.toHaveBeenCalled();

      act(() => form.reset());
      await waitFor(() => expect(select).toHaveValue(defaults));
      expect(new FormData(form).getAll("choice")).toEqual(defaults);
    },
  );
});

describe("Select readOnly", () => {
  it("shows its value, keeps the focus and tells it cannot be changed", async () => {
    const user = userEvent.setup();
    render(<Select defaultValue="m" label="Size" options={sizes} readOnly />);

    const select = combobox();
    expect(select).toHaveValue("m");
    expect(select).toBeEnabled();
    expect(select).toHaveAttribute("aria-readonly", "true");
    expect(select).toHaveAttribute("data-readonly");

    await user.tab();
    expect(select).toHaveFocus();
  });

  it("refuses the keys that open it or change its value", () => {
    const onKeyDown = vi.fn();
    render(
      <Select
        defaultValue="m"
        label="Size"
        onKeyDown={onKeyDown}
        options={sizes}
        readOnly
      />,
    );

    const select = combobox();
    for (const key of ["ArrowDown", "ArrowUp", " ", "Enter", "End", "l"]) {
      expect(fireEvent.keyDown(select, { key }), key).toBe(false);
    }
    // Moving on and the shortcuts of the page stay
    expect(fireEvent.keyDown(select, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(select, { ctrlKey: true, key: "p" })).toBe(true);
    expect(onKeyDown).toHaveBeenCalledTimes(8);
  });

  it("keeps its list closed at a press, and focuses", () => {
    render(<Select defaultValue="m" label="Size" options={sizes} readOnly />);

    const select = combobox();
    // The pointer passes through it to the element around, which focuses it
    expect(select).toHaveClass("pointer-events-none");
    expect(fireEvent.mouseDown(select.parentElement!)).toBe(false);
    expect(select).toHaveFocus();
  });

  it("refuses a change that got through, controlled or not", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function Controlled() {
      const [size, setSize] = useState("s");
      return (
        <Select
          label="Controlled"
          onChange={(event) => {
            onChange();
            setSize(event.target.value);
          }}
          options={sizes}
          readOnly
          value={size}
        />
      );
    }
    render(
      <>
        <Select defaultValue="m" label="Size" options={sizes} readOnly />
        <Controlled />
      </>,
    );

    // As assistive technology picks an option
    fireEvent.change(combobox(), { target: { value: "l" } });
    expect(combobox()).toHaveValue("m");

    await user.selectOptions(combobox(/Controlled/), "l");
    expect(combobox(/Controlled/)).toHaveValue("s");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is submitted with its form, unlike a disabled one", () => {
    render(
      <form aria-label="Order">
        <Select
          defaultValue="m"
          label="Size"
          name="size"
          options={sizes}
          readOnly
        />
        <Select
          defaultValue="l"
          disabled
          label="Other"
          name="other"
          options={sizes}
        />
      </form>,
    );

    const data = new FormData(screen.getByRole("form", { name: "Order" }));
    expect(data.get("size")).toBe("m");
    expect(data.has("other")).toBe(false);
  });

  it("is not checked by required, as a read-only input is not", () => {
    render(
      <Select
        defaultValue=""
        hasEmpty
        label="Size"
        options={sizes}
        readOnly
        required
      />,
    );

    // The user could not fix it - the form is not blocked
    const select = combobox();
    expect(select).toBeValid();
    expect(select).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("hides the arrow, and leaves a list box scrolling", () => {
    render(
      <>
        <Select defaultValue="m" label="Size" options={sizes} readOnly />
        <Select
          defaultValue={["m"]}
          label="Many"
          multiple
          options={sizes}
          readOnly
        />
      </>,
    );

    expect(combobox()).not.toHaveClass("cui-select-arrow", "pe-8");
    const listbox = screen.getByRole("listbox", { name: /Many/ });
    expect(listbox).not.toHaveClass("pointer-events-none");
    // A press picks no option
    expect(fireEvent.mouseDown(listbox)).toBe(false);
    expect(listbox).toHaveFocus();
  });
});

describe("Select arrow", () => {
  it("sits at the end of the field, on the left in a right-to-left page", () => {
    render(<Select label="Size" options={sizes} />);

    // The room for it on the end side
    expect(combobox()).toHaveClass("cui-select-arrow", "pe-8");
    expect(combobox().className).not.toMatch(/\bpr-/);
    // No inline image a stylesheet could not move to the left
    expect(combobox().style.backgroundImage).toBe("");

    // Background positions have no logical sides - the stylesheet flips it
    const rule =
      /\.cui-select-arrow\s*\{[^}]*right 0\.5rem center[^}]*&:where\(:dir\(rtl\)[^{]*\{\s*background-position: left 0\.5rem center/;
    expect(stylesheet).toMatch(rule);
  });

  it("is left out of a list box, which opens nothing", () => {
    render(
      <>
        <Select label="Size" multiple options={sizes} />
        <Select label="Rows" options={sizes} size={3} />
      </>,
    );

    for (const listbox of screen.getAllByRole("listbox")) {
      expect(listbox).not.toHaveClass("cui-select-arrow", "pe-8");
    }
  });
});

describe("Select label", () => {
  it("takes content and marks a required select", () => {
    render(
      <Select
        label={
          <>
            Size <small>(EU)</small>
          </>
        }
        options={sizes}
        required
      />,
    );

    expect(combobox("Size (EU):")).toBeRequired();
    expect(screen.getByText("*")).toHaveClass("cui-required-mark");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });
});
