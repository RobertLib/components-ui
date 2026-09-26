import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import Autocomplete from "./autocomplete";
import Checkbox from "./checkbox";
import CheckboxGroup from "./checkbox-group";
import DateTimePicker from "./datetime-picker";
import FormDescription from "./form-description";
import Input from "./input";
import NumberInput from "./number-input";
import PinInput from "./pin-input";
import RadioGroup from "./radio-group";
import SegmentedControl from "./segmented-control";
import Select from "./select";
import Switch from "./switch";
import TagsInput from "./tags-input";
import Textarea from "./textarea";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

const sizes = [
  { label: "Small", value: "s" },
  { label: "Medium", value: "m" },
  { label: "Large", value: "l" },
];

describe("RadioGroup", () => {
  it("keeps numeric values checked after a change", async () => {
    const user = userEvent.setup();

    function Plans() {
      const [plan, setPlan] = useState(1);
      return (
        <RadioGroup
          label="Plan"
          onChange={(event) => setPlan(Number(event.target.value))}
          options={[
            { label: "Free", value: 1 },
            { label: "Team", value: 2 },
          ]}
          value={plan}
        />
      );
    }

    render(<Plans />);
    await user.click(screen.getByRole("radio", { name: "Team" }));
    expect(screen.getByRole("radio", { name: "Team" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Free" })).not.toBeChecked();
  });

  it("is named without a label and marks the group as invalid", () => {
    render(
      <RadioGroup
        aria-label="Plan"
        error="Pick a plan"
        options={[
          { label: "Free", value: 1 },
          { label: "Team", value: 2 },
        ]}
        required
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Plan" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("aria-required", "true");
    expect(group).toHaveAccessibleDescription("Pick a plan");
    expect(screen.getByRole("radio", { name: "Free" })).toBeRequired();
    expect(screen.getByRole("radio", { name: "Free" })).not.toHaveAttribute(
      "aria-invalid",
    );
  });
});

describe("Field descriptions", () => {
  it("keep the consumer's aria-describedby next to the error", () => {
    render(
      <>
        <p id="hint">Hint</p>
        <Input aria-describedby="hint" error="Bad" label="Name" />
        <Textarea aria-describedby="hint" error="Bad" label="Note" />
        <Select
          aria-describedby="hint"
          error="Bad"
          label="Size"
          options={sizes}
        />
        <Switch aria-describedby="hint" error="Bad" label="Notify" />
      </>,
    );

    for (const field of [
      screen.getByRole("textbox", { name: /Name/ }),
      screen.getByRole("textbox", { name: /Note/ }),
      screen.getByRole("combobox", { name: /Size/ }),
      screen.getByRole("switch", { name: /Notify/ }),
    ]) {
      expect(field).toHaveAccessibleDescription("Bad Hint");
    }
  });
});

describe("FormDescription", () => {
  it("renders nothing without text", () => {
    const { container } = render(<FormDescription id="hint" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("describes a checkbox after its error", () => {
    render(
      <Checkbox
        description={
          <>
            Read the <a href="/terms">terms</a> first.
          </>
        }
        error="Required"
        label="I agree"
      />,
    );

    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      "Required Read the terms first.",
    );
  });
});

describe("Checkbox indeterminate", () => {
  function SelectAll() {
    const [selected, setSelected] = useState(["a"]);
    const all = ["a", "b"];

    return (
      <Checkbox
        checked={selected.length === all.length}
        indeterminate={selected.length > 0 && selected.length < all.length}
        label="All"
        onChange={(event) => setSelected(event.target.checked ? all : [])}
      />
    );
  }

  it("sets the DOM property, and brings it back after a click", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Checkbox indeterminate label="All" />);
    const checkbox = screen.getByRole<HTMLInputElement>("checkbox");

    expect(checkbox.indeterminate).toBe(true);
    expect(checkbox).toBePartiallyChecked();

    await user.click(checkbox);
    rerender(<Checkbox indeterminate label="All" />);
    expect(checkbox.indeterminate).toBe(true);

    rerender(<Checkbox indeterminate={false} label="All" />);
    expect(checkbox.indeterminate).toBe(false);
  });

  it("works as the select all of a partly selected list", async () => {
    const user = userEvent.setup();
    render(<SelectAll />);
    const checkbox = screen.getByRole<HTMLInputElement>("checkbox");

    expect(checkbox).toBePartiallyChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(checkbox.indeterminate).toBe(false);

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(checkbox.indeterminate).toBe(false);
  });

  it("leaves a property set by the page alone without the prop", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(<Checkbox label="All" ref={ref} />);

    ref.current!.indeterminate = true;
    rerender(<Checkbox label="All (changed)" ref={ref} />);

    expect(ref.current!.indeterminate).toBe(true);
  });

  it("clears the property when the prop goes from true to undefined", () => {
    // `indeterminate={partly || undefined}`
    const { rerender } = render(<Checkbox indeterminate label="All" />);
    const checkbox = screen.getByRole<HTMLInputElement>("checkbox");
    expect(checkbox.indeterminate).toBe(true);

    rerender(<Checkbox indeterminate={undefined} label="All" />);
    expect(checkbox.indeterminate).toBe(false);
  });
});

describe("Input", () => {
  it("connects the label with a custom id and describes the error", () => {
    render(<Input error="Required" id="email" label="Email" />);

    const input = screen.getByRole("textbox", { name: /Email/ });
    expect(input).toHaveAttribute("id", "email");
    expect(input).toHaveAccessibleDescription("Required");
    expect(input).toBeInvalid();
  });

  it("gives two fields of the same name different ids", () => {
    render(
      <>
        <Input label="First" name="q" />
        <Input label="Second" name="q" />
      </>,
    );

    const [first, second] = screen.getAllByRole("textbox");
    expect(first.id).not.toBe(second.id);
  });

  it("shows the parent's value when it rejects a change", async () => {
    const user = userEvent.setup();

    function DigitsOnly() {
      const [value, setValue] = useState("12");
      return (
        <Input
          label="Code"
          onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
          value={value}
        />
      );
    }

    render(<DigitsOnly />);
    const input = screen.getByRole("textbox", { name: /Code/ });
    await user.type(input, "a");
    expect(input).toHaveValue("12");
    await user.type(input, "3");
    expect(input).toHaveValue("123");
  });

  it("floats the label over a value of 0", () => {
    render(
      <Input
        floating
        label="Quantity"
        onChange={() => {}}
        type="number"
        value={0}
      />,
    );

    expect(screen.getByText("Quantity")).toHaveClass("text-xs");
  });

  it("names the password toggle the same way and presses it", async () => {
    const user = userEvent.setup();
    render(<Input label="Password" type="password" />);

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(toggle).toHaveAccessibleName("Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/Password/)).toHaveAttribute("type", "text");
  });

  it("passes its ref to the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Name" ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("textbox", { name: /Name/ }));
  });
});

describe("Field sizes", () => {
  it("shrink the padding of a small Input and Textarea", () => {
    render(
      <>
        <Input dim="sm" label="Small input" />
        <Textarea dim="sm" label="Small note" />
        <Input label="Input" />
        <Textarea label="Note" />
      </>,
    );

    // Only one padding per axis - with two, the CSS order would pick one
    for (const name of [/Small input/, /Small note/]) {
      const field = screen.getByRole("textbox", { name });
      expect(field).toHaveClass("px-1", "py-0");
      expect(field).not.toHaveClass("px-2");
      expect(field).not.toHaveClass("py-1");
    }
    for (const name of [/^Input/, /^Note/]) {
      expect(screen.getByRole("textbox", { name })).toHaveClass("px-2", "py-1");
    }
  });
});

describe("Label suffix", () => {
  it("follows the labels as the locale says", () => {
    render(
      <UIProvider messages={{ form: { labelSuffix: " :" } }}>
        <Input label="Nom" />
        <Textarea label="Note" />
        <Select label="Taille" options={sizes} />
        <RadioGroup label="Offre" options={plans} />
      </UIProvider>,
    );

    expect(screen.getByRole("textbox", { name: "Nom :" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Note :" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Taille :" })).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Offre :" })).toBeVisible();
  });

  it("can be left out", () => {
    render(
      <UIProvider messages={{ form: { labelSuffix: "" } }}>
        <Input label="Name" required />
      </UIProvider>,
    );

    expect(screen.getByRole("textbox", { name: "Name" })).toBeRequired();
  });
});

describe("Select", () => {
  it("keeps all options picked in an uncontrolled multiple select", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue={["s"]} label="Sizes" multiple options={sizes} />,
    );

    const select = screen.getByRole<HTMLSelectElement>("listbox", {
      name: /Sizes/,
    });
    await user.selectOptions(select, ["l"]);
    expect(
      Array.from(select.selectedOptions, (option) => option.value),
    ).toEqual(["s", "l"]);
  });
});

