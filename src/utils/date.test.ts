import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  addMonths,
  capitalize,
  existingDayOf,
  expandTwoDigitYear,
  formatDate,
  formatMonthYear,
  formatPattern,
  formatPlaceholder,
  getDayPeriods,
  getISOWeek,
  getISOWeeksInYear,
  getMonthDays,
  getMonthNames,
  getWeekdayNames,
  isDayBeforeMonth,
  parseISODate,
  parsePattern,
  shiftDay,
  startOfWeek,
  toISODate,
  usesHour12,
  withoutMonth,
  withoutYear,
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
    expect(parsePattern("4.3.2026 x", "DD.MM.YYYY")).toBeNull();
    expect(parsePattern("4.3.202", "DD.MM.YYYY")).toBeNull();
  });

  it("reads a year of two digits, or none, after the day and month", () => {
    expect(parsePattern("4.3.26", "DD.MM.YYYY", undefined, 2026)).toEqual({
      day: 4,
      month: 3,
      year: 2026,
    });
    expect(parsePattern("4.3.85", "DD.MM.YYYY", undefined, 2026)).toEqual({
      day: 4,
      month: 3,
      year: 1985,
    });
    // A year left out is none - the caller puts it in
    expect(parsePattern("4.3.", "DD.MM.YYYY")).toEqual({ day: 4, month: 3 });
    expect(parsePattern("3/4", "MM/DD/YYYY")).toEqual({ day: 4, month: 3 });
    expect(parsePattern("W7", "[W]WW.YYYY")).toEqual({ week: 7 });
    // Before the day and month the year keeps its four digits
    expect(parsePattern("26-03-04", "YYYY-MM-DD")).toBeNull();
    expect(parsePattern("03-04", "YYYY-MM-DD")).toBeNull();
  });

  it("does not take the numbers of a time for a year", () => {
    const pattern = "DD.MM.YYYY HH:mm";
    expect(parsePattern("4.3 12:05", pattern)).toEqual({
      day: 4,
      hours: 12,
      minutes: 5,
      month: 3,
    });
    expect(parsePattern("4.3.26 12:05", pattern, undefined, 2026)).toEqual({
      day: 4,
      hours: 12,
      minutes: 5,
      month: 3,
      year: 2026,
    });
    // Without a time the digits of the year are no 20:26
    expect(parsePattern("4.3.2026", pattern)).toBeNull();
  });

  it("needs two digits each of a day and a month typed without a year", () => {
    expect(parsePattern("0403", "DD.MM.YYYY")).toEqual({ day: 4, month: 3 });
    expect(parsePattern("12", "DD.MM.YYYY")).toBeNull();
    expect(parsePattern("12.", "DD.MM.YYYY")).toBeNull();
    expect(parsePattern("243", "DD.MM.YYYY")).toBeNull();
    expect(parsePattern("1.2", "DD.MM.YYYY")).toEqual({ day: 1, month: 2 });
  });

  it("reads a time without its minutes as the full hour", () => {
    expect(parsePattern("14", "HH:mm")).toEqual({ hours: 14 });
    expect(parsePattern("8", "HH:mm")).toEqual({ hours: 8 });
    expect(parsePattern("24.9.2026 14", "DD.MM.YYYY HH:mm")).toEqual({
      day: 24,
      hours: 14,
      month: 9,
      year: 2026,
    });
    expect(parsePattern("10 pm", "h:mm A")).toEqual({ hours: 22 });
    expect(parsePattern("11 am", "h:mm A")).toEqual({ hours: 11 });
    expect(parsePattern("12pm", "h:mm A")).toEqual({ hours: 12 });
    expect(parsePattern("5 pm", "h:mm A")).toEqual({ hours: 17 });
    expect(parsePattern("10", "h:mm A")).toEqual({ hours: 10 });
  });

  it("takes the last two digits typed without a separator as the minutes", () => {
    expect(parsePattern("930", "HH:mm")).toEqual({ hours: 9, minutes: 30 });
    expect(parsePattern("1430", "HH:mm")).toEqual({ hours: 14, minutes: 30 });
    expect(parsePattern("145", "HH:mm")).toEqual({ hours: 1, minutes: 45 });
    expect(parsePattern("2359", "HH:mm")).toEqual({ hours: 23, minutes: 59 });
    expect(parsePattern("930pm", "h:mm A")).toEqual({ hours: 21, minutes: 30 });
    expect(parsePattern("09/24/2026 1015 am", "MM/DD/YYYY h:mm A")).toEqual({
      day: 24,
      hours: 10,
      minutes: 15,
      month: 9,
      year: 2026,
    });
    // One digit of the minutes only after a separator
    expect(parsePattern("9:5", "HH:mm")).toEqual({ hours: 9, minutes: 5 });
    expect(parsePattern("95", "HH:mm")).toBeNull();
    expect(parsePattern("2400", "HH:mm")).toBeNull();
    expect(parsePattern("9:60", "HH:mm")).toBeNull();
  });

  it("splits digits typed without separators into numbers that fit", () => {
    // 92.4.2026 is no date - 9.24.2026 is
    expect(parsePattern("9242026", "MM/DD/YYYY")).toEqual({
      day: 24,
      month: 9,
      year: 2026,
    });
    expect(parsePattern("1122026", "DD.MM.YYYY")).toEqual({
      day: 11,
      month: 2,
      year: 2026,
    });
    expect(parsePattern("2026924", "YYYY-MM-DD")).toEqual({
      day: 24,
      month: 9,
      year: 2026,
    });
    expect(parsePattern("2026-09-24 14", "YYYY-MM-DD HH:mm")).toEqual({
      day: 24,
      hours: 14,
      month: 9,
      year: 2026,
    });
    expect(parsePattern("532026", "[W]WW.YYYY")).toEqual({
      week: 53,
      year: 2026,
    });
    // Minutes followed by a date are not left out - "14 24.9.2026" would
    // be 14:24 on no date
    expect(parsePattern("1430 24.9.2026", "HH:mm DD.MM.YYYY")).toEqual({
      day: 24,
      hours: 14,
      minutes: 30,
      month: 9,
      year: 2026,
    });
    expect(parsePattern("14 24.9.2026", "HH:mm DD.MM.YYYY")).toBeNull();
  });

  it("reads AM and PM in the language of the locale", () => {
    const czech = ["dop.", "odp."] as const;
    expect(parsePattern("9:05 odp.", "h:mm A", czech)).toEqual({
      hours: 21,
      minutes: 5,
    });
    expect(parsePattern("12 DOP.", "h:mm A", czech)).toEqual({ hours: 0 });
    // Spanish writes "p. m." with a no-break space
    expect(parsePattern("9 p. m.", "h:mm A", ["a. m.", "p. m."])).toEqual({
      hours: 21,
    });
    // The English letters are understood in any language
    expect(parsePattern("9:05 pm", "h:mm A", czech)).toEqual({
      hours: 21,
      minutes: 5,
    });
  });
});

