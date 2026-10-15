import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DateRangePicker, { type DateRangePickerProps } from ".";

// Noon of September 30, 2026 in UTC: October 1 in Kiritimati (UTC+14),
// still September 30 in Pago Pago (UTC-11) - whatever the zone of the
// computer running the tests. Only `Date` is faked.
const KIRITIMATI = "Pacific/Kiritimati";
const PAGO_PAGO = "Pacific/Pago_Pago";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPicker(props: DateRangePickerProps) {
  const onChange = vi.fn();
  render(<DateRangePicker label="Period" onChange={onChange} {...props} />);
  return {
    input: screen.getByRole<HTMLInputElement>("combobox", { name: /Period/ }),
    onChange,
    user: userEvent.setup(),
  };
}

const day = (name: string) => screen.getByRole("button", { name });

describe("DateRangePicker today of timeZone", () => {
  it.each([
    [KIRITIMATI, "October 2026", "October 1, 2026"],
    [PAGO_PAGO, "September 2026", "September 30, 2026"],
  ])("opens at and marks today in %s", async (timeZone, month, today) => {
    const { input, user } = renderPicker({ timeZone });

    await user.click(input);
    expect(screen.getByRole("grid", { name: month })).toBeVisible();
    expect(day(today)).toHaveAttribute("aria-current", "date");
  });

  it.each([
    [KIRITIMATI, "Today", { end: "2026-10-01", start: "2026-10-01" }],
    [PAGO_PAGO, "Today", { end: "2026-09-30", start: "2026-09-30" }],
    [KIRITIMATI, "Last 7 days", { end: "2026-10-01", start: "2026-09-25" }],
    [PAGO_PAGO, "Yesterday", { end: "2026-09-29", start: "2026-09-29" }],
    [KIRITIMATI, "This month", { end: "2026-10-31", start: "2026-10-01" }],
    [PAGO_PAGO, "This month", { end: "2026-09-30", start: "2026-09-01" }],
  ])("counts the presets in %s - %s", async (timeZone, preset, range) => {
    const { input, onChange, user } = renderPicker({ presets: true, timeZone });

    await user.click(input);
    const presets = screen.getByRole("group", { name: "Presets" });
    await user.click(within(presets).getByRole("button", { name: preset }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(range);
  });

  it("takes a year left out from today of the zone", async () => {
    // New Year's Day in Kiritimati - New Year's Eve almost everywhere else
    vi.setSystemTime(new Date("2026-12-31T12:00:00Z"));
    const { input, onChange, user } = renderPicker({ timeZone: KIRITIMATI });

    await user.type(input, "6/15 - 6/20{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2027-06-20",
      start: "2027-06-15",
    });
  });

  it("takes today of the browser for a zone it does not know", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { input, user } = renderPicker({ timeZone: "Mars/Base" });

    await user.click(input);
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-current") === "date"),
    ).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/DateRangePicker: timeZone "Mars\/Base"/),
    );
  });
});

describe("DateRangePicker disablePast and disableFuture", () => {
  it("disables the days before today of the zone", async () => {
    const { input, onChange, user } = renderPicker({
      disablePast: true,
      timeZone: KIRITIMATI,
    });

    await user.click(input);
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeVisible();
    expect(day("October 1, 2026")).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    // September is all in the past there
    expect(day("September 30, 2026")).toBeDisabled();

    await user.click(day("October 1, 2026"));
    await user.click(day("October 3, 2026"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-10-03",
      start: "2026-10-01",
    });
  });

  it("keeps today of another zone", async () => {
    const { input, user } = renderPicker({
      disablePast: true,
      timeZone: PAGO_PAGO,
    });

    await user.click(input);
    expect(day("September 29, 2026")).toBeDisabled();
    expect(day("September 30, 2026")).toBeEnabled();
  });

  it("disables the days after today and cuts the presets to them", async () => {
    const { input, onChange, user } = renderPicker({
      disableFuture: true,
      presets: ["thisMonth"],
      timeZone: PAGO_PAGO,
    });

    await user.click(input);
    // The month of today is the last one shown
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeVisible();
    expect(day("September 30, 2026")).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(day("October 1, 2026")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "This month" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      end: "2026-09-30",
      start: "2026-09-01",
    });
  });

  it("makes a range in the past invalid and refuses one typed", async () => {
    const { input, onChange, user } = renderPicker({
      defaultValue: { end: "2026-10-02", start: "2026-09-28" },
      disablePast: true,
      timeZone: KIRITIMATI,
    });
    expect(input.validationMessage).toBe(
      "Enter a value of 10/01/2026 or later.",
    );

    await user.clear(input);
    await user.type(input, "9/30/2026 - 10/2/2026{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAccessibleDescription(
      "“9/30/2026 - 10/2/2026” is outside the allowed range.",
    );
  });

  it("keeps a min and a max stricter than today", async () => {
    const { input, user } = renderPicker({
      defaultValue: { end: "2026-10-12", start: "2026-10-08" },
      disablePast: true,
      min: "2026-10-05",
      timeZone: KIRITIMATI,
    });

    await user.click(input);
    expect(day("October 4, 2026")).toBeDisabled();
    expect(day("October 5, 2026")).toBeEnabled();
  });
});
