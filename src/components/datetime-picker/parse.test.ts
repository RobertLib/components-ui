import { describe, expect, it } from "vitest";
import {
  clampValue,
  getMinuteOptions,
  isInRange,
  isTimeInRange,
  normalizeDateTime,
  parseDisplayRange,
  parseDisplayValue,
  snapDateTime,
  snapTime,
} from "./parse";

describe("parseDisplayValue", () => {
  it("reads dates in the pattern of the locale", () => {
    expect(parseDisplayValue("24.9.2026", "DD.MM.YYYY", "date")).toBe(
      "2026-09-24",
    );
    expect(parseDisplayValue("09/24/2026", "MM/DD/YYYY", "date")).toBe(
      "2026-09-24",
    );
    expect(parseDisplayValue("24092026", "DD.MM.YYYY", "date")).toBe(
      "2026-09-24",
    );
  });

  it("refuses days the month does not have", () => {
    expect(parseDisplayValue("31.02.2026", "DD.MM.YYYY", "date")).toBeNull();
    expect(parseDisplayValue("29.02.2026", "DD.MM.YYYY", "date")).toBeNull();
    expect(parseDisplayValue("29.02.2028", "DD.MM.YYYY", "date")).toBe(
      "2028-02-29",
    );
    expect(parseDisplayValue("0.01.2026", "DD.MM.YYYY", "date")).toBeNull();
    expect(parseDisplayValue("01.13.2026", "DD.MM.YYYY", "date")).toBeNull();
  });

  it("checks leap years of the years 0 - 99 as they are", () => {
    // 1900 was no leap year, the year 0 was one
    expect(parseDisplayValue("29.02.0000", "DD.MM.YYYY", "date")).toBe(
      "0000-02-29",
    );
    // The year 1 was none
    expect(parseDisplayValue("29.02.0001", "DD.MM.YYYY", "date")).toBeNull();
    expect(parseDisplayValue("31.12.0050", "DD.MM.YYYY", "date")).toBe(
      "0050-12-31",
    );
  });

  it("reads date-times and refuses impossible times", () => {
    expect(
      parseDisplayValue(
        "24.09.2026 14:05",
        "DD.MM.YYYY HH:mm",
        "datetime-local",
      ),
    ).toBe("2026-09-24T14:05");
    expect(
      parseDisplayValue(
        "24.09.2026 24:00",
        "DD.MM.YYYY HH:mm",
        "datetime-local",
      ),
    ).toBeNull();
    expect(
      parseDisplayValue(
        "09/24/2026 12:30 am",
        "MM/DD/YYYY h:mm A",
        "datetime-local",
      ),
    ).toBe("2026-09-24T00:30");
    expect(parseDisplayValue("13:30 pm", "h:mm A", "time")).toBeNull();
    expect(parseDisplayValue("7:60", "HH:mm", "time")).toBeNull();
  });

  it("reads months and ISO weeks", () => {
    expect(parseDisplayValue("9.2026", "MM.YYYY", "month")).toBe("2026-09");
    expect(parseDisplayValue("13.2026", "MM.YYYY", "month")).toBeNull();
    expect(parseDisplayValue("W53.2026", "[W]WW.YYYY", "week")).toBe(
      "2026-W53",
    );
    // 2027 has 52 weeks
    expect(parseDisplayValue("W53.2027", "[W]WW.YYYY", "week")).toBeNull();
    expect(parseDisplayValue("W00.2027", "[W]WW.YYYY", "week")).toBeNull();
  });

  it("reads values pasted in ISO 8601 in any locale", () => {
    const value = (text: string, type: "date" | "datetime-local") =>
      parseDisplayValue(
        text,
        type === "date" ? "DD.MM.YYYY" : "MM/DD/YYYY h:mm A",
        type,
      );

    expect(value("2026-09-24", "date")).toBe("2026-09-24");
    expect(value(" 2026-09-24 ", "date")).toBe("2026-09-24");
    expect(value("2026-09-24T14:30", "datetime-local")).toBe(
      "2026-09-24T14:30",
    );
    expect(value("2026-09-24 14:30:59.123", "datetime-local")).toBe(
      "2026-09-24T14:30",
    );
    // A date-time into a date field gives its day
    expect(value("2026-09-24T14:30", "date")).toBe("2026-09-24");
    // A day the month does not have, or no date-time without its time
    expect(value("2026-02-31", "date")).toBeNull();
    expect(value("2026-09-24", "datetime-local")).toBeNull();
    expect(value("2026-09-24T24:00", "datetime-local")).toBeNull();

    expect(parseDisplayValue("2026-09", "MM.YYYY", "month")).toBe("2026-09");
    expect(parseDisplayValue("2026-13", "MM.YYYY", "month")).toBeNull();
    expect(parseDisplayValue("2026-W39", "[W]WW.YYYY", "week")).toBe(
      "2026-W39",
    );
    expect(parseDisplayValue("2027-W53", "[W]WW.YYYY", "week")).toBeNull();
    expect(parseDisplayValue("14:30:00", "h:mm A", "time")).toBe("14:30");
  });

  it("reads an ISO date-time with a zone on the local clock", () => {
    const local = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

    for (const [text, moment] of [
      ["2026-09-24T12:30:00Z", "2026-09-24T12:30:00Z"],
      ["2026-09-24T12:30:00.000Z", "2026-09-24T12:30:00Z"],
      ["2026-09-24T12:30+02:00", "2026-09-24T10:30:00Z"],
      ["2026-09-24T12:30+0200", "2026-09-24T10:30:00Z"],
      ["2026-09-24T12:30-05", "2026-09-24T17:30:00Z"],
    ]) {
      expect(
        parseDisplayValue(text, "DD.MM.YYYY HH:mm", "datetime-local"),
        text,
      ).toBe(local(new Date(moment)));
    }
  });

  it("refuses texts of another shape", () => {
    expect(parseDisplayValue("tomorrow", "DD.MM.YYYY", "date")).toBeNull();
    expect(parseDisplayValue("", "DD.MM.YYYY", "date")).toBeNull();
    expect(parseDisplayValue("24.9.202", "DD.MM.YYYY", "date")).toBeNull();
  });
});

