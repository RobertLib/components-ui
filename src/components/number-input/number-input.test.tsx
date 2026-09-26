import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NumberInput from ".";
import { cs } from "../../i18n/cs";
import { en } from "../../i18n/en";
import UIProvider from "../../providers/ui-provider";

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