describe("Uncontrolled fields", () => {
  it("take their defaultValue back when the form is reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <Input defaultValue="Ada" floating label="Name" name="name" />
        <Textarea defaultValue="Hello" label="Note" name="note" />
        <Select defaultValue="m" label="Size" name="size" options={sizes} />
        <RadioGroup
          defaultValue={1}
          label="Plan"
          name="plan"
          options={[
            { label: "Free", value: 1 },
            { label: "Team", value: 2 },
          ]}
        />
        <DateTimePicker
          defaultValue="10:30"
          label="Time"
          name="time"
          type="time"
        />
        <button type="reset">Reset</button>
      </form>,
    );

    const name = screen.getByRole("textbox", { name: /Name/ });
    const nameLabel = screen.getByText("Name");
    await user.clear(name);
    await user.type(screen.getByRole("textbox", { name: /Note/ }), "!");
    expect(nameLabel).not.toHaveClass("text-xs");

    await user.selectOptions(
      screen.getByRole("combobox", { name: /Size/ }),
      "l",
    );
    await user.click(screen.getByRole("radio", { name: "Team" }));
    await user.click(screen.getByRole("button", { name: "Clear value" }));

    await user.click(screen.getByRole("button", { name: "Reset" }));

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(Object.fromEntries(new FormData(form))).toEqual({
      name: "Ada",
      note: "Hello",
      plan: "1",
      size: "m",
      time: "10:30",
    });
    expect(name).toHaveValue("Ada");
    expect(nameLabel).toHaveClass("text-xs");
    expect(screen.getByRole("radio", { name: "Free" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /Time/ })).toHaveValue(
      "10:30 AM",
    );
  });

  it("include checkboxes and switches - also after a later render", async () => {
    const user = userEvent.setup();
    const form = (hint?: string) => (
      <form aria-label="Consent">
        <Checkbox
          defaultChecked
          description={hint}
          label="Newsletter"
          name="newsletter"
        />
        <Checkbox label="Terms" name="terms" />
        <Switch label="Notify" name="notify" />
        <button type="reset">Reset</button>
      </form>
    );
    const { rerender } = render(form());

    await user.click(screen.getByRole("checkbox", { name: "Newsletter" }));
    await user.click(screen.getByRole("checkbox", { name: "Terms" }));
    await user.click(screen.getByRole("switch", { name: "Notify" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    // A render after the reset does not bring the old state back
    rerender(form("Once a month"));

    const element = screen.getByRole<HTMLFormElement>("form", {
      name: "Consent",
    });
    expect(Object.fromEntries(new FormData(element))).toEqual({
      newsletter: "on",
    });
    expect(screen.getByRole("checkbox", { name: "Newsletter" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Terms" })).not.toBeChecked();
  });

  it("are reset after a form action", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <form action={action}>
        <Input defaultValue="Ada" label="Name" name="name" />
        <button type="submit">Save</button>
      </form>,
    );

    const name = screen.getByRole("textbox", { name: /Name/ });
    await user.clear(name);
    await user.type(name, "Grace");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(name).toHaveValue("Ada"));
    expect(action.mock.calls[0][0].get("name")).toBe("Grace");
  });
});

type ScriptedElement =
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * What React Hook Form does with the native fields it registers: the `ref`
 * of `register()` writes the default value into the element, `setValue()`
 * and `reset(values)` write its `value`, and `reset()` resets the form
 * around, then writes the defaults again - none of it fires an event.
 */
function createScriptedForm(defaults: Record<string, string>) {
  const elements = new Map<string, ScriptedElement>();
  const values: Record<string, string> = { ...defaults };

  return {
    register: (name: string) => ({
      name,
      onChange: (event: { target: { value: string } }) => {
        values[name] = event.target.value;
      },
      ref: (element: ScriptedElement | null) => {
        if (!element || elements.get(name) === element) return;
        elements.set(name, element);
        element.value = values[name] ?? "";
      },
    }),
    reset: (next?: Record<string, string>) => {
      if (!next) elements.values().next().value?.form?.reset();
      Object.assign(values, next ?? defaults);
      for (const [name, element] of elements) element.value = values[name];
    },
    setValue: (name: string, value: string) => {
      values[name] = value;
      const element = elements.get(name);
      if (element) element.value = value;
    },
    values,
  };
}

describe("Values written by a script", () => {
  it("stay in an uncontrolled Input - register(), setValue(), reset()", async () => {
    const user = userEvent.setup();
    const form = createScriptedForm({ name: "Ada" });
    render(
      <form>
        <Input clearable label="Name" {...form.register("name")} />
      </form>,
    );

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: /Name/,
    });
    expect(input).toHaveValue("Ada");
    // The focus renders the field anew - the value stays
    await user.click(input);
    expect(input).toHaveValue("Ada");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();

    await user.type(input, "!");
    expect(form.values.name).toBe("Ada!");

    act(() => form.setValue("name", "Grace"));
    await user.tab();
    expect(input).toHaveValue("Grace");

    act(() => form.reset({ name: "" }));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();

    act(() => form.reset());
    await user.click(input);
    expect(input).toHaveValue("Ada");
  });

  it("keep the UI of a field in step - a counter, a floating label", () => {
    const form = createScriptedForm({ note: "", title: "" });
    render(
      <>
        <Input floating label="Title" {...form.register("title")} />
        <Textarea
          label="Note"
          maxLength={20}
          showCount
          {...form.register("note")}
        />
      </>,
    );

    act(() => {
      form.setValue("title", "Offer");
      form.setValue("note", "Hello");
    });

    expect(screen.getByText("Title")).toHaveClass("text-xs");
    expect(screen.getByRole("textbox", { name: /Note/ })).toHaveValue("Hello");
    expect(screen.getByText("5 / 20")).toBeInTheDocument();
  });

  it("stay in an uncontrolled Select and a native DateTimePicker", () => {
    const form = createScriptedForm({ day: "2026-03-01", size: "m" });
    const fields = (description?: string) => (
      <>
        <Select
          description={description}
          label="Size"
          options={sizes}
          {...form.register("size")}
        />
        <DateTimePicker
          description={description}
          label="Day"
          mode="native"
          {...form.register("day")}
          onChange={(event) => (form.values.day = event.target.value)}
        />
      </>
    );
    const { rerender } = render(fields());

    const select = screen.getByRole("combobox", { name: /Size/ });
    const day = screen.getByLabelText(/Day/);
    // A render of the fields keeps what `register()` wrote
    rerender(fields("Pick one"));
    expect(select).toHaveValue("m");
    expect(day).toHaveValue("2026-03-01");

    act(() => form.setValue("size", "l"));
    rerender(fields("Pick another"));
    expect(select).toHaveValue("l");
  });

  it("leave a Checkbox and a Switch checked as a script set them", () => {
    // `register()` sets `checked` of a checkbox - no event either
    const fields = (description?: string) => (
      <>
        <Checkbox description={description} label="Newsletter" />
        <Switch description={description} label="Notify" />
      </>
    );
    const { rerender } = render(fields());

    const checkbox = screen.getByRole<HTMLInputElement>("checkbox");
    const toggle = screen.getByRole<HTMLInputElement>("switch");
    checkbox.checked = true;
    toggle.checked = true;
    rerender(fields("Once a month"));
    expect(checkbox).toBeChecked();
    expect(toggle).toBeChecked();
  });

  it("are replaced by the value of a controlled field at its next render", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Name" onChange={() => {}} ref={ref} value="Ada" />);

    ref.current!.value = "Grace";
    await user.click(ref.current!);
    expect(ref.current).toHaveValue("Ada");
  });

  it("leave the form reset and a late defaultValue working", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const field = (defaultValue?: string) => (
      <form>
        <Input defaultValue={defaultValue} label="Name" ref={ref} />
        <button type="reset">Reset</button>
      </form>
    );
    const { rerender } = render(field());

    // A defaultValue that arrives later - and changes again
    rerender(field("Ada"));
    expect(ref.current).toHaveValue("Ada");
    rerender(field("Grace"));
    expect(ref.current).toHaveValue("Grace");

    ref.current!.value = "Linus";
    await user.click(ref.current!);
    expect(ref.current).toHaveValue("Linus");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(ref.current).toHaveValue("Grace");
    rerender(field("Ada"));
    expect(ref.current).toHaveValue("Ada");
  });
});

