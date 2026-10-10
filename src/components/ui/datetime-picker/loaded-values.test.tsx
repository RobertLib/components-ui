import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const preciseTimeRanges = [
  { value: "17:00:45", max: "17:00:30", valid: false },
  { value: "09:30:45", min: "09:30:30", valid: true },
  { value: "09:30:15", min: "09:30:30", valid: false },
  { value: "17:00:15", max: "17:00:30", valid: true },
  { value: "09:30", min: "09:30:00.000", valid: true },
  { value: "09:30:00.000", max: "09:30", valid: true },
  {
    value: "09:30:30.125",
    min: "09:30:30.1000",
    max: "09:30:30.2",
    valid: true,
  },
  { value: "09:30:30.2", max: "09:30:30.125", valid: false },
  { value: "09:30:30.1", min: "09:30:30.125", valid: false },
];

describe.each(["defaultValue", "value"] as const)(
  "DateTimePicker precise supplied %s ranges",
  (source) => {
    describe.each(["time", "datetime-local"] as const)("%s", (type) => {
      const toValue = (time: string | undefined) =>
        time === undefined
          ? undefined
          : type === "time"
            ? time
            : `2026-09-24T${time}`;

      it.each(preciseTimeRanges)(
        "validates $value against $min / $max while preserving submitted seconds",
        ({ max, min, valid, value }) => {
          const supplied = toValue(value)!;
          render(
            <form aria-label="Booking">
              <DateTimePicker
                {...(source === "value"
                  ? { value: supplied }
                  : { defaultValue: supplied })}
                label="When"
                max={toValue(max)}
                min={toValue(min)}
                name="when"
                type={type}
              />
              <input
                aria-label="Native"
                defaultValue={supplied}
                max={toValue(max)}
                min={toValue(min)}
                step="any"
                type={type}
              />
            </form>,
          );
          const form = screen.getByRole<HTMLFormElement>("form");
          const field = screen.getByRole<HTMLInputElement>("combobox");
          const native = screen.getByLabelText<HTMLInputElement>("Native");

          expect(field.checkValidity()).toBe(valid);
          expect(native.checkValidity()).toBe(valid);
          expect(form.checkValidity()).toBe(valid);
          expect(new FormData(form).get("when")).toBe(supplied);
        },
      );
    });

    it.each([
      { value: "22:00:45", min: "22:00:30", max: "06:00:30", valid: true },
      { value: "06:00:45", min: "22:00:30", max: "06:00:30", valid: false },
      { value: "06:00:30", min: "22:00:30", max: "06:00:30", valid: true },
      { value: "22:00:15", min: "22:00:30", max: "06:00:30", valid: false },
      { value: "09:30:50", min: "09:30:45", max: "09:30:15", valid: true },
      { value: "09:30:05", min: "09:30:45", max: "09:30:15", valid: true },
      { value: "09:30:30", min: "09:30:45", max: "09:30:15", valid: false },
    ])(
      "checks seconds at the ends of the reversed time range $min / $max ($value)",
      ({ max, min, valid, value }) => {
        render(
          <form aria-label="Booking">
            <DateTimePicker
              {...(source === "value" ? { value } : { defaultValue: value })}
              label="When"
              max={max}
              min={min}
              name="when"
              type="time"
            />
          </form>,
        );
        const form = screen.getByRole<HTMLFormElement>("form");
        expect(form.checkValidity()).toBe(valid);
        expect(new FormData(form).get("when")).toBe(value);
      },
    );

    it.each([
      { value: "2026-09-24T00:00:00.000", valid: true },
      { value: "2026-09-24T23:59:59.999", valid: true },
      { value: "2026-09-25T00:00", valid: false },
      { value: "2026-09-23T23:59:59.999", valid: false },
    ])(
      "allows every second of date-only bounds ($value)",
      ({ value, valid }) => {
        render(
          <form aria-label="Booking">
            <DateTimePicker
              {...(source === "value" ? { value } : { defaultValue: value })}
              label="When"
              max="2026-09-24"
              min="2026-09-24"
              name="when"
              type="datetime-local"
            />
          </form>,
        );
        const form = screen.getByRole<HTMLFormElement>("form");
        expect(form.checkValidity()).toBe(valid);
        expect(new FormData(form).get("when")).toBe(value);
      },
    );
  },
);

