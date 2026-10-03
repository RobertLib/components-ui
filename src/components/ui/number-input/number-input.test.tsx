import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NumberInput from ".";
import { cs } from "../../../i18n/ui/cs";
import { en } from "../../../i18n/ui/en";
import UIProvider from "../../../providers/ui-provider";

const spinbutton = (name: RegExp | string = /Quantity/) =>
  screen.getByRole<HTMLInputElement>("spinbutton", { name });

afterEach(() => {
  vi.useRealTimers();
});

describe("NumberInput", () => {
  it("is a spinbutton with its value, bounds and formatted text", () => {
    render(
      <NumberInput defaultValue={1234.5} label="Quantity" max={5000} min={0} />,
    );

    const input = spinbutton();
    expect(input).toHaveValue("1,234.5");
    expect(input).toHaveAttribute("aria-valuenow", "1234.5");
    expect(input).toHaveAttribute("aria-valuemin", "0");
    expect(input).toHaveAttribute("aria-valuemax", "5000");
    expect(input).toHaveAttribute("aria-valuetext", "1,234.5");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveAttribute("type", "text");
  });

  it("writes and reads numbers as the locale does", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <NumberInput
          defaultValue={1234.5}
          label="Množství"
          onChange={onChange}
        />
      </UIProvider>,
    );

    const input = spinbutton(/Množství/);
    expect(input).toHaveValue("1\u00a0234,5");

    // Edited without grouping
    await user.click(input);
    expect(input).toHaveValue("1234,5");

    await user.clear(input);
    await user.type(input, "2,75");
    expect(onChange).toHaveBeenLastCalledWith(2.75);

    // A dot is a decimal separator too - Czech groups with spaces
    await user.clear(input);
    await user.type(input, "1.5");
    expect(onChange).toHaveBeenLastCalledWith(1.5);

    await user.tab();
    expect(input).toHaveValue("1,5");
  });

  it.each([en, cs])(
    "pastes a singular unit in $code and submits its number",
    async (locale) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const formatOptions: Intl.NumberFormatOptions = {
        style: "unit",
        unit: "meter",
        unitDisplay: "long",
      };
      render(
        <UIProvider locale={locale}>
          <form aria-label="Measurement">
            <NumberInput
              label="Quantity"
              name="length"
              formatOptions={formatOptions}
              onChange={onChange}
            />
          </form>
        </UIProvider>,
      );
      await user.click(spinbutton());
      await user.paste(
        new Intl.NumberFormat(locale.code, formatOptions).format(1),
      );
      await user.tab();
      expect(onChange).toHaveBeenLastCalledWith(1);
      expect(spinbutton()).toHaveAttribute("aria-valuenow", "1");
      const form = screen.getByRole<HTMLFormElement>("form", {
        name: "Measurement",
      });
      expect(new FormData(form).get("length")).toBe("1");
    },
  );

  it("refuses characters that make no number, keeping the caret", async () => {
    const user = userEvent.setup();
    render(<NumberInput defaultValue={12} label="Quantity" />);

    const input = spinbutton();
    await user.click(input);
    input.setSelectionRange(1, 1);
    await user.keyboard("x");

    expect(input).toHaveValue("12");
    expect(input.selectionStart).toBe(1);
  });

  it("submits a pasted Persian accounting amount with its negative sign", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const formatOptions: Intl.NumberFormatOptions = {
      currency: "USD",
      currencySign: "accounting",
      style: "currency",
    };
    render(
      <UIProvider locale={{ ...en, code: "fa-IR" }}>
        <form aria-label="Payment">
          <NumberInput
            formatOptions={formatOptions}
            label="Quantity"
            name="amount"
            onChange={onChange}
          />
        </form>
      </UIProvider>,
    );
    await user.click(spinbutton());
    await user.paste(
      new Intl.NumberFormat("fa-IR", formatOptions).format(-1234.5),
    );
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(-1234.5);
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "-1234.5");
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Payment" });
    expect(new FormData(form).get("amount")).toBe("-1234.5");
  });

  it("refuses a minus sign above a min of 0 and a separator of whole numbers", async () => {
    const user = userEvent.setup();
    render(<NumberInput label="Quantity" maximumFractionDigits={0} min={0} />);

    const input = spinbutton();
    await user.type(input, "-1.5");

    expect(input).toHaveValue("15");
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("steps with the arrow keys, Page Up / Down and Home / End", async () => {
    const user = userEvent.setup();
    render(<NumberInput defaultValue={5} label="Quantity" max={50} min={1} />);

    const input = spinbutton();
    await user.click(input);

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-valuenow", "6");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute("aria-valuenow", "4");
    await user.keyboard("{PageUp}");
    expect(input).toHaveAttribute("aria-valuenow", "14");
    await user.keyboard("{PageDown}{PageDown}");
    expect(input).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{End}");
    expect(input).toHaveAttribute("aria-valuenow", "50");
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-valuenow", "50");
    await user.keyboard("{Home}");
    expect(input).toHaveAttribute("aria-valuenow", "1");
    expect(input).toHaveValue("1");
  });

  it("steps from a typed text and on the grid of the step", async () => {
    const user = userEvent.setup();
    render(<NumberInput label="Quantity" step={0.5} />);

    const input = spinbutton();
    await user.type(input, "1.2");
    await user.keyboard("{ArrowUp}");

    expect(input).toHaveValue("1.5");
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("2");
  });

  it("leaves Home and End to the caret without bounds", async () => {
    const user = userEvent.setup();
    render(<NumberInput defaultValue={123} label="Quantity" />);

    const input = spinbutton();
    await user.click(input);
    await user.keyboard("{Home}");

    expect(input).toHaveValue("123");
    expect(input.selectionStart).toBe(0);
  });

  it("moves a typed value into min - max when it loses the focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput label="Quantity" max={100} min={10} onChange={onChange} />,
    );

    const input = spinbutton();
    await user.type(input, "150");
    expect(onChange).toHaveBeenLastCalledWith(150);

    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(100);
    expect(input).toHaveValue("100");

    await user.clear(input);
    await user.type(input, "5");
    await user.tab();
    expect(input).toHaveValue("10");
  });

  it("rounds to the fraction digits of the format", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        label="Quantity"
        maximumFractionDigits={2}
        onChange={onChange}
      />,
    );

    const input = spinbutton();
    await user.type(input, "3.14159");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(3.14);
    expect(input).toHaveValue("3.14");
  });

  it("submits and reports the value rounded with formatOptions", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <form aria-label="Payment">
          <NumberInput
            formatOptions={{ maximumFractionDigits: 2, roundingMode: "trunc" }}
            label="Quantity"
            name="quantity"
            onChange={onChange}
          />
        </form>
      </UIProvider>,
    );

    const input = spinbutton();
    await user.type(input, "1,239");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(1.23);
    expect(input).toHaveValue("1,23");
    expect(
      new FormData(screen.getByRole("form", { name: "Payment" })).get(
        "quantity",
      ),
    ).toBe("1.23");
  });

  it.each(["defaultValue", "value"] as const)(
    "submits %s at the precision shown, before and after focusing",
    async (valueProp) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <form aria-label="Payment">
          <NumberInput
            {...{ [valueProp]: 1.239 }}
            label="Quantity"
            maximumFractionDigits={2}
            name="quantity"
            onChange={onChange}
          />
        </form>,
      );

      const form = screen.getByRole<HTMLFormElement>("form");
      const input = spinbutton();
      expect(input).toHaveValue("1.24");
      expect(input).toHaveAttribute("aria-valuenow", "1.24");
      expect(new FormData(form).get("quantity")).toBe("1.24");

      await user.click(input);
      expect(input).toHaveValue("1.24");
      await user.tab();
      expect(new FormData(form).get("quantity")).toBe("1.24");
      // Showing a supplied value is not a user edit.
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("uses the current format for changed controlled values", () => {
    const field = (
      value: number,
      roundingMode: Intl.NumberFormatOptions["roundingMode"],
    ) => (
      <form aria-label="Payment">
        <NumberInput
          formatOptions={{ maximumFractionDigits: 2, roundingMode }}
          label="Quantity"
          name="quantity"
          value={value}
        />
      </form>
    );
    const { rerender } = render(field(1.239, "halfExpand"));
    const form = screen.getByRole<HTMLFormElement>("form");

    rerender(field(2.345, "halfExpand"));
    expect(spinbutton()).toHaveValue("2.35");
    expect(new FormData(form).get("quantity")).toBe("2.35");

    rerender(field(2.345, "trunc"));
    expect(spinbutton()).toHaveValue("2.34");
    expect(new FormData(form).get("quantity")).toBe("2.34");
  });

  it("rounds a restored defaultValue with the current precision after reset", async () => {
    const user = userEvent.setup();
    const field = (maximumFractionDigits: number) => (
      <form aria-label="Payment">
        <NumberInput
          defaultValue={1.239}
          label="Quantity"
          maximumFractionDigits={maximumFractionDigits}
          name="quantity"
        />
        <button type="reset">Reset</button>
      </form>
    );
    const { rerender } = render(field(3));
    const form = screen.getByRole<HTMLFormElement>("form");
    const input = spinbutton();
    await user.clear(input);
    await user.type(input, "2.567");
    await user.tab();

    rerender(field(2));
    expect(input).toHaveValue("2.57");
    expect(new FormData(form).get("quantity")).toBe("2.57");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("1.24");
    expect(new FormData(form).get("quantity")).toBe("1.24");
  });

  it.each([
    { defaultValue: 10.001, max: 10, min: undefined },
    { defaultValue: 9.999, max: undefined, min: 10 },
  ])(
    "keeps a supplied out-of-range $defaultValue invalid after rounding",
    async (bounds) => {
      const user = userEvent.setup();
      render(
        <form aria-label="Payment">
          <NumberInput
            {...bounds}
            label="Quantity"
            maximumFractionDigits={2}
            name="quantity"
          />
        </form>,
      );
      const form = screen.getByRole<HTMLFormElement>("form");
      const input = spinbutton();
      expect(input).toHaveValue("10");
      expect(new FormData(form).get("quantity")).toBe("10");
      expect(form.checkValidity()).toBe(false);

      // An explicit edit to the displayed boundary corrects the supplied
      // value, even though the rounded number itself has not changed.
      fireEvent.change(input, { target: { value: "10.00" } });
      await user.tab();
      expect(form.checkValidity()).toBe(true);
      expect(new FormData(form).get("quantity")).toBe("10");
    },
  );

  it.each([
    { max: 1.239, min: undefined, key: "ArrowDown", text: "2" },
    { max: undefined, min: 1.231, key: "ArrowUp", text: "0" },
  ])(
    "does not step or clamp to a boundary that rounds out of range ($key)",
    async ({ key, text, ...bounds }) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <form aria-label="Payment">
          <NumberInput
            {...bounds}
            label="Quantity"
            maximumFractionDigits={2}
            name="quantity"
            onChange={onChange}
          />
        </form>,
      );
      const form = screen.getByRole<HTMLFormElement>("form");
      const input = spinbutton();
      await user.click(input);
      await user.keyboard(`{${key}}`);
      expect(input).toHaveValue("");
      expect(onChange).not.toHaveBeenCalled();

      await user.type(input, text);
      await user.tab();
      expect(input).toHaveValue(text);
      expect(new FormData(form).get("quantity")).toBe(text);
      expect(form.checkValidity()).toBe(false);
      expect(onChange).toHaveBeenLastCalledWith(Number(text));
    },
  );

  it.each([en, cs])(
    "types and submits fractions with compact and significant precision in $code",
    async (locale) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const formats: Intl.NumberFormatOptions[] = [
        { notation: "compact" },
        {
          maximumFractionDigits: 0,
          maximumSignificantDigits: 3,
          roundingPriority: "morePrecision",
        },
      ];
      render(
        <UIProvider locale={locale}>
          <form aria-label="Measurement">
            {formats.map((formatOptions, index) => (
              <NumberInput
                key={index}
                label={`Quantity ${index}`}
                name={`quantity${index}`}
                formatOptions={formatOptions}
                onChange={onChange}
              />
            ))}
          </form>
        </UIProvider>,
      );
      const text = locale === cs ? "1,5" : "1.5";
      for (const index of [0, 1]) {
        const input = spinbutton(`Quantity ${index}:`);
        expect(input).toHaveAttribute("inputmode", "decimal");
        await user.type(input, text);
        await user.tab();
        expect(input).toHaveValue(text);
        expect(input).toHaveAttribute("aria-valuenow", "1.5");
        expect(onChange).toHaveBeenLastCalledWith(1.5);
        expect(
          new FormData(screen.getByRole<HTMLFormElement>("form")).get(
            `quantity${index}`,
          ),
        ).toBe("1.5");
      }
    },
  );

  it("keeps all the digits of a long number", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Payment">
        <NumberInput label="Quantity" name="quantity" onChange={onChange} />
      </form>,
    );

    const input = spinbutton();
    await user.type(input, "1234567890123456");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(1234567890123456);
    expect(input).toHaveValue("1,234,567,890,123,456");
    expect(
      new FormData(screen.getByRole("form", { name: "Payment" })).get(
        "quantity",
      ),
    ).toBe("1234567890123456");
  });

  it("submits a fraction smaller than twenty decimal places as shown", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const text = "0.000000000000000000001";
    render(
      <form aria-label="Measurement">
        <NumberInput
          label="Quantity"
          name="quantity"
          maximumFractionDigits={30}
          onChange={onChange}
        />
      </form>,
    );
    await user.click(spinbutton());
    await user.paste(text);
    await user.tab();
    expect(spinbutton()).toHaveValue(text);
    expect(onChange).toHaveBeenLastCalledWith(1e-21);
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).get("quantity"),
    ).toBe(text);
  });

  it.each(["scientific", "engineering"] as const)(
    "keeps a small %s number when focusing and editing it",
    async (notation) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <NumberInput
          label="Quantity"
          defaultValue={0.0001}
          formatOptions={{ notation }}
          onChange={onChange}
        />,
      );
      const input = spinbutton();
      expect(input).toHaveValue(notation === "scientific" ? "1E-4" : "100E-6");
      await user.click(input);
      expect(input).toHaveValue("0.0001");
      expect(onChange).not.toHaveBeenCalled();
      await user.keyboard("{End}2");
      expect(onChange).toHaveBeenLastCalledWith(0.00012);
      await user.tab();
      expect(input).toHaveValue(
        notation === "scientific" ? "1.2E-4" : "120E-6",
      );
    },
  );

  it("types a percentage as the percent number", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <NumberInput
          formatOptions={{ style: "percent" }}
          label="Sleva"
          onChange={onChange}
        />
      </UIProvider>,
    );

    const input = spinbutton(/Sleva/);
    await user.type(input, "25");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(0.25);
    expect(input).toHaveValue("25\u00a0%");
  });

  it.each(["defaultValue", "value"] as const)(
    "submits and edits a finite overflowing percentage supplied through %s",
    async (valueProp) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const value = 1e307;
      const options = { style: "percent" } as const;
      function Field() {
        const [current, setCurrent] = useState<number | null>(value);
        return (
          <form aria-label="Percentage">
            <NumberInput
              {...{ [valueProp]: current }}
              formatOptions={options}
              label="Percentage"
              name="percentage"
              onChange={(next) => {
                onChange(next);
                setCurrent(next);
              }}
            />
          </form>
        );
      }
      render(<Field />);

      const input = spinbutton(/Percentage/);
      const form = screen.getByRole<HTMLFormElement>("form");
      const submitted = () => new FormData(form).get("percentage");
      expect(input).toHaveValue(
        new Intl.NumberFormat("en-US", options).format(value),
      );
      expect(Number(submitted())).toBe(value);
      await user.click(input);
      const editText = input.value;
      expect(editText).not.toContain("∞");
      expect(onChange).not.toHaveBeenCalled();
      // Editing the displayed percent number must keep a finite fraction,
      // even though Number(editText) itself would overflow.
      fireEvent.change(input, { target: { value: `2${editText.slice(1)}` } });
      await user.tab();
      expect(Number(submitted())).toBe(2e307);
      expect(form.checkValidity()).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith(2e307);
    },
  );

  it("formats a currency and gives the canonical value to the form", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <form aria-label="Invoice">
          <NumberInput
            defaultValue={1234.5}
            formatOptions={{ currency: "CZK", style: "currency" }}
            label="Cena"
            name="price"
          />
        </form>
      </UIProvider>,
    );

    const input = spinbutton(/Cena/);
    expect(input).toHaveValue("1\u00a0234,50\u00a0Kč");
    expect(input).not.toHaveAttribute("name");

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Invoice" });
    expect(Object.fromEntries(new FormData(form))).toEqual({ price: "1234.5" });

    await user.click(input);
    expect(input).toHaveValue("1234,50");
    await user.clear(input);
    await user.type(input, "99,9");
    expect(Object.fromEntries(new FormData(form))).toEqual({ price: "99.9" });
  });

  it("brings back the defaultValue on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <NumberInput defaultValue={3} label="Quantity" name="quantity" />
        <button type="reset">Reset</button>
      </form>,
    );

    const input = spinbutton();
    await user.click(input);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(input).toHaveValue("5");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(input).toHaveValue("3");
    expect(Object.fromEntries(new FormData(form))).toEqual({ quantity: "3" });
  });

  it("keeps its value when a listener cancels the form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order" onReset={(event) => event.preventDefault()}>
        <NumberInput defaultValue={3} label="Quantity" name="quantity" />
        <button type="reset">Reset</button>
      </form>,
    );

    const input = spinbutton();
    await user.click(input);
    await user.keyboard("{ArrowUp}");
    await user.click(screen.getByRole("button", { name: "Reset" }));

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(input).toHaveValue("4");
    expect(Object.fromEntries(new FormData(form))).toEqual({ quantity: "4" });
  });

  it("submits the typed value moved into its bounds on Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      return Object.fromEntries(new FormData(event.currentTarget));
    });
    render(
      <form onSubmit={onSubmit}>
        <NumberInput label="Quantity" max={10} name="quantity" />
        <button type="submit">Save</button>
      </form>,
    );

    await user.type(spinbutton(), "25{Enter}");

    expect(onSubmit).toHaveReturnedWith({ quantity: "10" });
    expect(spinbutton()).toHaveValue("10");
  });

  it("submits an empty value for an empty field, and nothing while disabled", () => {
    const { rerender } = render(
      <form aria-label="Order">
        <NumberInput label="Quantity" name="quantity" />
      </form>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Order" });
    expect(Object.fromEntries(new FormData(form))).toEqual({ quantity: "" });

    rerender(
      <form aria-label="Order">
        <NumberInput
          defaultValue={2}
          disabled
          label="Quantity"
          name="quantity"
        />
      </form>,
    );
    expect(Object.fromEntries(new FormData(form))).toEqual({});
    expect(screen.getByRole("button", { name: "Increase" })).toBeDisabled();
  });

  it("works controlled - also when the parent refuses a value", async () => {
    const user = userEvent.setup();

    function Price() {
      const [price, setPrice] = useState<number | null>(10);
      return (
        <>
          <NumberInput
            label="Price"
            // Only up to 100
            onChange={(value) => {
              if (value === null || value <= 100) setPrice(value);
            }}
            value={price}
          />
          <output>{JSON.stringify(price)}</output>
          <button onClick={() => setPrice(42)} type="button">
            Set
          </button>
        </>
      );
    }

    render(<Price />);
    const input = spinbutton(/Price/);

    await user.clear(input);
    expect(screen.getByRole("status")).toHaveTextContent("null");
    await user.type(input, "55");
    expect(screen.getByRole("status")).toHaveTextContent("55");

    // 555 is refused - the field shows the parent's value
    await user.type(input, "5");
    expect(input).toHaveValue("55");

    await user.click(screen.getByRole("button", { name: "Set" }));
    expect(input).toHaveValue("42");
  });

  it("steps with the buttons, which stay out of the tab order", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <NumberInput defaultValue={1} label="Počet" max={2} min={0} />
      </UIProvider>,
    );

    const increase = screen.getByRole("button", { name: "Zvýšit" });
    const decrease = screen.getByRole("button", { name: "Snížit" });
    expect(increase).toHaveAttribute("tabindex", "-1");
    expect(increase).toHaveAttribute("aria-controls", spinbutton(/Počet/).id);

    await user.click(increase);
    expect(spinbutton(/Počet/)).toHaveAttribute("aria-valuenow", "2");
    // A mouse moves the focus into the field - and the press that reached
    // the bound keeps it there
    expect(spinbutton(/Počet/)).toHaveFocus();
    expect(increase).toHaveAttribute("aria-disabled", "true");

    await user.click(increase);
    expect(spinbutton(/Počet/)).toHaveAttribute("aria-valuenow", "2");

    await user.click(decrease);
    await user.click(decrease);
    expect(spinbutton(/Počet/)).toHaveAttribute("aria-valuenow", "0");
    expect(decrease).toHaveAttribute("aria-disabled", "true");
    expect(increase).not.toHaveAttribute("aria-disabled");
    expect(spinbutton(/Počet/)).toHaveFocus();
  });

  it("steps from a click of assistive technology", () => {
    render(<NumberInput defaultValue={1} label="Quantity" />);

    // A click without a press - a screen reader, the keyboard
    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "2");
  });

  it("repeats the step while a button is held", () => {
    vi.useFakeTimers();
    render(<NumberInput defaultValue={0} label="Quantity" max={100} />);

    const increase = screen.getByRole("button", { name: "Increase" });
    fireEvent.pointerDown(increase, { button: 0, pointerType: "mouse" });
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "1");

    // A pause, then quickly - the page renders between the steps
    act(() => vi.advanceTimersByTime(399));
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "1");
    act(() => vi.advanceTimersByTime(1));
    for (let tick = 0; tick < 3; tick++) {
      act(() => vi.advanceTimersByTime(60));
    }
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "5");

    // The click of the press, right after the release, steps no more
    fireEvent.pointerUp(document);
    fireEvent.click(increase);
    act(() => vi.advanceTimersByTime(1000));
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "5");
  });

  it("has no step buttons with hideStepper", () => {
    render(<NumberInput hideStepper label="Quantity" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ignores step buttons and keys in a disabled fieldset", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <fieldset disabled>
        <NumberInput
          defaultValue={5}
          label="Quantity"
          min={0}
          max={10}
          onChange={onChange}
        />
      </fieldset>,
    );

    const input = spinbutton();
    expect(input).toBeDisabled();
    // Browsers still deliver pointer events to disabled buttons.
    const increase = screen.getByRole("button", { name: "Increase" });
    fireEvent.pointerDown(increase, { button: 0, pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerUp(document);
    fireEvent.click(increase);
    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
    ]) {
      fireEvent.keyDown(input, { key });
    }

    expect(input).toHaveAttribute("aria-valuenow", "5");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops a held step when its fieldset becomes disabled without a render", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <fieldset>
        <NumberInput defaultValue={0} label="Quantity" onChange={onChange} />
      </fieldset>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Increase" }), {
      button: 0,
      pointerType: "mouse",
    });
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "1");
    const fieldset = spinbutton().closest("fieldset")!;
    fieldset.disabled = true;
    onChange.mockClear();
    act(() => vi.advanceTimersByTime(400));
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "1");
    expect(onChange).not.toHaveBeenCalled();

    fieldset.disabled = false;
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(document);
  });

  it("steps only fields in the disabled fieldset's first legend", () => {
    render(
      <fieldset disabled>
        <legend>
          <NumberInput defaultValue={1} label="First legend" />
        </legend>
        <legend>
          <NumberInput defaultValue={1} label="Second legend" />
        </legend>
      </fieldset>,
    );

    fireEvent.keyDown(spinbutton("First legend:"), { key: "ArrowUp" });
    fireEvent.keyDown(spinbutton("Second legend:"), { key: "ArrowUp" });
    expect(spinbutton("First legend:")).toHaveAttribute("aria-valuenow", "2");
    expect(spinbutton("Second legend:")).toHaveAttribute("aria-valuenow", "1");
  });

  it("leaves wheel scrolling alone after its fieldset is disabled", () => {
    const onChange = vi.fn();
    render(
      <fieldset>
        <NumberInput
          changeOnWheel
          defaultValue={5}
          label="Quantity"
          onChange={onChange}
        />
      </fieldset>,
    );

    const input = spinbutton();
    act(() => input.focus());
    input.closest("fieldset")!.disabled = true;
    expect(fireEvent.wheel(input, { deltaY: -100 })).toBe(true);
    expect(input).toHaveAttribute("aria-valuenow", "5");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("steps with the wheel only when asked to, and only with the focus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <NumberInput defaultValue={5} label="Quantity" />,
    );

    const input = spinbutton();
    await user.click(input);
    expect(fireEvent.wheel(input, { deltaY: -100 })).toBe(true);
    expect(input).toHaveAttribute("aria-valuenow", "5");

    rerender(<NumberInput changeOnWheel defaultValue={5} label="Quantity" />);
    // Not cancelled means the page scrolls
    expect(fireEvent.wheel(input, { deltaY: -100 })).toBe(false);
    expect(input).toHaveAttribute("aria-valuenow", "6");
    fireEvent.wheel(input, { deltaY: 100 });
    fireEvent.wheel(input, { deltaY: 100 });
    expect(input).toHaveAttribute("aria-valuenow", "4");

    await user.tab();
    expect(fireEvent.wheel(input, { deltaY: -100 })).toBe(true);
    expect(input).toHaveAttribute("aria-valuenow", "4");
  });

  it("steps on from a fast wheel's every event", () => {
    render(<NumberInput changeOnWheel defaultValue={5} label="Quantity" />);

    const input = spinbutton();
    act(() => input.focus());
    // Two events before React would render - each steps on from the last
    act(() => {
      input.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -100,
        }),
      );
      input.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -100,
        }),
      );
    });
    expect(input).toHaveAttribute("aria-valuenow", "7");
  });

  it("steps large values in small steps", async () => {
    const user = userEvent.setup();
    render(
      <NumberInput defaultValue={1000000.19} label="Quantity" step={0.01} />,
    );

    await user.click(spinbutton());
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "1000000.21");
    await user.keyboard("{ArrowDown}");
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "1000000.2");
  });

  it("keeps the fraction digits of a step finer than the format's", async () => {
    const user = userEvent.setup();
    render(<NumberInput defaultValue={0} label="Quantity" step={0.0001} />);

    await user.click(spinbutton());
    await user.keyboard("{ArrowUp}");
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "0.0001");
    expect(
      screen.getByRole("button", { name: "Increase" }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("leaves the keys of an input method editor alone", () => {
    const onChange = vi.fn();
    render(
      <NumberInput defaultValue={5} label="Quantity" onChange={onChange} />,
    );

    const input = spinbutton();
    input.focus();
    // The arrows pick a candidate of the IME while it composes text
    for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown"]) {
      fireEvent.keyDown(input, { isComposing: true, key });
    }
    fireEvent.keyDown(input, { key: "ArrowUp", keyCode: 229 });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-valuenow", "5");
  });

  it("edits a negative number of a language written right to left", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={{ ...en, code: "ar-EG" }}>
        <NumberInput defaultValue={-12} label="Quantity" onChange={onChange} />
      </UIProvider>,
    );

    const input = spinbutton();
    await user.click(input);
    input.setSelectionRange(input.value.length, input.value.length);
    await user.keyboard("3");
    expect(onChange).toHaveBeenLastCalledWith(-123);
  });

  it("never steps down going up - at a max off the grid of the steps", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        defaultValue={10}
        label="Quantity"
        max={10}
        min={0}
        onChange={onChange}
        step={3}
      />,
    );

    const increase = screen.getByRole("button", { name: "Increase" });
    expect(increase).toHaveAttribute("aria-disabled", "true");
    await user.click(spinbutton());
    await user.keyboard("{ArrowUp}");
    await user.click(increase);
    fireEvent.click(increase);
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "10");
    expect(onChange).not.toHaveBeenCalled();

    // 9 is the last step within max - a step up changes nothing there
    await user.keyboard("{ArrowDown}");
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "9");
    expect(increase).toHaveAttribute("aria-disabled", "true");
    await user.click(increase);
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "9");
  });

  it("steps a percentage by one percent", async () => {
    const user = userEvent.setup();
    render(
      <NumberInput
        defaultValue={0.21}
        formatOptions={{ style: "percent" }}
        label="Quantity"
      />,
    );

    await user.click(spinbutton());
    await user.keyboard("{ArrowUp}");
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "0.22");
    await user.keyboard("{PageDown}");
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "0.12");
  });

  it("makes the form invalid with a value out of min - max", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <form aria-label="Order">
        <NumberInput label="Quantity" max={100} min={1} name="quantity" />
      </form>,
    );

    const form = screen.getByRole<HTMLFormElement>("form");
    const input = spinbutton();
    await user.click(input);
    await user.keyboard("150");
    // A submit from a script while the field has the focus - the browser
    // refuses it, as for a native number input
    expect(form.checkValidity()).toBe(false);
    expect(input.validationMessage).toBe("Enter a value of 100 or less.");

    await user.tab();
    expect(input).toHaveAttribute("aria-valuenow", "100");
    expect(form.checkValidity()).toBe(true);

    rerender(
      <UIProvider locale={cs}>
        <form aria-label="Order">
          <NumberInput
            label="Quantity"
            max={100}
            min={1}
            onChange={() => {}}
            value={0.5}
          />
        </form>
      </UIProvider>,
    );
    expect(spinbutton().validationMessage).toBe(
      "Zadejte hodnotu 1 nebo vyšší.",
    );
  });

  it("leaves a validity message of the page alone", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(
      <NumberInput defaultValue={5} label="Quantity" max={10} ref={ref} />,
    );

    ref.current!.setCustomValidity("Not in stock");
    rerender(
      <NumberInput
        defaultValue={5}
        description="Up to 10"
        label="Quantity"
        max={10}
        ref={ref}
      />,
    );
    expect(ref.current!.validationMessage).toBe("Not in stock");
  });

  it.each([true, false])(
    "blocks submission of an incomplete number (required: %s)",
    async (required) => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        return new FormData(event.currentTarget).get("quantity");
      });
      render(
        <form aria-label="Order" onSubmit={onSubmit}>
          <NumberInput label="Quantity" name="quantity" required={required} />
        </form>,
      );
      const form = screen.getByRole<HTMLFormElement>("form");
      const input = spinbutton();
      for (const partial of ["-", ".", "-."]) {
        await user.clear(input);
        await user.type(input, partial);
        expect(input).toHaveValue(partial);
        expect(form.checkValidity()).toBe(false);
        expect(input.validationMessage).toBe("Enter a number.");
        act(() => form.requestSubmit());
        expect(onSubmit).not.toHaveBeenCalled();
      }
      await user.keyboard("2");
      expect(form.checkValidity()).toBe(true);
      act(() => form.requestSubmit());
      expect(onSubmit).toHaveReturnedWith("-0.2");
      await user.clear(input);
      expect(form.checkValidity()).toBe(!required);
    },
  );

  it("localizes incomplete-number validation and clears it on blur and reset", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <form aria-label="Order">
          <NumberInput label="Quantity" defaultValue={5} />
        </form>
      </UIProvider>,
    );
    const input = spinbutton();
    const form = screen.getByRole<HTMLFormElement>("form");
    await user.clear(input);
    await user.type(input, ",");
    expect(input.validationMessage).toBe("Zadejte číslo.");
    await user.tab();
    expect(input).toHaveValue("");
    expect(form.checkValidity()).toBe(true);
    await user.type(input, "-");
    expect(form.checkValidity()).toBe(false);
    act(() => form.reset());
    await waitFor(() => expect(input).toHaveValue("5"));
    expect(form.checkValidity()).toBe(true);
  });

  it("describes itself with its error and description", () => {
    render(
      <NumberInput
        description="Pieces in stock"
        error="Too many"
        label="Quantity"
        required
      />,
    );

    const input = spinbutton();
    expect(input).toHaveAccessibleDescription("Too many Pieces in stock");
    expect(input).toBeInvalid();
    expect(input).toBeRequired();
  });

  it("keeps the caller's handlers and ref", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
      if (event.key === "ArrowUp") event.preventDefault();
    });
    const onBlur = vi.fn();
    render(
      <NumberInput
        defaultValue={1}
        label="Quantity"
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        ref={ref}
      />,
    );

    expect(ref.current).toBe(spinbutton());
    await user.click(spinbutton());
    // A handler that prevents the default skips the step
    await user.keyboard("{ArrowUp}");
    expect(spinbutton()).toHaveAttribute("aria-valuenow", "1");
    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("selects the value for a focus from the keyboard", async () => {
    const user = userEvent.setup();
    render(<NumberInput defaultValue={1234} label="Quantity" />);

    await user.tab();
    const input = spinbutton();
    expect(input).toHaveValue("1234");
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);
  });

  it("renders on the server and hydrates without a mismatch", async () => {
    const field = (
      <UIProvider locale={cs}>
        <NumberInput
          defaultValue={1234.5}
          formatOptions={{ currency: "CZK", style: "currency" }}
          label="Cena"
          name="price"
          prefix="≈"
        />
      </UIProvider>
    );

    const html = renderToString(field);
    expect(html).toContain("1\u00a0234,50\u00a0Kč");
    expect(html).toContain('value="1234.5"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");

    const root = await act(async () =>
      hydrateRoot(container, field, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});

describe("NumberInput clearable", () => {
  it("empties the field, reports null and moves the focus into it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Order">
        <NumberInput
          clearable
          defaultValue={12}
          label="Quantity"
          name="quantity"
          onChange={onChange}
        />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(spinbutton()).toHaveValue("");
    expect(spinbutton()).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(
      new FormData(screen.getByRole("form", { name: "Order" })).get("quantity"),
    ).toBe("");
    // Nothing left to clear
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();

    await user.type(spinbutton(), "5");
    expect(screen.getByRole("button", { name: "Clear" })).toBeVisible();
  });

  it("clears a controlled field the parent empties", async () => {
    const user = userEvent.setup();

    function Quantity() {
      const [value, setValue] = useState<number | null>(3);
      return (
        <NumberInput
          clearable
          label="Quantity"
          onChange={setValue}
          value={value}
        />
      );
    }
    render(<Quantity />);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(spinbutton()).toHaveValue("");
    // The field goes on from no value
    await user.keyboard("{ArrowUp}");
    expect(spinbutton()).toHaveValue("0");
  });

  it("is not offered while disabled or read-only", () => {
    render(
      <>
        <NumberInput clearable defaultValue={1} disabled label="Quantity" />
        <NumberInput clearable defaultValue={1} label="Price" readOnly />
      </>,
    );

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

describe("NumberInput readOnly", () => {
  it("has no step buttons, keeps its value from the keys and is submitted", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <NumberInput defaultValue={4} label="Quantity" name="q" readOnly />
      </form>,
    );

    const input = spinbutton();
    expect(input).toHaveAttribute("data-readonly");
    expect(input).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Increase" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decrease" })).toBeNull();

    await user.click(input);
    await user.keyboard("{ArrowUp}{PageUp}");
    expect(input).toHaveValue("4");
    expect(
      new FormData(screen.getByRole("form", { name: "Order" })).get("q"),
    ).toBe("4");
  });
});

describe("NumberInput label", () => {
  it("takes content", () => {
    render(
      <NumberInput
        label={
          <>
            Quantity <small>(pcs)</small>
          </>
        }
        required
      />,
    );

    expect(spinbutton("Quantity (pcs):")).toBeRequired();
    expect(screen.getByText("*")).toHaveClass("cui-required-mark");
  });
});