describe("A disabled fieldset around", () => {
  // The CSS of the look is not loaded here - the tests pin the selectors
  // that give it: `:disabled` of the elements, not a `disabled` prop
  it("gives the fields the disabled look without a disabled prop", () => {
    render(
      <fieldset disabled>
        <Input label="Name" />
        <Input label="Price" suffix="Kč" />
        <NumberInput label="Quantity" />
        <PinInput label="Code" length={2} />
        <RadioGroup label="Plan" options={sizes} />
        <CheckboxGroup label="Sizes" options={sizes} />
        <SegmentedControl aria-label="View" options={sizes} />
      </fieldset>,
    );

    // A field without a frame has the look of `form-control:disabled`
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveClass(
      "form-control",
    );
    const price = screen.getByRole("textbox", { name: /Price/ });
    expect(price.parentElement).toHaveClass("has-[input:disabled]:opacity-50");
    expect(
      screen.getByRole("spinbutton", { name: /Quantity/ }).parentElement,
    ).toHaveClass("has-[input:disabled]:opacity-50");
    expect(screen.getByRole("button", { name: "Increase" })).toHaveClass(
      "disabled:cursor-not-allowed",
    );
    for (const cell of screen.getAllByRole("textbox", { name: /Digit/ })) {
      expect(cell).toHaveClass("disabled:opacity-50");
    }
    const radioLabel = screen.getAllByRole("radio")[0].closest("label");
    expect(radioLabel).toHaveClass("has-disabled:opacity-60");
    const checkboxRow = screen.getAllByRole("checkbox")[0].closest("div");
    expect(checkboxRow).toHaveClass("has-disabled:opacity-60");
    const segment = within(
      screen.getByRole("radiogroup", { name: "View" }),
    ).getAllByRole("radio")[0];
    expect(segment.closest("label")).toHaveClass(
      "has-disabled:cursor-not-allowed",
    );
    expect(segment.closest("label")?.parentElement).toHaveClass(
      "[fieldset:disabled_&]:opacity-60",
    );
  });
});

