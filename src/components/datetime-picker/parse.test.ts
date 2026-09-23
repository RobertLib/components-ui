import { describe, expect, it } from "vitest";
import {
  clampValue,
  isInRange,
  normalizeDateTime,
  parseDisplayValue,
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

  it("refuses texts without a year or of another shape", () => {
    expect(parseDisplayValue("24.09", "DD.MM.YYYY", "date")).toBeNull();
    expect(parseDisplayValue("tomorrow", "DD.MM.YYYY", "date")).toBeNull();
    expect(parseDisplayValue("", "DD.MM.YYYY", "date")).toBeNull();
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
