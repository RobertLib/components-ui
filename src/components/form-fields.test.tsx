import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "./checkbox";
import DateTimePicker from "./datetime-picker";
import Input from "./input";
import RadioGroup from "./radio-group";
import Select from "./select";
import Switch from "./switch";
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

  it("passes its ref to the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Name" ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("textbox", { name: /Name/ }));
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
