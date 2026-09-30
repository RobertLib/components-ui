import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DateTimePicker, { type DateTimePickerType } from ".";
import DateRangePicker from "../date-range-picker";

const types: (DateTimePickerType | "range")[] = [
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "range",
];

describe("Date picker disabled fieldsets", () => {
  it.each(types)(
    "closes the %s popup when an ancestor fieldset is disabled",
    async (type) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = render(
        <fieldset>
          {type === "range" ? (
            <DateRangePicker label="Pick" onChange={onChange} />
          ) : (
            <DateTimePicker label="Pick" onChange={onChange} type={type} />
          )}
        </fieldset>,
      );
      const input = screen.getByRole("combobox", { name: /Pick/ });
      await user.click(input);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      const fieldset = container.querySelector("fieldset")!;
      await act(async () => {
        fieldset.disabled = true;
      });
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute("aria-expanded", "false");
      expect(onChange).not.toHaveBeenCalled();
      await act(async () => {
        fieldset.disabled = false;
      });
      expect(input).toBeEnabled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await user.click(input);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );

  it("leaves a picker in the first legend enabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <fieldset disabled>
        <legend>
          <DateTimePicker
            label="Day"
            defaultValue="2026-09-24"
            onChange={(event) => onChange(event.target.value)}
          />
        </legend>
        <DateTimePicker label="Blocked" />
      </fieldset>,
    );
    const input = screen.getByRole("combobox", { name: /Day/ });
    expect(input).toBeEnabled();
    expect(screen.getByRole("combobox", { name: /Blocked/ })).toBeDisabled();
    await user.click(input);
    await user.click(
      screen.getByRole("button", { name: "September 25, 2026" }),
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-25");
  });
});