describe("parseDisplayValue of short years", () => {
  // Friday, September 25, 2026
  const today = new Date(2026, 8, 25);
  const parse = (text: string, pattern: string, type = "date" as const) =>
    parseDisplayValue(text, pattern, type, undefined, today);

  it("takes a year left out for the current one", () => {
    expect(parse("24.9.", "DD.MM.YYYY")).toBe("2026-09-24");
    expect(parse("24.9", "DD.MM.YYYY")).toBe("2026-09-24");
    expect(parse("2409", "DD.MM.YYYY")).toBe("2026-09-24");
    expect(parse("9/24", "MM/DD/YYYY")).toBe("2026-09-24");
    // 2026 is no leap year
    expect(parse("29.2.", "DD.MM.YYYY")).toBeNull();
  });

  it("reads two digits as a year of the 80 before this one or the 19 after", () => {
    expect(parse("24.9.26", "DD.MM.YYYY")).toBe("2026-09-24");
    expect(parse("9/24/26", "MM/DD/YYYY")).toBe("2026-09-24");
    expect(parse("3.7.85", "DD.MM.YYYY")).toBe("1985-07-03");
    expect(parse("1.1.46", "DD.MM.YYYY")).toBe("1946-01-01");
    expect(parse("31.12.45", "DD.MM.YYYY")).toBe("2045-12-31");
    expect(parse("240926", "DD.MM.YYYY")).toBe("2026-09-24");
    // Four digits are the year itself
    expect(parse("24.9.0026", "DD.MM.YYYY")).toBe("0026-09-24");
  });

  it("reads the date-times, months and weeks the same way", () => {
    const dateTime = (text: string, pattern: string) =>
      parseDisplayValue(text, pattern, "datetime-local", undefined, today);
    const month = (text: string) =>
      parseDisplayValue(text, "MM.YYYY", "month", undefined, today);
    const week = (text: string) =>
      parseDisplayValue(text, "[W]WW.YYYY", "week", undefined, today);

    expect(dateTime("24.9. 14:30", "DD.MM.YYYY HH:mm")).toBe(
      "2026-09-24T14:30",
    );
    expect(dateTime("24.9 12:05", "DD.MM.YYYY HH:mm")).toBe("2026-09-24T12:05");
    expect(dateTime("24.9.14 10:00", "DD.MM.YYYY HH:mm")).toBe(
      "2014-09-24T10:00",
    );
    expect(dateTime("9/24 12:05 PM", "MM/DD/YYYY h:mm A")).toBe(
      "2026-09-24T12:05",
    );
    // A date-time needs a time - the year is no 20:26
    expect(dateTime("24.9.2026", "DD.MM.YYYY HH:mm")).toBeNull();

    expect(month("9.26")).toBe("2026-09");
    expect(month("12")).toBe("2026-12");
    expect(week("W39.26")).toBe("2026-W39");
    expect(week("39")).toBe("2026-W39");
    // The year of this week - December 29, 2025 is in the first one of 2026
    expect(
      parseDisplayValue(
        "W1",
        "[W]WW.YYYY",
        "week",
        undefined,
        new Date(2025, 11, 29),
      ),
    ).toBe("2026-W01");
  });
});

