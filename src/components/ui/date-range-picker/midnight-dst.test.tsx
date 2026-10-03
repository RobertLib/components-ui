import { fireEvent, render, screen } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import DateRangePicker, { type DateRangePresetKey } from ".";
import RangeCalendar from "../range-calendar";
import { createLocale } from "../../../i18n/format";
import { en } from "../../../i18n/en";
import UIProvider from "../../../providers/ui-provider";
import { getPresetRange } from "./range";

const mondayLocale = createLocale(en, { weekStartsOn: 1 });

describe("Range presets when daylight saving skips midnight", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "America/Havana";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 8, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs where the day of the change starts at 1:00", () => {
    expect(new Date(2026, 2, 8).getHours()).toBe(1);
    expect(new Date(2026, 2, 7).getHours()).toBe(0);
    expect(new Date(2026, 2, 9).getHours()).toBe(0);
  });

  const presets = [
    { day: "2026-03-07", key: "yesterday", label: "Yesterday" },
    { day: "2026-03-02", key: "last7Days", label: "Last 7 days" },
    { day: "2026-02-07", key: "last30Days", label: "Last 30 days" },
    { day: "2026-03-02", key: "thisWeek", label: "This week" },
    { day: "2026-02-23", key: "lastWeek", label: "Last week" },
  ] satisfies { day: string; key: DateRangePresetKey; label: string }[];

  describe.each(["calendar", "picker"] as const)("%s", (component) => {
    it.each(presets)(
      "picks $label when max leaves its first day",
      ({ day, key, label }) => {
        const onChange = vi.fn();
        const props = { max: day, name: "period", onChange, presets: [key] };
        const { container } = render(
          <UIProvider locale={mondayLocale}>
            <form>
              {component === "calendar" ? (
                <RangeCalendar {...props} />
              ) : (
                <DateRangePicker {...props} />
              )}
            </form>
          </UIProvider>,
        );

        if (component === "picker") {
          fireEvent.click(screen.getByRole("combobox"));
        }

        const preset = screen.getByRole("button", { name: label });
        expect(preset).toBeEnabled();
        fireEvent.click(preset);
        expect(onChange).toHaveBeenCalledExactlyOnceWith({
          end: day,
          start: day,
        });
        expect(
          new FormData(container.querySelector("form")!).get("period"),
        ).toBe(`${day}/${day}`);
      },
    );
  });

  it.each([8, 9])(
    "keeps a Sunday-starting week ending at midnight when today is March %i",
    (day) => {
      const today = new Date(2026, 2, day);
      expect(getPresetRange("thisWeek", today, 0)).toEqual({
        end: new Date(2026, 2, 14),
        start: new Date(2026, 2, 8),
      });
      expect(getPresetRange("lastWeek", today, 0)).toEqual({
        end: new Date(2026, 2, 7),
        start: new Date(2026, 2, 1),
      });
    },
  );

  it("checks unavailable preset days at their own local midnight", () => {
    const isDateDisabled = vi.fn((_day: Date) => false);
    render(
      <RangeCalendar
        isDateDisabled={isDateDisabled}
        presets={[
          "yesterday",
          "last7Days",
          "last30Days",
          "thisWeek",
          "lastWeek",
        ]}
      />,
    );

    expect(isDateDisabled).toHaveBeenCalled();
    for (const [day] of isDateDisabled.mock.calls) {
      expect(day).toEqual(
        new Date(day.getFullYear(), day.getMonth(), day.getDate()),
      );
    }
  });
});
