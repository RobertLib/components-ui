import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DateTimePicker, { type DateTimePickerType } from ".";

const invalidValues: [DateTimePickerType, string][] = [
  ["date", "2026-02-31"],
  ["date", "2026-02-29"],
  ["date", "2026-00-01"],
  ["date", "2026-09-24junk"],
  ["date", "2026-09-24T14:30"],
  ["time", "25:99"],
  ["time", "24:00"],
  ["time", "14:30:60"],
  ["time", "14:30junk"],
  ["time", "14:30:59Z"],
  ["datetime-local", "2026-02-31T14:30"],
  ["datetime-local", "2026-09-24T25:99"],
  ["datetime-local", "2026-09-24"],
  ["datetime-local", "2026-09-24T14:30:60"],
  ["datetime-local", "2026-09-24T14:30Z"],
  ["month", "2026-13"],
  ["month", "2026-00"],
  ["month", "2026-09junk"],
  ["month", "2026-09-24"],
  ["week", "2026-W00"],
  ["week", "2026-W54"],
  ["week", "2027-W53"],
  ["week", "2026-W39junk"],
];

const validValues: [DateTimePickerType, string, string][] = [
  ["date", "2028-02-29", "02/29/2028"],
  ["time", "14:30", "2:30 PM"],
  ["time", "14:30:59.123", "2:30 PM"],
  ["datetime-local", "2026-09-24T14:30", "09/24/2026 2:30 PM"],
  ["datetime-local", "2026-09-24T14:30:59.123", "09/24/2026 2:30 PM"],
  ["month", "2026-09", "09/2026"],
  ["week", "2026-W53", "W53 2026"],
];

describe("DateTimePicker supplied values", () => {
  it.each(invalidValues)(
    "sanitizes an invalid %s default (%s) like a native input",
    (type, defaultValue) => {
      const onChange = vi.fn();
      const picker = (required: boolean) => (
        <form aria-label="Booking">
          <DateTimePicker
            defaultValue={defaultValue}
            label="When"
            name="when"
            onChange={onChange}
            required={required}
            type={type}
          />
          <input
            aria-label="Native"
            defaultValue={defaultValue}
            required={required}
            type={type}
          />
        </form>
      );
      const { rerender } = render(picker(false));
      const form = screen.getByRole<HTMLFormElement>("form");
      const field = screen.getByRole<HTMLInputElement>("combobox");
      const native = screen.getByLabelText<HTMLInputElement>("Native");

      expect(field).toHaveValue("");
      expect(native.value).toBe("");
      expect(field.checkValidity()).toBe(native.checkValidity());
      expect(form.checkValidity()).toBe(true);
      expect(new FormData(form).get("when")).toBe("");
      expect(screen.queryByRole("button", { name: "Clear value" })).toBeNull();

      rerender(picker(true));
      expect(field.validity.valueMissing).toBe(true);
      expect(field.checkValidity()).toBe(native.checkValidity());
      expect(form.checkValidity()).toBe(false);
      expect(new FormData(form).get("when")).toBe("");
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it.each(validValues)(
    "preserves a valid %s supplied value (%s)",
    (type, defaultValue, displayValue) => {
      render(
        <form aria-label="Booking">
          <DateTimePicker
            defaultValue={defaultValue}
            label="When"
            name="when"
            required
            type={type}
          />
        </form>,
      );
      const form = screen.getByRole<HTMLFormElement>("form");
      expect(screen.getByRole("combobox")).toHaveValue(displayValue);
      expect(form.checkValidity()).toBe(true);
      expect(new FormData(form).get("when")).toBe(defaultValue);
    },
  );

  it("sanitizes controlled updates and discards drafts even between invalid values", () => {
    const onChange = vi.fn();
    const picker = (value: string) => (
      <form aria-label="Booking">
        <DateTimePicker
          label="When"
          name="when"
          onChange={onChange}
          required
          value={value}
        />
      </form>
    );
    const { rerender } = render(picker("2026-09-24"));
    const field = screen.getByRole<HTMLInputElement>("combobox");
    const form = screen.getByRole<HTMLFormElement>("form");
    expect(form.checkValidity()).toBe(true);

    rerender(picker("2026-02-31"));
    expect(field).toHaveValue("");
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).get("when")).toBe("");

    fireEvent.change(field, { target: { value: "09/25/2026" } });
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("when")).toBe("2026-09-25");
    rerender(picker("2026-02-30"));
    expect(field).toHaveValue("");
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).get("when")).toBe("");

    rerender(picker("2026-09-26"));
    expect(field).toHaveValue("09/26/2026");
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("when")).toBe("2026-09-26");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps draft validation and restores a sanitized invalid default on reset", async () => {
    const onChange = vi.fn();
    render(
      <form aria-label="Booking">
        <DateTimePicker
          defaultValue="2026-02-31"
          label="When"
          name="when"
          onChange={onChange}
          required
        />
      </form>,
    );
    const field = screen.getByRole<HTMLInputElement>("combobox");
    const form = screen.getByRole<HTMLFormElement>("form");

    fireEvent.change(field, { target: { value: "09/24/2026" } });
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("when")).toBe("2026-09-24");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe("2026-09-24");

    fireEvent.change(field, { target: { value: "02/31/2026" } });
    expect(field.validity.customError).toBe(true);
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).get("when")).toBe("");

    await act(async () => {
      form.reset();
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(field).toHaveValue("");
    expect(field.validity.customError).toBe(false);
    expect(field.validity.valueMissing).toBe(true);
    expect(new FormData(form).get("when")).toBe("");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ignores malformed limits while allowing whole-day date-time limits", () => {
    render(
      <form aria-label="Booking">
        <DateTimePicker
          defaultValue="2026-09-24"
          label="Day"
          max="2026-00-01"
          min="2026-99-01"
          required
        />
        <DateTimePicker
          defaultValue="2026-09-24T14:30"
          label="When"
          max="2026-09-24"
          min="2026-09-24"
          required
          type="datetime-local"
        />
      </form>,
    );
    expect(screen.getByRole<HTMLFormElement>("form").checkValidity()).toBe(
      true,
    );
  });
});