it.each(["time", "datetime-local"] as const)(
  "keeps the %s popup on whole minute options while a supplied second-level value is valid",
  async (type) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const toValue = (time: string) =>
      type === "time" ? time : `2026-09-24T${time}`;
    render(
      <form aria-label="Booking">
        <DateTimePicker
          defaultValue={toValue("09:30:45")}
          label="When"
          min={toValue("09:30:30")}
          minuteStep={15}
          name="when"
          onChange={onChange}
          type={type}
        />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form");
    const field = screen.getByRole("combobox");
    expect(form.checkValidity()).toBe(true);
    await user.click(field);
    const minutes = await screen.findByRole("listbox", { name: "Minutes" });
    expect(within(minutes).getByRole("option", { name: "30" })).toBeDisabled();
    await user.click(within(minutes).getByRole("option", { name: "45" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        target: { name: "when", value: toValue("09:45") },
      }),
    );
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("when")).toBe(toValue("09:45"));
  },
);

describe.each(["time", "datetime-local"] as const)(
  "%s second-level popup bounds",
  (type) => {
    it.each(["09:30", "23:59"])(
      "offers no whole-minute selection between seconds 15–45 of %s",
      async (time) => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const toValue = (clock: string) =>
          type === "time" ? clock : `2026-09-24T${clock}`;
        const supplied = toValue(`${time}:30`);
        render(
          <form aria-label="Booking">
            <DateTimePicker
              defaultValue={supplied}
              label="When"
              max={toValue(`${time}:45`)}
              min={toValue(`${time}:15`)}
              minuteStep={15}
              name="when"
              onChange={onChange}
              type={type}
            />
          </form>,
        );
        const form = screen.getByRole<HTMLFormElement>("form");
        expect(form.checkValidity()).toBe(true);
        await user.click(screen.getByRole("combobox"));
        const hours = await screen.findByRole("listbox", { name: "Hours" });
        const minutes = screen.getByRole("listbox", { name: "Minutes" });
        for (const option of [
          ...within(hours).getAllByRole("option"),
          ...within(minutes).getAllByRole("option"),
        ]) {
          expect(option).toBeDisabled();
        }

        await user.click(within(hours).getByRole("option", { name: "10 AM" }));
        await user.click(within(minutes).getByRole("option", { name: "00" }));
        if (type === "datetime-local") {
          await user.click(
            screen.getByRole("button", { name: "September 24, 2026" }),
          );
        }
        expect(onChange).not.toHaveBeenCalled();
        expect(form.checkValidity()).toBe(true);
        expect(new FormData(form).get("when")).toBe(supplied);
      },
    );
  },
);

it("keeps a genuinely reversed second-level time range selectable across midnight", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <form aria-label="Booking">
      <DateTimePicker
        defaultValue="09:30:50"
        label="When"
        max="09:30:15"
        min="09:30:45"
        minuteStep={15}
        name="when"
        onChange={onChange}
        type="time"
      />
    </form>,
  );
  const form = screen.getByRole<HTMLFormElement>("form");
  await user.click(screen.getByRole("combobox"));
  const hours = await screen.findByRole("listbox", { name: "Hours" });
  const minutes = screen.getByRole("listbox", { name: "Minutes" });
  expect(within(minutes).getByRole("option", { name: "30" })).toBeEnabled();
  const hour = within(hours).getByRole("option", { name: "10 AM" });
  expect(hour).toBeEnabled();
  await user.click(hour);

  expect(onChange).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ target: { name: "when", value: "10:30" } }),
  );
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get("when")).toBe("10:30");
});
