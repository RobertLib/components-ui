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
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { hasVariantApplies } from "../../test/has-variant";
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
    // The pointer passes through it - and the element around it, which has
    // no box without an adornment - to the field, which focuses it
    expect(select).toHaveClass("pointer-events-none");
    expect(select.parentElement).toHaveClass("contents");
    expect(fireEvent.mouseDown(select.parentElement!.parentElement!)).toBe(
      false,
    );
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

    expect(combobox()).not.toHaveClass("cui-select-arrow");
    expect(combobox()).not.toHaveClass("pe-8");
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
      expect(listbox).not.toHaveClass("cui-select-arrow");
      expect(listbox).not.toHaveClass("pe-8");
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

describe("Select prefix and suffix", () => {
  it("frames the select with them and leaves the name to the label", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Sort"
        onChange={onChange}
        options={sizes}
        prefix="Sort by:"
        suffix="↓"
      />,
    );

    const select = combobox("Sort");
    const frame = select.parentElement!;
    expect(frame).toHaveClass("rounded-md", "border", "focus-within:ring-2");
    // The frame draws the border - not the select in it
    expect(select).not.toHaveClass("form-control");
    expect(select).toHaveClass("bg-transparent", "cui-select-arrow");
    expect(screen.getByText("Sort by:")).toBeInTheDocument();
    expect(screen.getByText("↓")).toBeInTheDocument();

    // A click on the caption focuses the select - and opens its list
    const showPicker = vi.fn();
    Object.defineProperty(select, "showPicker", { value: showPicker });
    await user.click(screen.getByText("Sort by:"));
    expect(select).toHaveFocus();
    expect(showPicker).toHaveBeenCalledOnce();

    await user.selectOptions(select, "l");
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("marks the frame of an invalid or disabled select", () => {
    const { rerender } = render(
      <Select error="Pick one" label="Size" options={sizes} prefix="⇅" />,
    );

    expect(combobox().parentElement).toHaveClass("border-danger-500!");
    expect(combobox()).not.toHaveClass("border-danger-500!");

    rerender(<Select disabled label="Size" options={sizes} prefix="⇅" />);
    expect(hasVariantApplies(combobox().parentElement!, "opacity-50")).toBe(
      true,
    );
  });

  it("fades for its own disabled select - not for one in an adornment", () => {
    render(
      <>
        <Select
          aria-label="Size"
          options={sizes}
          prefix={
            <select aria-label="Unit" disabled>
              <option>cm</option>
            </select>
          }
        />
        {/* No prop tells the select it is disabled */}
        <fieldset disabled>
          <Select aria-label="Weight" options={sizes} prefix="⇅" />
        </fieldset>
      </>,
    );

    const frame = (name: string) => combobox(name).parentElement!;
    expect(hasVariantApplies(frame("Size"), "opacity-50")).toBe(false);
    expect(hasVariantApplies(frame("Size"), "cursor-not-allowed")).toBe(false);
    expect(hasVariantApplies(frame("Weight"), "opacity-50")).toBe(true);
    expect(hasVariantApplies(frame("Weight"), "cursor-not-allowed")).toBe(true);
  });

  it("opens its own list - not that of a select in an adornment", async () => {
    const user = userEvent.setup();
    render(
      <Select
        aria-label="Size"
        options={sizes}
        prefix={
          <select aria-label="Unit">
            <option>cm</option>
            <option>in</option>
          </select>
        }
        suffix="info"
      />,
    );

    const select = combobox("Size");
    const unit = combobox("Unit");
    const showPicker = vi.fn();
    const showUnitPicker = vi.fn();
    Object.defineProperty(select, "showPicker", { value: showPicker });
    Object.defineProperty(unit, "showPicker", { value: showUnitPicker });

    // A click on the suffix, and on the padding of the frame
    await user.click(screen.getByText("info"));
    expect(select).toHaveFocus();
    select.blur();
    await user.click(select.parentElement!);
    expect(select).toHaveFocus();
    expect(showPicker).toHaveBeenCalledTimes(2);
    expect(showUnitPicker).not.toHaveBeenCalled();

    // The select of the prefix is still a control of its own
    await user.selectOptions(unit, "in");
    expect(unit).toHaveValue("in");
    expect(unit).toHaveFocus();
  });

  it("focuses its own read-only select at a press beside it", () => {
    render(
      <Select
        aria-label="Size"
        options={sizes}
        prefix={
          <select aria-label="Unit">
            <option>cm</option>
          </select>
        }
        readOnly
      />,
    );

    // The press lands on the element around the label and the frame
    const field = combobox("Size").parentElement!.parentElement!;
    expect(fireEvent.mouseDown(field)).toBe(false);
    expect(combobox("Size")).toHaveFocus();
  });

  it("opens no list of a read-only select by a click on its prefix", async () => {
    const user = userEvent.setup();
    render(
      <Select label="Size" options={sizes} prefix="⇅" readOnly value="m" />,
    );

    const showPicker = vi.fn();
    Object.defineProperty(combobox(), "showPicker", { value: showPicker });
    await user.click(screen.getByText("⇅"));
    expect(combobox()).toHaveFocus();
    expect(showPicker).not.toHaveBeenCalled();
  });

  it("lets the mouse pick an option of a framed list box", () => {
    render(
      <Select
        aria-label="Sizes"
        multiple
        options={[{ label: "Sizes", options: sizes }]}
        prefix="⇅"
      />,
    );

    // The press of a list box lands on the option - not on the select
    const option = screen.getByRole("option", { name: "Medium" });
    expect(fireEvent.mouseDown(option)).toBe(true);
    // The frame still keeps the focus where it is at a press on the prefix
    expect(fireEvent.mouseDown(screen.getByText("⇅"))).toBe(false);
  });

  it("keeps the select, and its focus, as an adornment comes and goes", () => {
    const { rerender } = render(
      <Select label="Size" options={sizes} suffix={false} />,
    );
    const select = combobox();
    select.focus();
    // Without an adornment there is no frame - the element has no box
    expect(select.parentElement).toHaveClass("contents");
    expect(select.parentElement).not.toHaveClass("border");
    expect(select).toHaveClass("form-control");

    rerender(<Select label="Size" options={sizes} suffix="Loading…" />);
    expect(combobox()).toBe(select);
    expect(select).toHaveFocus();
    expect(select.parentElement).toHaveClass("rounded-md", "border");
    expect(select.parentElement).not.toHaveClass("contents");

    rerender(<Select label="Size" options={sizes} prefix="⇅" />);
    expect(combobox()).toBe(select);
    expect(select).toHaveFocus();

    rerender(<Select label="Size" options={sizes} />);
    expect(combobox()).toBe(select);
    expect(select).toHaveFocus();
    expect(select.parentElement).toHaveClass("contents");
  });

  it("leaves a press in a portal of an adornment to it", () => {
    function Help() {
      return createPortal(<p>Sizes in centimetres</p>, document.body);
    }
    render(<Select label="Size" options={sizes} suffix={<Help />} />);

    const showPicker = vi.fn();
    Object.defineProperty(combobox(), "showPicker", { value: showPicker });
    // React passes the events on to the frame - its text can be selected,
    // and a click opens no list
    const help = screen.getByText("Sizes in centimetres");
    expect(fireEvent.mouseDown(help)).toBe(true);
    fireEvent.click(help);
    expect(combobox()).not.toHaveFocus();
    expect(showPicker).not.toHaveBeenCalled();
  });

  it("leaves a button of an adornment to itself", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <Select
        label="Size"
        options={sizes}
        suffix={
          <button onClick={onReset} type="button">
            Reset
          </button>
        }
      />,
    );

    const showPicker = vi.fn();
    Object.defineProperty(combobox(), "showPicker", { value: showPicker });
    const reset = screen.getByRole("button", { name: "Reset" });
    // Its press is not taken for one on the frame - it focuses the button
    expect(fireEvent.mouseDown(reset)).toBe(true);
    await user.click(reset);
    expect(onReset).toHaveBeenCalledOnce();
    expect(reset).toHaveFocus();
    expect(showPicker).not.toHaveBeenCalled();
  });
});