describe("DateTimePicker", () => {
  it("shows the value in the locale format and reports ISO values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <UIProvider locale={cs}>
        <DateTimePicker
          defaultValue="2026-09-24"
          label="Datum"
          name="date"
          onChange={(event) => onChange(event.target.value)}
          type="date"
        />
      </UIProvider>,
    );

    const input = screen.getByRole("combobox", { name: /Datum/ });
    expect(input).toHaveValue("24.09.2026");

    await user.click(input);
    await user.click(
      await screen.findByRole("button", { name: "25. září 2026" }),
    );
    expect(onChange).toHaveBeenCalledWith("2026-09-25");
    expect(input).toHaveValue("25.09.2026");
    expect(document.querySelector("input[type=hidden][name=date]")).toHaveValue(
      "2026-09-25",
    );
  });

  it("disables the days outside min and max", async () => {
    const user = userEvent.setup();

    render(
      <DateTimePicker
        defaultValue="2026-09-15"
        label="Day"
        max="2026-09-20"
        min="2026-09-10"
        type="date"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /Day/ }));
    expect(
      await screen.findByRole("button", { name: "September 9, 2026" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "September 10, 2026" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "September 21, 2026" }),
    ).toBeDisabled();
  });

  it("clears the value", () => {
    const onChange = vi.fn();
    render(
      <DateTimePicker
        defaultValue="10:30"
        label="Time"
        onChange={(event) => onChange(event.target.value)}
        type="time"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear value" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps showing a controlled value the parent does not change", () => {
    render(
      <DateTimePicker
        label="Day"
        onChange={() => {}}
        type="date"
        value="2026-09-24"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear value" }));
    expect(screen.getByRole("combobox", { name: /Day/ })).toHaveValue(
      "09/24/2026",
    );
  });
});

const plans = [
  { label: "Free", value: 1 },
  { label: "Team", value: 2 },
];

/** The entries a form submits - a repeated name as an array. */
const formEntries = (form: HTMLFormElement) => {
  const data = new FormData(form);
  return Object.fromEntries(
    [...new Set(data.keys())].map((key) => {
      const values = data.getAll(key);
      return [key, values.length > 1 ? values : values[0]];
    }),
  );
};

describe("Form resets", () => {
  it("keep the defaultValue of a select that was not changed", () => {
    render(
      <form aria-label="Order">
        <Select defaultValue="m" label="Size" name="size" options={sizes} />
        <Select
          defaultValue={["s", "l"]}
          label="Extras"
          multiple
          name="extras"
          options={sizes}
        />
      </form>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    act(() => form.reset());

    expect(formEntries(form)).toEqual({ extras: ["s", "l"], size: "m" });
    expect(screen.getByRole("combobox", { name: /Size/ })).toHaveValue("m");
  });

  it("bring back a defaultValue that arrived after the first render", () => {
    const fields = (size?: string, plan?: number) => (
      <form aria-label="Order">
        <Select defaultValue={size} label="Size" name="size" options={sizes} />
        <RadioGroup
          defaultValue={plan}
          label="Plan"
          name="plan"
          options={plans}
        />
      </form>
    );
    const { rerender } = render(fields());
    rerender(fields("l", 2));

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    act(() => form.reset());

    expect(formEntries(form)).toEqual({ plan: "2", size: "l" });
    expect(screen.getByRole("radio", { name: "Team" })).toBeChecked();
  });

  it("leave an edited select alone when its defaultValue changes", async () => {
    const user = userEvent.setup();
    const field = (size: string) => (
      <form aria-label="Order">
        <Select defaultValue={size} label="Size" name="size" options={sizes} />
      </form>
    );
    const { rerender } = render(field("m"));
    const select = screen.getByRole("combobox", { name: /Size/ });

    await user.selectOptions(select, "l");
    rerender(field("s"));
    expect(select).toHaveValue("l");

    act(() => screen.getByRole<HTMLFormElement>("form").reset());
    expect(select).toHaveValue("s");
  });

  // A state update of `onReset` renders before the event reaches the
  // document - in a browser a clicked reset button gets a microtask
  // checkpoint after each listener; flushSync stands in for it. The render
  // gives the fields a new ref, which watches the form anew.
  it("reset fields rendered with a new ref while the reset is on its way", async () => {
    const user = userEvent.setup();

    function Page() {
      const [resets, setResets] = useState(0);
      // An inline callback ref - a new one at every render
      const ref = (element: HTMLInputElement | null) =>
        void (element && resets);
      return (
        <form
          aria-label="Order"
          onReset={() => flushSync(() => setResets((count) => count + 1))}
        >
          <output>{resets}</output>
          <Input defaultValue="a" label="Name" ref={ref} />
          <NumberInput defaultValue={1} label="Count" ref={ref} />
          <TagsInput defaultValue={["x"]} label="Tags" ref={ref} />
          <button type="reset">Reset</button>
        </form>
      );
    }

    render(<Page />);
    const name = screen.getByRole("textbox", { name: /Name/ });
    const count = screen.getByRole("spinbutton", { name: /Count/ });
    await user.type(name, "b");
    await user.clear(count);
    await user.type(count, "5");
    await user.type(screen.getByRole("textbox", { name: /Tags/ }), "y{Enter}");
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("status")).toHaveTextContent("1");
    expect(name).toHaveValue("a");
    expect(count).toHaveValue("1");
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(1);
  });

  it("reset a field rendered anew after a listener stopped the reset", async () => {
    const user = userEvent.setup();

    function Page() {
      const [resets, setResets] = useState(0);
      return (
        <form
          aria-label="Order"
          onReset={(event) => {
            event.stopPropagation();
            setResets((count) => count + 1);
          }}
        >
          <Input
            defaultValue="a"
            label="Name"
            ref={(element) => void (element && resets)}
          />
        </form>
      );
    }

    render(<Page />);
    const name = screen.getByRole("textbox", { name: /Name/ });
    await user.type(name, "b");

    act(() => screen.getByRole<HTMLFormElement>("form").reset());
    // Settled a task later - the event never reached the document
    await waitFor(() => expect(name).toHaveValue("a"));
  });

  it("reset, or leave alone when canceled, fields in a shadow root", async () => {
    for (const portal of [false, true]) {
      for (const cancel of [false, true]) {
        const host = document.createElement("div");
        document.body.append(host);
        const shadow = host.attachShadow({ mode: "open" });
        const container = document.createElement("div");
        (portal ? document.body : shadow).append(container);
        const form = (
          <form onReset={(event) => cancel && event.preventDefault()}>
            <Input defaultValue="a" label="Name" />
          </form>
        );
        const root = createRoot(container);
        act(() => root.render(portal ? createPortal(form, shadow) : form));

        const input = shadow.querySelector("input")!;
        act(() => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )!.set!.call(input, "ab");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        act(() => shadow.querySelector("form")!.reset());
        await act(() => new Promise((resolve) => setTimeout(resolve, 5)));

        expect(input.value).toBe(cancel ? "ab" : "a");
        act(() => root.unmount());
        host.remove();
        container.remove();
      }
    }
  });

  it("leave every field alone when a listener cancels the reset", async () => {
    const user = userEvent.setup();
    const cities = [
      { label: "Praha", value: "praha" },
      { label: "Brno", value: "brno" },
    ];
    render(
      // "Discard your changes?" - Cancel
      <form aria-label="Order" onReset={(event) => event.preventDefault()}>
        <input aria-label="Native" defaultValue="a" name="native" />
        <Input defaultValue="a" label="Name" name="name" />
        <Select defaultValue="m" label="Size" name="size" options={sizes} />
        <RadioGroup defaultValue={1} label="Plan" name="plan" options={plans} />
        <SegmentedControl
          aria-label="Period"
          defaultValue="s"
          name="period"
          options={sizes}
        />
        <CheckboxGroup label="Extras" name="extras" options={sizes} />
        <Autocomplete
          asSelect
          defaultValue="praha"
          label="City"
          name="city"
          options={cities}
        />
        <button type="reset">Reset</button>
      </form>,
    );

    await user.type(screen.getByRole("textbox", { name: "Native" }), "b");
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "b");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Size/ }),
      "l",
    );
    await user.click(screen.getByRole("radio", { name: "Team" }));
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Period" })).getByRole(
        "radio",
        { name: "Large" },
      ),
    );
    await user.click(screen.getByRole("checkbox", { name: "Small" }));
    await user.click(screen.getByRole("combobox", { name: /City/ }));
    await user.click(screen.getByRole("option", { name: "Brno" }));

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    const edited = formEntries(form);
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(formEntries(form)).toEqual(edited);
    expect(edited).toEqual({
      city: "brno",
      extras: "s",
      name: "ab",
      native: "ab",
      period: "l",
      plan: "2",
      size: "l",
    });
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("ab");
  });

  it("leave controlled fields showing their value", async () => {
    const user = userEvent.setup();

    function Order() {
      const [size, setSize] = useState("m");
      const [plan, setPlan] = useState(2);
      return (
        <form aria-label="Order">
          <Select
            label="Size"
            name="size"
            onChange={(event) => setSize(event.target.value)}
            options={sizes}
            value={size}
          />
          <RadioGroup
            label="Plan"
            name="plan"
            onChange={(event) => setPlan(Number(event.target.value))}
            options={plans}
            value={plan}
          />
        </form>
      );
    }

    render(<Order />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Size/ }),
      "l",
    );
    await user.click(screen.getByRole("radio", { name: "Free" }));

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    act(() => form.reset());

    expect(formEntries(form)).toEqual({ plan: "1", size: "l" });
    expect(screen.getByRole("radio", { name: "Free" })).toBeChecked();
  });

  it("after a form action leave controlled fields showing their value", async () => {
    const user = userEvent.setup();
    const action = vi.fn();

    function Settings() {
      const [size, setSize] = useState("m");
      const [terms, setTerms] = useState(false);
      const [notify, setNotify] = useState(true);
      return (
        <form action={action}>
          <Select
            label="Size"
            name="size"
            onChange={(event) => setSize(event.target.value)}
            options={sizes}
            value={size}
          />
          <Checkbox
            checked={terms}
            label="Terms"
            name="terms"
            onChange={(event) => setTerms(event.target.checked)}
          />
          <Switch
            checked={notify}
            label="Notify"
            name="notify"
            onChange={(event) => setNotify(event.target.checked)}
          />
          <button type="submit">Save</button>
        </form>
      );
    }

    render(<Settings />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Size/ }),
      "l",
    );
    // One was unchecked when it mounted, the other one checked
    await user.click(screen.getByRole("checkbox", { name: "Terms" }));
    await user.click(screen.getByRole("switch", { name: "Notify" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));

    expect(Object.fromEntries(action.mock.calls[1][0])).toEqual({
      size: "l",
      terms: "on",
    });
    expect(screen.getByRole("combobox", { name: /Size/ })).toHaveValue("l");
    expect(screen.getByRole("checkbox", { name: "Terms" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Notify" })).not.toBeChecked();
  });
});