describe("parseDisplayValue of times", () => {
  it("reads a time without its minutes as the full hour", () => {
    expect(parseDisplayValue("14", "HH:mm", "time")).toBe("14:00");
    expect(
      parseDisplayValue("24.9.2026 14", "DD.MM.YYYY HH:mm", "datetime-local"),
    ).toBe("2026-09-24T14:00");
    expect(parseDisplayValue("10 pm", "h:mm A", "time")).toBe("22:00");
    expect(parseDisplayValue("11 am", "h:mm A", "time")).toBe("11:00");
    expect(parseDisplayValue("12pm", "h:mm A", "time")).toBe("12:00");
    expect(parseDisplayValue("10", "h:mm A", "time")).toBe("10:00");
    expect(parseDisplayValue("5 pm", "h:mm A", "time")).toBe("17:00");
    expect(parseDisplayValue("8", "HH:mm", "time")).toBe("08:00");
    expect(parseDisplayValue("930", "HH:mm", "time")).toBe("09:30");
    expect(parseDisplayValue("1430", "HH:mm", "time")).toBe("14:30");
  });

  it("reads AM and PM of the locale", () => {
    expect(
      parseDisplayValue("9:05 odp.", "h:mm A", "time", ["dop.", "odp."]),
    ).toBe("21:05");
  });

  it("writes years below 1000 with four digits", () => {
    expect(parseDisplayValue("5.999", "MM.YYYY", "month")).toBeNull();
    expect(parseDisplayValue("5.0999", "MM.YYYY", "month")).toBe("0999-05");
    expect(parseDisplayValue("W07.0999", "[W]WW.YYYY", "week")).toBe(
      "0999-W07",
    );
  });
});

describe("time ranges and steps", () => {
  it("lets a reversed range span midnight", () => {
    expect(isTimeInRange("23:00", "22:00", "06:00")).toBe(true);
    expect(isTimeInRange("05:59", "22:00", "06:00")).toBe(true);
    expect(isTimeInRange("12:00", "22:00", "06:00")).toBe(false);
    expect(isTimeInRange("12:00", "09:00", "17:00")).toBe(true);
    expect(isTimeInRange("18:00", "09:00", "17:00")).toBe(false);
    expect(isTimeInRange("18:00", undefined, "17:00")).toBe(false);
  });

  it("moves a time onto the nearest minute of the step", () => {
    expect(snapTime("10:07", 15)).toBe("10:00");
    expect(snapTime("10:08", 15)).toBe("10:15");
    expect(snapTime("12:34", 15)).toBe("12:30");
    // Half way - up, like rounding
    expect(snapTime("10:05", 10)).toBe("10:10");
    expect(snapTime("10:53", 15)).toBe("11:00");
    // Never over midnight
    expect(snapTime("23:58", 15)).toBe("23:45");
    expect(snapTime("10:07", 1)).toBe("10:07");
  });

  it("keeps the snapped time between min and max", () => {
    expect(snapTime("09:10", 15, "09:10")).toBe("09:15");
    expect(snapTime("09:00", 15, "09:10")).toBe("09:15");
    expect(snapTime("17:08", 15, undefined, "17:10")).toBe("17:00");
    expect(snapTime("16:50", 15, "09:00", "17:00")).toBe("16:45");
    // Outside a range over midnight - to its nearer end
    expect(snapTime("12:00", 15, "22:00", "06:00")).toBe("06:00");
    expect(snapTime("20:00", 15, "22:00", "06:00")).toBe("22:00");
    // No minute of the step in the range - the range wins
    expect(snapTime("09:00", 15, "09:10", "09:14")).toBe("09:10");
  });

  it("snaps the time of a date-time with the limits of its day", () => {
    expect(
      snapDateTime("2030-01-01T12:10", 15, "2030-01-01T12:10", undefined),
    ).toBe("2030-01-01T12:15");
    expect(snapDateTime("2030-01-02T12:10", 15, "2030-01-01T12:10")).toBe(
      "2030-01-02T12:15",
    );
    expect(
      snapDateTime("2030-01-31T18:05", 15, undefined, "2030-01-31T18:05"),
    ).toBe("2030-01-31T18:00");
  });

  it("moves a date-time on to the next midnight when it is nearer", () => {
    expect(snapDateTime("2026-09-24T23:58", 5)).toBe("2026-09-25T00:00");
    expect(snapDateTime("2026-12-31T23:53", 15)).toBe("2027-01-01T00:00");
    // Half way - the later one
    expect(snapDateTime("2026-09-24T23:50", 20)).toBe("2026-09-25T00:00");
    expect(snapDateTime("2026-09-24T23:56", 5)).toBe("2026-09-24T23:55");
    // Not past max
    expect(
      snapDateTime("2026-09-24T23:58", 5, undefined, "2026-09-24T23:59"),
    ).toBe("2026-09-24T23:55");
    expect(
      snapDateTime("2026-09-24T23:58", 5, undefined, "2026-09-25T00:00"),
    ).toBe("2026-09-25T00:00");
    // A time alone stays on its day
    expect(snapTime("23:58", 5)).toBe("23:55");
  });

  it("offers the minutes of a step", () => {
    expect(getMinuteOptions(15)).toEqual(["00", "15", "30", "45"]);
    expect(getMinuteOptions(7)).toHaveLength(9);
  });
});

