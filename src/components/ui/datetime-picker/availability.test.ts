import { afterEach, describe, expect, it } from "vitest";
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

describe("availability where the time zone skips a day or a midnight", () => {
  const previousTZ = process.env.TZ;

  afterEach(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  /** The days `check` calls the predicate with - each of them disabled. */
  const daysChecked = (
    check: (isDateDisabled: (day: Date) => boolean) => void,
  ) => {
    const days: Date[] = [];
    check((day) => {
      days.push(day);
      return true;
    });
    return days;
  };

  it("checks the days of a month whose last day the time zone skipped", () => {
    // Kiritimati went from Friday, December 30, 1994 to Sunday, January 1
    process.env.TZ = "Pacific/Kiritimati";

    const inDecember = (day: Date) => day.getMonth() === 11;
    expect(isMonthUnavailable(1994, 12, inDecember)).toBe(true);
    // Not January 1, which `dateOf` takes December 31 for
    expect(
      daysChecked((isDateDisabled) =>
        isMonthUnavailable(1994, 12, isDateDisabled),
      ).at(-1),
    ).toEqual(d(1994, 12, 30));
  });

  it("checks each day of a week from its own start", () => {
    // In Tehran Monday, March 22, 2021 started at 1:00 - the days after it
    // at midnight
    process.env.TZ = "Asia/Tehran";

    const monday = isoWeekStart(2021, 12);
    expect(monday).toEqual(d(2021, 3, 22));
    expect(monday.getHours()).toBe(1);
    const days = daysChecked((isDateDisabled) =>
      isWeekUnavailable(monday, isDateDisabled),
    );
    expect(days).toEqual(
      Array.from({ length: 7 }, (_, day) => d(2021, 3, 22 + day)),
    );
    expect(days[1].getHours()).toBe(0);
  });

  it("checks no day of a week the time zone skipped", () => {
    // Samoa went from Thursday, December 29, 2011 to Saturday, December 31
    process.env.TZ = "Pacific/Apia";

    expect(
      daysChecked((isDateDisabled) =>
        isWeekUnavailable(isoWeekStart(2011, 52), isDateDisabled),
      ).map((day) => day.getDate()),
    ).toEqual([26, 27, 28, 29, 31, 1]);
  });
});
