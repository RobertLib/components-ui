import { describe, expect, it } from "vitest";
import {
  findDisabledDay,
  findEnabledDay,
  isMonthUnavailable,
  isoWeekStart,
  isValueUnavailable,
  isWeekUnavailable,
} from "./availability";

const d = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);
const isWeekend = (day: Date) => day.getDay() === 0 || day.getDay() === 6;

describe("availability", () => {
  it("a month or a week is unavailable when every day of it is disabled", () => {
    const inFebruary = (day: Date) => day.getMonth() === 1;
    expect(isMonthUnavailable(2028, 2, inFebruary)).toBe(true);
    // February 29 of a leap year is looked at too
    expect(
      isMonthUnavailable(
        2028,
        2,
        (day) => inFebruary(day) && day.getDate() < 29,
      ),
    ).toBe(false);
    expect(isMonthUnavailable(2026, 9, isWeekend)).toBe(false);

    expect(isoWeekStart(2026, 1)).toEqual(d(2025, 12, 29));
    expect(isoWeekStart(2026, 39)).toEqual(d(2026, 9, 21));
    expect(isWeekUnavailable(d(2026, 9, 21), isWeekend)).toBe(false);
    expect(
      isWeekUnavailable(d(2026, 9, 21), (day) => day >= d(2026, 9, 21)),
    ).toBe(true);
  });

  it("isValueUnavailable reads the value of each type", () => {
    expect(isValueUnavailable("2026-09-26", "date", isWeekend)).toBe(true);
    expect(isValueUnavailable("2026-09-25", "date", isWeekend)).toBe(false);
    expect(
      isValueUnavailable("2026-09-26T10:00", "datetime-local", isWeekend),
    ).toBe(true);
    expect(isValueUnavailable("2026-09", "month", () => true)).toBe(true);
    expect(isValueUnavailable("2026-09", "month", isWeekend)).toBe(false);
    expect(isValueUnavailable("2026-W39", "week", () => true)).toBe(true);
    expect(isValueUnavailable("10:00", "time", () => true)).toBe(false);
    expect(isValueUnavailable("", "date", () => true)).toBe(false);
    expect(isValueUnavailable("2026-09-26", "date", undefined)).toBe(false);
  });

  it("findDisabledDay goes from the start to the end", () => {
    expect(findDisabledDay(d(2026, 9, 21), d(2026, 9, 30), isWeekend)).toEqual(
      d(2026, 9, 26),
    );
    expect(
      findDisabledDay(d(2026, 9, 21), d(2026, 9, 25), isWeekend),
    ).toBeNull();
  });

  it("findEnabledDay finds the nearest day that can be picked", () => {
    // Saturday - on to Monday
    expect(findEnabledDay(d(2026, 9, 26), isWeekend)).toEqual(d(2026, 9, 28));
    // Back to Friday when `max` ends before Monday
    expect(
      findEnabledDay(d(2026, 9, 26), isWeekend, null, d(2026, 9, 27)),
    ).toEqual(d(2026, 9, 25));
    expect(findEnabledDay(d(2026, 9, 25), isWeekend)).toEqual(d(2026, 9, 25));
    // None - the day itself
    expect(findEnabledDay(d(2026, 9, 26), () => true)).toEqual(d(2026, 9, 26));
  });
});