describe("expandTwoDigitYear", () => {
  it("takes the year of the 80 years before the current one and the 19 after", () => {
    expect(expandTwoDigitYear(26, 2026)).toBe(2026);
    expect(expandTwoDigitYear(45, 2026)).toBe(2045);
    expect(expandTwoDigitYear(46, 2026)).toBe(1946);
    expect(expandTwoDigitYear(99, 2026)).toBe(1999);
    expect(expandTwoDigitYear(0, 2026)).toBe(2000);
    expect(expandTwoDigitYear(80, 2060)).toBe(1980);
    expect(expandTwoDigitYear(79, 2060)).toBe(2079);
  });
});

describe("formatPattern with a locale", () => {
  it("writes AM and PM of the locale", () => {
    expect(
      formatPattern("h:mm A", { hours: 21, minutes: 5 }, ["dop.", "odp."]),
    ).toBe("9:05 odp.");
    expect(formatPattern("h A", { hours: 0 })).toBe("12 AM");
  });

  it("takes AM and PM from Intl", () => {
    expect(getDayPeriods("en-US")).toEqual(["AM", "PM"]);
    expect(getDayPeriods("cs-CZ")).toEqual(["dop.", "odp."]);
  });

  it("drops the year of a week pattern for the week buttons", () => {
    expect(withoutYear("[W]WW.YYYY")).toBe("[W]WW");
    expect(withoutYear("[W]WW YYYY")).toBe("[W]WW");
    expect(withoutYear("[KW] WW YYYY")).toBe("[KW] WW");
    expect(withoutYear("YYYY-[W]WW")).toBe("[W]WW");
    expect(withoutYear("[YYYY] WW YYYY")).toBe("[YYYY] WW");
  });

  it("drops the month of a date pattern for a day typed without it", () => {
    expect(withoutMonth("DD.MM.YYYY")).toBe("DD.YYYY");
    expect(withoutMonth("MM/DD/YYYY")).toBe("DD/YYYY");
    expect(withoutMonth("D. M. YYYY")).toBe("D. YYYY");
    expect(isDayBeforeMonth("DD.MM.YYYY")).toBe(true);
    expect(isDayBeforeMonth("MM/DD/YYYY")).toBe(false);
    expect(isDayBeforeMonth("YYYY-MM-DD")).toBe(false);
  });
});

