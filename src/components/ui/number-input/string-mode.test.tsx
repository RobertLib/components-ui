import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import NumberInput from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";

const spinbutton = (name: RegExp | string = /Amount/) =>
  screen.getByRole<HTMLInputElement>("spinbutton", { name });

const czk: Intl.NumberFormatOptions = { currency: "CZK", style: "currency" };

describe("NumberInput stringMode", () => {
  it("shows a decimal string beyond 2^53 with every digit", () => {
    render(
      <NumberInput
        defaultValue="12345678901234567890.25"
        label="Amount"
        stringMode
      />,
    );

    const input = spinbutton();
    expect(input).toHaveValue("12,345,678,901,234,567,890.25");
    expect(input).toHaveAttribute(
      "aria-valuetext",
      "12,345,678,901,234,567,890.25",
    );
    expect(input).toHaveAttribute("aria-valuenow", "12345678901234567000");
  });

  it("reads localized amounts exactly and reports canonical strings", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UIProvider locale={cs}>
        <form aria-label="Invoice">
          <NumberInput
            formatOptions={czk}
            label="Amount"
            name="amount"
            onChange={onChange}
            stringMode
          />
        </form>
      </UIProvider>,
    );

    const input = spinbutton();
    await user.type(input, "1 234,5");
    expect(onChange).toHaveBeenLastCalledWith("1234.50");
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).get("amount"),
    ).toBe("1234.50");

    await user.tab();
    expect(input).toHaveValue("1 234,50 Kč");

    await user.clear(input);
    await user.type(input, "-0,1");
    expect(onChange).toHaveBeenLastCalledWith("-0.10");

    await user.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).get("amount"),
    ).toBe("");
  });

  it("steps exactly - 0.1 and 0.2 make 0.3", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        defaultValue="0.1"
        label="Amount"
        onChange={onChange}
        step="0.1"
        stringMode
      />,
    );

    const input = spinbutton();
    await user.click(input);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(onChange.mock.calls).toEqual([["0.2"], ["0.3"]]);
    expect(input).toHaveValue("0.3");

    await user.keyboard("{PageUp}");
    expect(onChange).toHaveBeenLastCalledWith("1.3");
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("1.2");
  });

  it("steps a large number by one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        defaultValue="9007199254740993"
        formatOptions={{ useGrouping: false }}
        label="Amount"
        onChange={onChange}
        stringMode
      />,
    );

    await user.click(spinbutton());
    await user.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith("9007199254740994");
    expect(spinbutton()).toHaveValue("9007199254740994");
  });

  it("clamps, bounds and validates with decimal limits", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        label="Amount"
        max="1000.05"
        min="0.05"
        onChange={onChange}
        step="0.1"
        stringMode
      />,
    );

    const input = spinbutton();
    expect(input).toHaveAttribute("aria-valuemin", "0.05");
    expect(input).toHaveAttribute("aria-valuemax", "1000.05");

    await user.type(input, "5000");
    expect(input.validationMessage).toBe("Enter a value of 1,000.05 or less.");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("1000.05");
    expect(input.validationMessage).toBe("");

    await user.click(input);
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("0.05");
    await user.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith("0.15");

    // A minus sign cannot be typed above a min of 0
    await user.clear(input);
    await user.type(input, "-");
    expect(input).toHaveValue("");
  });

  it("rounds a value of the parent to the digits of the format", () => {
    const onChange = vi.fn();
    render(
      <form aria-label="Invoice">
        <NumberInput
          formatOptions={czk}
          label="Amount"
          name="amount"
          onChange={onChange}
          stringMode
          value="1.005"
        />
      </form>,
    );

    expect(spinbutton()).toHaveValue("CZK\u00a01.01");
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).get("amount"),
    ).toBe("1.01");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("types a percentage as the percent number", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NumberInput
        formatOptions={{ maximumFractionDigits: 2, style: "percent" }}
        label="Amount"
        onChange={onChange}
        stringMode
      />,
    );

    const input = spinbutton();
    // Rounded as the percent number shows - 12.35 %
    await user.type(input, "12.345");
    expect(onChange).toHaveBeenLastCalledWith("0.1235");
    await user.keyboard("{ArrowUp}");
    // One percent
    expect(onChange).toHaveBeenLastCalledWith("0.13");
    await user.tab();
    expect(input).toHaveValue("13%");
  });

  it("works controlled and takes a number of the parent too", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [amount, setAmount] = useState<string | null>("19.99");
      return (
        <>
          <NumberInput
            label="Amount"
            onChange={setAmount}
            stringMode
            value={amount}
          />
          <output>{String(amount)}</output>
        </>
      );
    }

    render(<Controlled />);
    const input = spinbutton();
    await user.click(input);
    // Onto the grid of the steps, like a native input
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("status")).toHaveTextContent("20");

    await user.clear(input);
    await user.type(input, "0.30000000000000004");
    await user.tab();
    expect(screen.getByRole("status")).toHaveTextContent("0.3");
  });

  it("shows no value for a string that is no number", () => {
    render(<NumberInput defaultValue="12,5" label="Amount" stringMode />);
    expect(spinbutton()).toHaveValue("");
  });

  it("brings back the default string on a form reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Invoice">
        <NumberInput
          defaultValue="100.10"
          label="Amount"
          name="amount"
          stringMode
        />
        <button type="reset">Reset</button>
      </form>,
    );

    const input = spinbutton();
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("100.1");
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).get("amount"),
    ).toBe("100.1");
  });
});