describe("Field details", () => {
  it("give a multiple select without a defaultValue an array", () => {
    const consoleError = vi.spyOn(console, "error");
    render(<Select label="Sizes" multiple options={sizes} />);

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("leave the generated name of a RadioGroup out of the form data", () => {
    render(
      <form aria-label="Order">
        <RadioGroup defaultValue={1} label="Plan" options={plans} />
        <RadioGroup
          defaultValue={2}
          label="Billing"
          name="billing"
          options={plans}
        />
      </form>,
    );

    // jsdom builds a FormData without firing the event browsers fire
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    const formData = new FormData(form);
    form.dispatchEvent(Object.assign(new Event("formdata"), { formData }));

    expect([...formData.entries()]).toEqual([["billing", "2"]]);
  });

  it("marks a labelled RadioGroup as an invalid, required radiogroup", () => {
    render(
      <RadioGroup error="Pick a plan" label="Plan" options={plans} required />,
    );

    const group = screen.getByRole("radiogroup", { name: "Plan:" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("aria-required", "true");
    expect(group).toHaveAccessibleDescription("Pick a plan");
  });

  it("keep the required star out of the accessible names", () => {
    render(
      <>
        <Input label="Name" required />
        <Input floating label="City" required />
        <Textarea label="Note" required />
        <Select label="Size" options={sizes} required />
        <RadioGroup label="Plan" options={plans} required />
        <Checkbox label="Terms" required />
        <Switch label="Notify" required />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Name:" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "City" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "Note:" })).toBeRequired();
    expect(screen.getByRole("combobox", { name: "Size:" })).toBeRequired();
    expect(screen.getByRole("radiogroup", { name: "Plan:" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Terms" })).toBeRequired();
    expect(screen.getByRole("switch", { name: "Notify" })).toBeRequired();
  });

  it("names the empty option of a Select", () => {
    render(<Select hasEmpty label="Size" options={sizes} />);

    expect(
      screen.getByRole("option", { name: "No selection" }),
    ).toHaveTextContent("");
  });

  it("shows the error of a Switch on its track", () => {
    const { container } = render(<Switch error="Required" label="Notify" />);

    const track = container.querySelector("[aria-hidden=true]");
    expect(track).toHaveClass("ring-1", "ring-danger-500");
    // The keyboard focus is an outline apart from that ring - not the same
    // ring a pixel wider
    expect(track).toHaveClass(
      "peer-focus-visible:outline-2",
      "peer-focus-visible:outline-offset-2",
    );
    expect(track).not.toHaveClass("peer-focus-visible:ring-2");
  });

  it("colors the labels of invalid fields with the error color only", () => {
    render(
      <>
        <Switch error="Required" label="Notify" />
        <Input error="Required" floating label="City" />
        <Textarea error="Required" floating label="Note" />
      </>,
    );

    // With a neutral color next to it, the CSS order would pick that one
    for (const text of ["Notify", "City", "Note"]) {
      const label = screen.getByText(text);
      expect(label).toHaveClass("text-danger-700");
      expect(label.className).not.toMatch(/text-neutral/);
    }
  });
});

describe("Floating labels", () => {
  it("float over the format a date or time field shows while empty", () => {
    render(
      <>
        <Input floating label="Day" type="date" />
        <Input floating label="Start" type="time" />
        <Input floating label="Name" />
      </>,
    );

    expect(screen.getByText("Day")).toHaveClass("text-xs");
    expect(screen.getByText("Start")).toHaveClass("text-xs");
    expect(screen.getByText("Name")).not.toHaveClass("text-xs");
  });

  it("float over a value the browser autofilled", () => {
    render(
      <>
        <Input floating label="Email" />
        <Textarea floating label="Address" />
      </>,
    );

    // Autofill changes no value React would see - only `:autofill` says it
    expect(screen.getByText("Email")).toHaveClass(
      "[&:has(~input:autofill)]:text-xs",
      "[&:has(~input:autofill)]:translate-y-[-0.7rem]",
    );
    expect(screen.getByText("Address")).toHaveClass(
      "[&:has(~textarea:autofill)]:text-xs",
      "[&:has(~textarea:autofill)]:translate-y-[-0.7rem]",
    );
  });
});

describe("Extra small fields", () => {
  it("are sized like an extra small Select", () => {
    render(
      <>
        <Input dim="xs" label="Input" />
        <Textarea dim="xs" label="Note" />
        <Select dim="xs" label="Size" options={sizes} />
      </>,
    );

    for (const field of [
      screen.getByRole("textbox", { name: /Input/ }),
      screen.getByRole("textbox", { name: /Note/ }),
      screen.getByRole("combobox", { name: /Size/ }),
    ]) {
      expect(field).toHaveClass("px-1", "py-0.5", "text-sm");
    }
  });
});

describe("RadioGroup props", () => {
  it("puts id, ref and aria-describedby on the group", () => {
    const ref = createRef<HTMLElement>();
    render(
      <>
        <p id="size-hint">Pick one</p>
        <RadioGroup
          aria-describedby="size-hint"
          error="Required"
          id="size"
          label="Size"
          name="size"
          options={sizes}
          ref={ref}
        />
      </>,
    );

    const group = screen.getByRole("radiogroup", { name: /Size/ });
    expect(ref.current).toBe(group);
    expect(group).toHaveAttribute("id", "size");
    expect(group).toHaveAccessibleDescription("Required Pick one");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "size-error");
  });

  it("gives two groups of the same name different error ids", () => {
    render(
      <>
        <RadioGroup error="A" label="First" name="size" options={sizes} />
        <RadioGroup error="B" label="Second" name="size" options={sizes} />
      </>,
    );

    const [first, second] = screen.getAllByRole("alert");
    expect(first.id).not.toBe(second.id);
    expect(
      screen.getByRole("radiogroup", { name: /First/ }),
    ).toHaveAccessibleDescription("A");
  });

  it("reports the focus and blur of its radios", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    render(
      <>
        <RadioGroup
          label="Size"
          name="size"
          onBlur={onBlur}
          onFocus={onFocus}
          options={sizes}
        />
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus.mock.calls[0][0].target).toHaveAttribute("name", "size");

    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("Switch names", () => {
  it("keep the consumer's aria-labelledby next to the label", () => {
    render(
      <>
        <span id="section">Email</span>
        <Switch aria-labelledby="section" label="Notify" />
      </>,
    );

    expect(screen.getByRole("switch")).toHaveAccessibleName("Notify Email");
  });
});

describe("The description of a field", () => {
  it("describes it after the error, before the caller's description", () => {
    render(
      <>
        <p id="hint">Hint</p>
        <Input
          aria-describedby="hint"
          description="Help"
          error="Bad"
          label="Name"
        />
        <Input
          aria-describedby="hint"
          description="Help"
          error="Bad"
          floating
          label="City"
        />
        <Textarea
          aria-describedby="hint"
          description="Help"
          error="Bad"
          label="Note"
        />
        <Select
          aria-describedby="hint"
          description="Help"
          error="Bad"
          label="Size"
          options={sizes}
        />
        <Switch
          aria-describedby="hint"
          description="Help"
          error="Bad"
          label="Notify"
        />
        <RadioGroup
          aria-describedby="hint"
          description="Help"
          error="Bad"
          label="Plan"
          options={plans}
        />
        <Autocomplete
          aria-describedby="hint"
          description="Help"
          error="Bad"
          label="Owner"
          options={sizes}
        />
      </>,
    );

    for (const field of [
      screen.getByRole("textbox", { name: /Name/ }),
      screen.getByRole("textbox", { name: /City/ }),
      screen.getByRole("textbox", { name: /Note/ }),
      screen.getByRole("combobox", { name: /Size/ }),
      screen.getByRole("switch", { name: /Notify/ }),
      screen.getByRole("radiogroup", { name: /Plan/ }),
      screen.getByRole("combobox", { name: /Owner/ }),
    ]) {
      expect(field).toHaveAccessibleDescription("Bad Help Hint");
    }
  });

  it("renders under the field and above the error, with an id from the field's", () => {
    render(
      <Input
        description={
          <>
            Also <b>bold</b>
          </>
        }
        error="Bad"
        id="name"
        label="Name"
      />,
    );

    const description = screen.getByText(/Also/);
    expect(description).toHaveAttribute("id", "name-description");
    expect(description.compareDocumentPosition(screen.getByRole("alert"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen.getByRole("textbox").compareDocumentPosition(description),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("is left out of aria-describedby without one", () => {
    render(<Input label="Name" />);

    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
  });
});

describe("Select groups", () => {
  it("renders option groups and disabled options, with the empty option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        hasEmpty
        label="Warehouse"
        onChange={(event) => onChange(event.target.value)}
        options={[
          { label: "Central", value: "central" },
          {
            label: "Czechia",
            options: [
              { label: "Prague", value: "prg" },
              { disabled: true, label: "Brno (closed)", value: "brq" },
            ],
          },
          {
            disabled: true,
            label: "Slovakia",
            options: [{ label: "Bratislava", value: "bts" }],
          },
        ]}
      />,
    );

    const czechia = screen.getByRole("group", { name: "Czechia" });
    expect(czechia.tagName).toBe("OPTGROUP");
    expect(
      screen.getByRole("option", { name: "Brno (closed)" }),
    ).toBeDisabled();
    expect(screen.getByRole("group", { name: "Slovakia" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "No selection" })).toBeVisible();

    await user.selectOptions(screen.getByRole("combobox"), "prg");
    expect(onChange).toHaveBeenCalledWith("prg");
  });

  it("brings back a grouped defaultValue on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <Select
          defaultValue="prg"
          label="Warehouse"
          name="warehouse"
          options={[
            { label: "Czechia", options: [{ label: "Prague", value: "prg" }] },
            { label: "Slovakia", options: [{ label: "Košice", value: "kse" }] },
          ]}
        />
        <button type="reset">Reset</button>
      </form>,
    );

    await user.selectOptions(screen.getByRole("combobox"), "kse");
    await user.click(screen.getByRole("button", { name: "Reset" }));

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(Object.fromEntries(new FormData(form))).toEqual({
      warehouse: "prg",
    });
  });
});

describe("RadioGroup options", () => {
  it("can be disabled and described one by one", async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup
        label="Shipping"
        name="shipping"
        options={[
          {
            description: "2 - 3 business days",
            label: "Standard",
            value: "standard",
          },
          {
            description: "Next business day",
            label: "Express",
            value: "express",
          },
          { disabled: true, label: "Pickup (unavailable)", value: "pickup" },
        ]}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "Standard" }),
    ).toHaveAccessibleDescription("2 - 3 business days");
    expect(
      screen.getByRole("radio", { name: "Pickup (unavailable)" }),
    ).toBeDisabled();

    // A click on the description picks the option too
    await user.click(screen.getByText("Next business day"));
    expect(screen.getByRole("radio", { name: "Express" })).toBeChecked();

    // The arrow keys skip the disabled option
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Standard" })).toBeChecked();
  });

  it("are laid out in a row with a horizontal orientation", () => {
    render(
      <>
        <RadioGroup label="Row" options={plans} orientation="horizontal" />
        <RadioGroup label="Column" options={plans} />
      </>,
    );

    const optionsOf = (name: RegExp) =>
      within(screen.getByRole("radiogroup", { name }))
        .getByRole("radio", { name: "Free" })
        .closest("label")!.parentElement;
    expect(optionsOf(/Row/)).toHaveClass("flex-row", "flex-wrap");
    expect(optionsOf(/Column/)).toHaveClass("flex-col");
  });
});

describe("Structural padding and className", () => {
  it("keeps the room for icons and labels when className sets the padding", () => {
    const select = render(
      <Select className="px-3" options={[{ label: "A", value: "a" }]} />,
    );
    expect(screen.getByRole("combobox")).toHaveClass("px-3", "pr-8");
    select.unmount();

    const input = render(<Input className="py-3" floating label="Name" />);
    expect(screen.getByLabelText("Name")).toHaveClass("py-3", "pt-2");
    input.unmount();

    render(<DateTimePicker className="px-3" />);
    expect(screen.getByRole("combobox")).toHaveClass("px-3", "pr-8");
  });
});