describe("years 0 - 99", () => {
  it("builds the month grid of such a year", () => {
    const days = getMonthDays(new Date(parseISODate("0050-03-01")!), 1);
    const first = days.find((day) => day !== null);
    expect(first?.getFullYear()).toBe(50);
    expect(days.filter(Boolean)).toHaveLength(31);
    // March 1st of the year 50 was a Tuesday - Monday before it is empty
    expect(days.indexOf(first!)).toBe(1);
  });

  it("counts the ISO weeks of such a year", () => {
    // The year 4 started on a Thursday (proleptic Gregorian calendar)
    expect(getISOWeeksInYear(4)).toBe(53);
    expect(getISOWeeksInYear(1904)).toBe(52);
    expect(getISOWeeksInYear(5)).toBe(52);
  });
});

// Samoa went from Thursday, December 29, 2011 to Saturday, December 31
describe("a day the time zone skips (Pacific/Apia)", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Pacific/Apia";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  it("is no day of the month grid - its cell stays empty", () => {
    const days = getMonthDays(new Date(2011, 11, 1), 0);
    expect(days.slice(-3)).toEqual([
      new Date(2011, 11, 29),
      null,
      new Date(2011, 11, 31),
    ]);
    // The Saturday under Saturday
    expect(days.at(-1)?.getDay()).toBe(6);
    expect(days.length % 7).toBe(0);
  });

  it("is none of the days of the calendar", () => {
    expect(existingDayOf(2011, 11, 30)).toBeNull();
    expect(existingDayOf(2011, 11, 29)).toEqual(new Date(2011, 11, 29));
    // Out of the month, like dateOf
    expect(existingDayOf(2011, 10, 60)).toBeNull();
    expect(existingDayOf(2011, 10, 61)).toEqual(new Date(2011, 11, 31));
  });

  it("is stepped over in the direction of the step", () => {
    expect(shiftDay(new Date(2011, 11, 29), 1)).toEqual(new Date(2011, 11, 31));
    expect(shiftDay(new Date(2011, 11, 31), -1)).toEqual(
      new Date(2011, 11, 29),
    );
    expect(shiftDay(new Date(2012, 0, 6), -7)).toEqual(new Date(2011, 11, 29));
    // Towards the day the step starts from
    expect(shiftDay(new Date(2011, 11, 29), 1, -1)).toEqual(
      new Date(2011, 11, 29),
    );
  });
});

describe("names from Intl with an invalid locale code", () => {
  it("falls back to en-US with a warning instead of throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getMonthNames("en_GB")[0]).toBe("January");
    expect(getWeekdayNames("", 1)[0]).toBe("Mon");
    expect(formatMonthYear(new Date(2026, 8, 1), "en_GB")).toBe(
      "September 2026",
    );
    expect(capitalize("září", "en_GB")).toBe("Září");
    expect(getDayPeriods("en_GB")).toEqual(["AM", "PM"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"en_GB"'));
  });
});

describe("formatPlaceholder", () => {
  it("writes the tokens of a pattern as the language does", () => {
    expect(formatPlaceholder("DD.MM.YYYY", { YYYY: "RRRR" })).toBe(
      "DD.MM.RRRR",
    );
    expect(formatPlaceholder("MM/DD/YYYY h:mm A", { A: "AM/PM" })).toBe(
      "MM/DD/YYYY h:mm AM/PM",
    );
    // Without the bracketed text and the separators next to it - and every
    // token left as it is
    expect(formatPlaceholder("[W]WW.YYYY")).toBe("WW.YYYY");
    expect(formatPlaceholder("[KW] WW YYYY", { WW: "WW" })).toBe("WW YYYY");
    expect(formatPlaceholder("WW YYYY [KW]")).toBe("WW YYYY");
    expect(formatPlaceholder("DD [de] MM")).toBe("DD MM");
  });
});

describe("addMonths", () => {
  it("keeps the day of the month - or goes to the last one", () => {
    expect(addMonths(new Date(2026, 0, 31, 15), 1)).toEqual(
      new Date(2026, 1, 28),
    );
    expect(addMonths(new Date(2024, 0, 31), 1)).toEqual(new Date(2024, 1, 29));
    expect(addMonths(new Date(2026, 8, 24), -12)).toEqual(
      new Date(2025, 8, 24),
    );
    expect(addMonths(new Date(2026, 11, 31), 2)).toEqual(new Date(2027, 1, 28));
  });
});
