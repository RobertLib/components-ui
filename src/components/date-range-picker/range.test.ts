import { describe, expect, it } from "vitest";
import {
  clampRange,
  countDays,
  decodeRange,
  encodeRange,
  formatRange,
  getPresetRange,
  hasAllowedLength,
  isAllowedRange,
  toDateRange,
  toDayRange,
} from "./range";

const d = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

describe("encodeRange and decodeRange", () => {
  it("write a range as an ISO 8601 interval and read it back", () => {
    const range = { end: "2026-09-30", start: "2026-09-01" };
    expect(encodeRange(range)).toBe("2026-09-01/2026-09-30");
    expect(decodeRange("2026-09-01/2026-09-30")).toEqual(range);
  });

  it("take a missing or half range as none", () => {
    expect(encodeRange(null)).toBe("");
    expect(encodeRange(undefined)).toBe("");
    expect(encodeRange({ end: "", start: "2026-09-01" })).toBe("");
    expect(decodeRange("")).toBeNull();
    expect(decodeRange("2026-09-01")).toBeNull();
  });
});

describe("toDayRange", () => {
  it("orders the days and refuses days that do not exist", () => {
    expect(toDayRange({ end: "2026-09-01", start: "2026-09-30" })).toEqual({
      end: d(2026, 9, 30),
      start: d(2026, 9, 1),
    });
    expect(toDayRange({ end: "2026-02-31", start: "2026-02-01" })).toBeNull();
    expect(toDayRange(null)).toBeNull();
  });

  it("round-trips with toDateRange, also before the year 1000", () => {
    const range = { end: "0999-01-02", start: "0050-03-07" };
    expect(toDateRange(toDayRange(range)!)).toEqual(range);
  });
});

describe("countDays", () => {
  it("counts both ends", () => {
    expect(countDays({ end: d(2026, 9, 24), start: d(2026, 9, 24) })).toBe(1);
    expect(countDays({ end: d(2026, 9, 30), start: d(2026, 9, 24) })).toBe(7);
  });

  it("counts whole days over a change of the clocks", () => {
    // The clocks change in the last week of March and of October in Europe
    expect(countDays({ end: d(2026, 4, 5), start: d(2026, 3, 20) })).toBe(17);
    expect(countDays({ end: d(2026, 10, 30), start: d(2026, 10, 20) })).toBe(
      11,
    );
  });
});

describe("limits", () => {
  const limits = {
    max: d(2026, 9, 30),
    maxDays: 7,
    min: d(2026, 9, 1),
    minDays: 2,
  };

  it("check the length and the days of a range", () => {
    const week = { end: d(2026, 9, 7), start: d(2026, 9, 1) };
    expect(hasAllowedLength(week, limits)).toBe(true);
    expect(isAllowedRange(week, limits)).toBe(true);
    expect(
      isAllowedRange({ end: d(2026, 9, 8), start: d(2026, 9, 1) }, limits),
    ).toBe(false);
    expect(
      isAllowedRange({ end: d(2026, 9, 1), start: d(2026, 9, 1) }, limits),
    ).toBe(false);
    expect(
      isAllowedRange({ end: d(2026, 9, 2), start: d(2026, 8, 31) }, limits),
    ).toBe(false);
    expect(
      hasAllowedLength(
        { end: d(2027, 9, 1), start: d(2026, 9, 1) },
        { max: null, min: null },
      ),
    ).toBe(true);
  });

  it("cut a range to min and max", () => {
    expect(
      clampRange({ end: d(2026, 10, 15), start: d(2026, 8, 15) }, limits),
    ).toEqual({ end: d(2026, 9, 30), start: d(2026, 9, 1) });
    expect(
      clampRange({ end: d(2026, 8, 31), start: d(2026, 8, 1) }, limits),
    ).toBeNull();
  });
});

describe("formatRange", () => {
  it("writes both days in the pattern", () => {
    expect(
      formatRange({ end: d(2026, 9, 30), start: d(2026, 9, 24) }, "DD.MM.YYYY"),
    ).toBe("24.09.2026 – 30.09.2026");
  });
});

describe("getPresetRange", () => {
  // A Thursday
  const today = d(2026, 9, 24);
  const preset = (
    key: Parameters<typeof getPresetRange>[0],
    weekStartsOn: 0 | 1 = 1,
  ) => toDateRange(getPresetRange(key, today, weekStartsOn));

  it("counts the last days up to today", () => {
    expect(preset("today")).toEqual({ end: "2026-09-24", start: "2026-09-24" });
    expect(preset("yesterday")).toEqual({
      end: "2026-09-23",
      start: "2026-09-23",
    });
    expect(preset("last7Days")).toEqual({
      end: "2026-09-24",
      start: "2026-09-18",
    });
    expect(preset("last30Days")).toEqual({
      end: "2026-09-24",
      start: "2026-08-26",
    });
  });

  it("starts the weeks on the first day of the week of the locale", () => {
    expect(preset("thisWeek")).toEqual({
      end: "2026-09-27",
      start: "2026-09-21",
    });
    expect(preset("lastWeek")).toEqual({
      end: "2026-09-20",
      start: "2026-09-14",
    });
    expect(preset("thisWeek", 0)).toEqual({
      end: "2026-09-26",
      start: "2026-09-20",
    });
  });

  it("takes whole months and years", () => {
    expect(preset("thisMonth")).toEqual({
      end: "2026-09-30",
      start: "2026-09-01",
    });
    expect(preset("lastMonth")).toEqual({
      end: "2026-08-31",
      start: "2026-08-01",
    });
    expect(preset("thisYear")).toEqual({
      end: "2026-12-31",
      start: "2026-01-01",
    });
    expect(preset("lastYear")).toEqual({
      end: "2025-12-31",
      start: "2025-01-01",
    });
  });

  it("goes back over the new year", () => {
    const january = d(2027, 1, 3);
    expect(toDateRange(getPresetRange("lastMonth", january, 1))).toEqual({
      end: "2026-12-31",
      start: "2026-12-01",
    });
    // Sunday, January 3 - the week started on Monday, December 28
    expect(toDateRange(getPresetRange("thisWeek", january, 1))).toEqual({
      end: "2027-01-03",
      start: "2026-12-28",
    });
  });
});
