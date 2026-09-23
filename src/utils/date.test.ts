import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatPattern,
  getISOWeek,
  getISOWeeksInYear,
  getMonthDays,
  getMonthNames,
  getWeekdayNames,
  parseISODate,
  parsePattern,
  startOfWeek,
  toISODate,
  usesHour12,
} from "./date";

describe("formatPattern", () => {
  it("fills the tokens and keeps bracketed text", () => {
    const parts = {
      day: 4,
      hours: 9,
      minutes: 5,
      month: 3,
      week: 7,
      year: 2026,
    };
    expect(formatPattern("DD.MM.YYYY HH:mm", parts)).toBe("04.03.2026 09:05");
    expect(formatPattern("D. M. YYYY H:mm", parts)).toBe("4. 3. 2026 9:05");
    expect(formatPattern("[W]WW.YYYY", parts)).toBe("W07.2026");
    expect(formatPattern("MM/DD/YYYY", parts)).toBe("03/04/2026");
  });

  it("formats the 12-hour clock", () => {
    expect(formatPattern("h:mm A", { hours: 0, minutes: 5 })).toBe("12:05 AM");
    expect(formatPattern("hh:mm A", { hours: 9, minutes: 5 })).toBe("09:05 AM");
    expect(formatPattern("h:mm A", { hours: 12, minutes: 0 })).toBe("12:00 PM");
    expect(formatPattern("h:mm A", { hours: 21, minutes: 30 })).toBe("9:30 PM");
    expect(usesHour12("MM/DD/YYYY h:mm A")).toBe(true);
    expect(usesHour12("DD.MM.YYYY HH:mm")).toBe(false);
    expect(usesHour12("[hh] HH:mm")).toBe(false);
  });

  it("formats a Date", () => {
    expect(formatDate(new Date(2026, 8, 24, 14, 30), "DD.MM.YYYY HH:mm")).toBe(
      "24.09.2026 14:30",
    );
  });

  it("pairs the ISO week with the year it belongs to", () => {
    // Monday, December 30th 2024 is in the first week of 2025
    expect(formatDate(new Date(2024, 11, 30), "[W]WW.YYYY")).toBe("W01.2025");
    // Friday, January 1st 2027 is in the last week of 2026
    expect(formatDate(new Date(2027, 0, 1), "[W]WW YYYY")).toBe("W53 2026");
    // Without the week the calendar year
    expect(formatDate(new Date(2024, 11, 30), "DD.MM.YYYY")).toBe("30.12.2024");
  });
});

describe("ISO dates", () => {
  it("parses dates in local time", () => {
    const date = parseISODate("2026-09-24");
    expect(date?.getDate()).toBe(24);
    expect(date?.getHours()).toBe(0);
    expect(parseISODate("2026-09-24T10:00")?.getMonth()).toBe(8);
    expect(parseISODate("24.09.2026")).toBeNull();
    expect(parseISODate("")).toBeNull();
  });

  it("refuses days the month does not have", () => {
    expect(parseISODate("2026-02-31")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("2026-00-10")).toBeNull();
    expect(parseISODate("2028-02-29")?.getDate()).toBe(29);
  });

  it("keeps the years 0 - 99", () => {
    const date = parseISODate("0050-03-07");
    expect(date?.getFullYear()).toBe(50);
    expect(date?.getMonth()).toBe(2);
    expect(date && toISODate(date)).toBe("0050-03-07");
    // The year 0 was a leap year, 1900 was not
    expect(parseISODate("0000-02-29")?.getDate()).toBe(29);
  });

  it("formats dates in local time", () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("weeks", () => {
  it("computes ISO weeks, also around the new year", () => {
    expect(getISOWeek(new Date(2026, 8, 24))).toEqual({ week: 39, year: 2026 });
    expect(getISOWeek(new Date(2021, 0, 1))).toEqual({ week: 53, year: 2020 });
    expect(getISOWeek(new Date(2024, 11, 30))).toEqual({ week: 1, year: 2025 });
  });

  it("knows the years with 53 weeks", () => {
    expect(getISOWeeksInYear(2020)).toBe(53);
    expect(getISOWeeksInYear(2026)).toBe(53);
    expect(getISOWeeksInYear(2025)).toBe(52);
  });

  it("starts the week on the configured day", () => {
    const thursday = new Date(2026, 8, 24);
    expect(startOfWeek(thursday, 1).getDate()).toBe(21); // Monday
    expect(startOfWeek(thursday, 0).getDate()).toBe(20); // Sunday
  });

  it("pads a month grid to the first day of the week", () => {
    // September 2026 starts on a Tuesday
    expect(getMonthDays(new Date(2026, 8, 1), 1).slice(0, 2)).toEqual([
      null,
      new Date(2026, 8, 1),
    ]);
    expect(
      getMonthDays(new Date(2026, 8, 1), 0).filter((day) => !day),
    ).toHaveLength(2);
    expect(getMonthDays(new Date(2026, 8, 1), 1)).toHaveLength(31);
  });
});

describe("names from Intl", () => {
  it("returns capitalized names in the locale's order", () => {
    expect(getMonthNames("cs-CZ")[0]).toBe("Leden");
    expect(getWeekdayNames("cs-CZ", 1)[0]).toBe("Po");
    expect(getWeekdayNames("en-US", 0)[0]).toBe("Sun");
  });
});

describe("parsePattern", () => {
  it("reads what formatPattern writes", () => {
    expect(parsePattern("04.03.2026 09:05", "DD.MM.YYYY HH:mm")).toEqual({
      day: 4,
      hours: 9,
      minutes: 5,
      month: 3,
      year: 2026,
    });
    expect(parsePattern("W07.2026", "[W]WW.YYYY")).toEqual({
      week: 7,
      year: 2026,
    });
  });

  it("forgives separators, missing zeros and left-out bracketed text", () => {
    const date = { day: 4, month: 3, year: 2026 };
    expect(parsePattern("4.3.2026", "DD.MM.YYYY")).toEqual(date);
    expect(parsePattern(" 4-3-2026 ", "DD.MM.YYYY")).toEqual(date);
    expect(parsePattern("04032026", "DD.MM.YYYY")).toEqual(date);
    expect(parsePattern("7 2026", "[W]WW.YYYY")).toEqual({
      week: 7,
      year: 2026,
    });
  });

  it("reads AM and PM - or a 24-hour time without them", () => {
    expect(parsePattern("12:30 am", "h:mm A")).toEqual({
      hours: 0,
      minutes: 30,
    });
    expect(parsePattern("12:30 P.M.", "h:mm A")).toEqual({
      hours: 12,
      minutes: 30,
    });
    expect(parsePattern("9:05pm", "h:mm A")).toEqual({ hours: 21, minutes: 5 });
    expect(parsePattern("21:05", "h:mm A")).toEqual({ hours: 21, minutes: 5 });
    expect(parsePattern("13:05 PM", "h:mm A")).toBeNull();
  });

  it("refuses texts of another shape", () => {
    expect(parsePattern("tomorrow", "DD.MM.YYYY")).toBeNull();
    expect(parsePattern("4.3.26", "DD.MM.YYYY")).toBeNull();
    expect(parsePattern("4.3.2026 x", "DD.MM.YYYY")).toBeNull();
  });
});