describe("value ranges", () => {
  it("compares values of one format as strings", () => {
    expect(clampValue("08:00", "09:30", "17:00")).toBe("09:30");
    expect(clampValue("18:00", "09:30", "17:00")).toBe("17:00");
    expect(isInRange("2026-W05", "2026-W01", "2026-W10")).toBe(true);
    expect(isInRange("2026-11", undefined, "2026-10")).toBe(false);
    expect(normalizeDateTime("2026-09-24", "23:59")).toBe("2026-09-24T23:59");
    expect(normalizeDateTime("2026-09-24T10:15:30", "00:00")).toBe(
      "2026-09-24T10:15",
    );
  });
});

describe("parseDisplayRange", () => {
  const september = { end: "2026-09-30", start: "2026-09-01" };

  it("reads two days in the pattern of the locale", () => {
    expect(parseDisplayRange("01.09.2026 – 30.09.2026", "DD.MM.YYYY")).toEqual(
      september,
    );
    expect(parseDisplayRange("09/01/2026 – 09/30/2026", "MM/DD/YYYY")).toEqual(
      september,
    );
  });

  it("takes anything but digits between the days", () => {
    for (const text of [
      "1.9.2026-30.9.2026",
      "1.9.2026 - 30.9.2026",
      "1.9.2026 — 30.9.2026",
      "1.9.2026 ~ 30.9.2026",
      "1.9.2026..30.9.2026",
      "1.9.2026 30.9.2026",
      "1.9.2026 to 30.9.2026",
      " 1. 9. 2026 až 30. 9. 2026 ",
      // Hyphens in the days too
      "1-9-2026-30-9-2026",
      // Digits only
      "0109202630092026",
    ]) {
      expect(parseDisplayRange(text, "DD.MM.YYYY"), text).toEqual(september);
    }
  });

  it("swaps a reversed pair and reads one day as a range of it", () => {
    expect(parseDisplayRange("30.9.2026 – 1.9.2026", "DD.MM.YYYY")).toEqual(
      september,
    );
    expect(parseDisplayRange("24.9.2026", "DD.MM.YYYY")).toEqual({
      end: "2026-09-24",
      start: "2026-09-24",
    });
    expect(parseDisplayRange("24.9.2026 –", "DD.MM.YYYY")).toEqual({
      end: "2026-09-24",
      start: "2026-09-24",
    });
  });

  it("reads the days with the year left out or of two digits", () => {
    const today = new Date(2026, 8, 25);
    for (const text of ["1.9. – 30.9.", "1.9 30.9", "1.9.26 – 30.9.26"]) {
      expect(parseDisplayRange(text, "DD.MM.YYYY", today), text).toEqual(
        september,
      );
    }
    expect(parseDisplayRange("9/1 - 9/30/26", "MM/DD/YYYY", today)).toEqual(
      september,
    );
  });

  it("never splits a number between the two days", () => {
    const today = new Date(2026, 8, 25);
    // "9/2" and "4 - 9/30" would be days too - April 9, 2030
    for (const [text, pattern, start, end] of [
      ["9/24 - 9/30", "MM/DD/YYYY", "2026-09-24", "2026-09-30"],
      ["9/24-9/30", "MM/DD/YYYY", "2026-09-24", "2026-09-30"],
      ["9/24 9/30", "MM/DD/YYYY", "2026-09-24", "2026-09-30"],
      ["1/15 - 1/20", "MM/DD/YYYY", "2026-01-15", "2026-01-20"],
      ["1.12 - 5.12", "DD.MM.YYYY", "2026-12-01", "2026-12-05"],
      ["24.9 - 1.10", "DD.MM.YYYY", "2026-09-24", "2026-10-01"],
    ]) {
      expect(parseDisplayRange(text, pattern, today), text).toEqual({
        end,
        start,
      });
    }
  });

  it("reads the month written once, where the pattern has it", () => {
    const today = new Date(2026, 8, 25);
    for (const text of [
      "24.–30.9.2026",
      "24 - 30.9.2026",
      "24.-30.9.",
      "24 30.9.",
      "30.–24.9.",
    ]) {
      expect(parseDisplayRange(text, "DD.MM.YYYY", today), text).toEqual({
        end: "2026-09-30",
        start: "2026-09-24",
      });
    }
    // A month before the day - the second day leaves it out
    for (const text of ["9/24–30", "9/24 - 30/2026", "9/24 to 30"]) {
      expect(parseDisplayRange(text, "MM/DD/YYYY", today), text).toEqual({
        end: "2026-09-30",
        start: "2026-09-24",
      });
    }
    // Also a second day of 1 - 12 with the year - `10/2026` is no October
    // 20, 2026, its 2026 split into the 20th and 26
    for (let day = 1; day <= 12; day++) {
      const text = `9/5 – ${day}/2026`;
      expect(parseDisplayRange(text, "MM/DD/YYYY", today), text).toEqual(
        day < 5
          ? { end: "2026-09-05", start: `2026-09-0${day}` }
          : {
              end: `2026-09-${String(day).padStart(2, "0")}`,
              start: "2026-09-05",
            },
      );
    }
    expect(parseDisplayRange("5.–10.9.2026", "DD.MM.YYYY", today)).toEqual({
      end: "2026-09-10",
      start: "2026-09-05",
    });
    // A day of a two-digit year comes first - as the docs say
    expect(parseDisplayRange("9/24 - 30", "MM/DD/YYYY", today)).toEqual({
      end: "2030-09-24",
      start: "2030-09-24",
    });
    // Two whole days stay two whole days
    expect(parseDisplayRange("9/5 – 10/20/2026", "MM/DD/YYYY", today)).toEqual({
      end: "2026-10-20",
      start: "2026-09-05",
    });
    // Only with something between the days the date itself does not use -
    // "1.10.12" is a day, and "31.9 3.10" no 31st and 9.3.2010
    expect(parseDisplayRange("1.10.12", "DD.MM.YYYY", today)).toEqual({
      end: "2012-10-01",
      start: "2012-10-01",
    });
    expect(parseDisplayRange("31.9 3.10", "DD.MM.YYYY", today)).toBeNull();
    expect(parseDisplayRange("31.–5.2.2026", "DD.MM.YYYY", today)).toBeNull();
  });

  it("fills in the years left out over the new year", () => {
    const today = new Date(2026, 11, 20);
    const range = (text: string, pattern = "DD.MM.YYYY") =>
      parseDisplayRange(text, pattern, today);
    const holidays = { end: "2027-01-03", start: "2026-12-28" };

    // The second day is in the next year - not all of 2026 swapped
    expect(range("28.12. – 3.1.")).toEqual(holidays);
    expect(range("28.12.2026 – 3.1.")).toEqual(holidays);
    expect(range("12/28 - 1/3", "MM/DD/YYYY")).toEqual(holidays);
    // The first day takes the year of the second
    expect(range("28.12. – 3.1.2027")).toEqual(holidays);
    expect(range("1.2. – 3.2.2027")).toEqual({
      end: "2027-02-03",
      start: "2027-02-01",
    });
    // A reversed pair of one year is still swapped - the shorter range
    expect(range("30.9. – 1.9.")).toEqual({
      end: "2026-09-30",
      start: "2026-09-01",
    });
    // February 29 of the year it goes into
    expect(range("28.12.2027 – 29.2.")).toEqual({
      end: "2028-02-29",
      start: "2027-12-28",
    });
  });

  it("reads days pasted in ISO 8601", () => {
    for (const text of [
      "2026-09-01/2026-09-30",
      "2026-09-01 – 2026-09-30",
      "2026-09-01 30.9.2026",
    ]) {
      expect(parseDisplayRange(text, "DD.MM.YYYY"), text).toEqual(september);
    }
  });

  it("refuses a text that is no range of real days", () => {
    for (const text of [
      "",
      "31.2.2026 – 5.3.2026",
      "1.9.2026 – 31.9.2026",
      "1.9.2026 – next week",
      "1.9.2026 – 30.9.2026 – 31.10.2026",
    ]) {
      expect(parseDisplayRange(text, "DD.MM.YYYY"), text).toBeNull();
    }
  });
});
