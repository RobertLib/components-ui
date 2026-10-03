import { describe, expect, it } from "vitest";
import { copyDate, dateTimeZone, inTimeZone, zonedDay } from "./time-zone";
import { existingDayOf, formatMonthYear } from "./date";

describe("native named time zones", () => {
  it("clones without mutation and keeps UTC serialization", () => {
    const source = new Date("2026-09-30T23:30:10.123Z");
    const date = inTimeZone(source, "Asia/Kathmandu");
    expect(date.toISOString()).toBe(source.toISOString());
    expect([
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ]).toEqual([9, 1, 5, 15, 10, 123]);
    expect(date.getTimezoneOffset()).toBe(-345);
    expect(formatMonthYear(date, "en-US")).toBe("October 2026");
    expect(copyDate(date)).not.toBe(date);
    expect(dateTimeZone(copyDate(date))).toBe("Asia/Kathmandu");
    date.setDate(2);
    expect(source.toISOString()).toBe("2026-09-30T23:30:10.123Z");
  });
  it("selects the earlier repeated time and advances through a gap", () => {
    const autumn = inTimeZone(
      new Date("2026-10-25T12:00:00Z"),
      "Europe/Prague",
    );
    autumn.setHours(2, 30, 0, 0);
    expect(autumn.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    const spring = inTimeZone(
      new Date("2026-03-29T12:00:00Z"),
      "Europe/Prague",
    );
    spring.setHours(2, 30, 0, 0);
    expect(spring.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });
  it("supports skipped days and years 0–99", () => {
    const reference = inTimeZone(
      new Date("2011-12-29T12:00:00Z"),
      "Pacific/Apia",
    );
    expect(existingDayOf(2011, 11, 30, reference)).toBeNull();
    const ancient = zonedDay(50, 1, 3, inTimeZone(new Date(), "UTC"));
    expect(ancient.toISOString()).toBe("0050-02-03T00:00:00.000Z");
    const yearZero = zonedDay(0, 1, 29, ancient);
    expect(yearZero.getFullYear()).toBe(0);
    expect(yearZero.getDate()).toBe(29);
  });
  it("propagates invalid dates, validates zone identifiers and recovers with setFullYear", () => {
    const invalid = inTimeZone(new Date(NaN), "UTC");
    expect(invalid.getHours()).toBeNaN();
    invalid.setFullYear(2026, 0, 1);
    expect(invalid.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(() => inTimeZone(new Date(), "Invalid/Zone")).toThrow(RangeError);
  });
});
