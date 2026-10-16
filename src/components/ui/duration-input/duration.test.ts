import { describe, expect, it } from "vitest";
import {
  getDurationFormat,
  parseIsoDuration,
  toIsoDuration,
  type DurationUnit,
} from "./duration";

const cs = getDurationFormat("cs-CZ");
const en = getDurationFormat("en-US");

const minutesOf = (text: string, defaultUnit: DurationUnit = "minutes") =>
  en.parse(text, defaultUnit);

// Intl puts plain or no-break spaces in by the version of its data
const plain = (text: string) => text.replace(/\s/g, " ");

describe("getDurationFormat - format", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [45, "0:45"],
    [90, "1:30"],
    [480, "8:00"],
    [7500, "125:00"],
    [100_000, "1666:40"],
  ])("writes %i minutes on a clock as %s", (minutes, text) => {
    expect(en.format(minutes, "clock")).toBe(text);
    expect(cs.format(minutes, "clock")).toBe(text);
  });

  it("writes units as the locale does, leaving out zero parts", () => {
    expect(plain(cs.format(90, "units"))).toBe("1 h 30 min");
    expect(plain(cs.format(60, "units"))).toBe("1 h");
    expect(plain(cs.format(45, "units"))).toBe("45 min");
    expect(plain(cs.format(0, "units"))).toBe("0 min");
    // No grouping - the text is read back as it is shown
    expect(plain(cs.format(75_000, "units"))).toBe("1250 h");
    expect(plain(en.format(90, "units"))).toBe("1 hr 30 min");
    expect(plain(en.format(120, "units"))).toBe("2 hr");
  });

  it("writes the long form for screen readers", () => {
    expect(plain(en.formatLong(90))).toBe("1 hour, 30 minutes");
    expect(plain(en.formatLong(1))).toBe("1 minute");
    expect(plain(en.formatLong(0))).toBe("0 minutes");
    expect(plain(cs.formatLong(90))).toBe("1 hodina a 30 minut");
    expect(plain(cs.formatLong(125))).toBe("2 hodiny a 5 minut");
    expect(plain(cs.formatLong(300))).toBe("5 hodin");
  });

  it("writes a negative value with a minus sign", () => {
    expect(en.format(-30, "clock")).toBe("-0:30");
    expect(plain(en.format(-90, "units"))).toBe("-1 hr 30 min");
    expect(plain(en.formatLong(-60))).toBe("-1 hour");
  });

  it("writes the digits of the locale's numbering system", () => {
    const arabic = getDurationFormat("ar-EG");
    const text = arabic.format(90, "clock");
    expect(text).toBe("١:٣٠");
    expect(arabic.parse(text, "minutes")).toEqual({ minutes: 90 });
    expect(arabic.parse(arabic.format(90, "units"), "minutes")).toEqual({
      minutes: 90,
    });
  });

  it("tells apart the units of words alike without their diacritics", () => {
    // Malayalam - the hour "മ" is the minute "മി" without its vowel sign
    const malayalam = getDurationFormat("ml-IN");
    expect(malayalam.parse("2 മ", "minutes")).toEqual({ minutes: 120 });
    expect(malayalam.parse("2 മി.", "minutes")).toEqual({ minutes: 2 });
    expect(malayalam.parse("1 മ, 30 മി.", "minutes")).toEqual({
      minutes: 90,
    });
  });

  it("reads the abbreviation marks of the locale", () => {
    // The geresh of Hebrew, the abbreviation sign of Hindi
    expect(getDurationFormat("he-IL").parse("1 שעה 30 דק׳", "minutes")).toEqual(
      { minutes: 90 },
    );
    expect(getDurationFormat("hi-IN").parse("1 घं॰ 30 मि॰", "minutes")).toEqual(
      { minutes: 90 },
    );
  });

  it.each(["he-IL", "sw-KE", "si-LK"])(
    "writes a clock for units it cannot read back in %s",
    (locale) => {
      // A number in words, or the unit before the number
      const format = getDurationFormat(locale);
      expect(format.format(120, "units")).toBe(format.format(120, "clock"));
    },
  );

  it.each(["he-IL", "sw-KE", "si-LK", "ha-NG", "my-MM", "or-IN"])(
    "reads the text of its field in %s",
    (locale) => {
      const format = getDurationFormat(locale);
      for (const minutes of [0, 1, 2, 5, 45, 60, 61, 90, 120, 125, 1500]) {
        for (const display of ["clock", "units"] as const) {
          expect(
            format.parse(format.format(minutes, display), "minutes"),
          ).toEqual({ minutes });
        }
      }
    },
  );

  it.each([
    "de-DE",
    "sk-SK",
    "pl-PL",
    "fr-FR",
    "en-GB",
    "ja-JP",
    "hi-IN",
    "ml-IN",
    "sd-IN",
  ])("reads what it writes in %s", (locale) => {
    const format = getDurationFormat(locale);
    for (const minutes of [0, 1, 5, 45, 60, 90, 125, 1500]) {
      for (const text of [
        format.format(minutes, "clock"),
        format.format(minutes, "units"),
        format.formatLong(minutes),
      ]) {
        expect(format.parse(text, "minutes")).toEqual({ minutes });
      }
    }
  });
});

describe("getDurationFormat - parse", () => {
  it.each([
    // Clock
    ["1:30", 90],
    [":45", 45],
    ["0:05", 5],
    ["1:5", 65],
    ["125:00", 7500],
    ["1 : 30", 90],
    ["1:30:30", 91],
    ["1:30:29", 90],
    // A number with a fraction is hours, a whole one minutes
    ["1,5", 90],
    ["1.5", 90],
    [",5", 30],
    ["0.25", 15],
    ["90", 90],
    ["0", 0],
    // Units
    ["1.5h", 90],
    ["1,5 h", 90],
    ["90m", 90],
    ["90 min", 90],
    ["1h 30m", 90],
    ["1h30m", 90],
    ["1h30", 90],
    ["1 h 30", 90],
    ["1 h 30 min", 90],
    ["1 hr 30 min", 90],
    ["2 hrs", 120],
    ["1 hour 30 minutes", 90],
    ["1 hour, 30 minutes", 90],
    ["1h,30m", 90],
    ["2 hours and 15 minutes", 135],
    ["1 Hour", 60],
    ["1 MIN", 1],
    ["45 mins", 45],
    ["1 minute", 1],
    // Seconds round to whole minutes
    ["90s", 2],
    ["89 sec", 1],
    ["1 min 30 s", 2],
    ["1 h 29 s", 60],
    ["120 seconds", 2],
    // Rounding of fractions
    ["1.33 h", 80],
    ["0.5 min", 1],
    // Spaces around
    ["  1:30  ", 90],
    ["1 h 30 min", 90],
    // A plus sign says nothing
    ["+1:30", 90],
    // ISO 8601
    ["PT1H30M", 90],
    ["pt1h30m", 90],
    ["PT90M", 90],
    ["P1DT2H", 1560],
    ["P1W", 10_080],
    ["PT1.5H", 90],
    ["PT0,5H", 30],
    ["PT45S", 1],
    ["PT0S", 0],
    // Full-width digits of East Asian input
    ["１：３０", 90],
  ])("reads %j as %i minutes", (text, minutes) => {
    expect(minutesOf(text)).toEqual({ minutes });
  });

  it.each([
    ["1 hodina", 60],
    ["1 hodinu", 60],
    ["2 hodiny", 120],
    ["5 hodin", 300],
    ["1,5 hodiny", 90],
    ["1 hod 30 min", 90],
    ["1 hod. 30 min.", 90],
    ["1 hodina 30 minut", 90],
    ["1 hodina a 30 minut", 90],
    ["2 hodiny a 5 minut", 125],
    ["1 minuta", 1],
    ["1 minutu", 1],
    ["2 minuty", 2],
    ["30 minut", 30],
    // Without diacritics, and in any case
    ["30 MINUT", 30],
    ["1 Hodina", 60],
    ["30 sekund", 1],
    ["20 sekundy", 0],
    ["1 sekundu", 0],
    // Words of the locale with diacritics, folded
    ["2 hodín", 120],
  ])("reads the Czech %j as %i minutes", (text, minutes) => {
    // In both locales - Czech words are read in English too
    expect(cs.parse(text, "minutes")).toEqual({ minutes });
    expect(en.parse(text, "minutes")).toEqual({ minutes });
  });

  it("reads a whole number in the default unit", () => {
    expect(minutesOf("8", "hours")).toEqual({ minutes: 480 });
    expect(minutesOf("8", "minutes")).toEqual({ minutes: 8 });
    // With a fraction or a unit it is what it says
    expect(minutesOf("1,5", "minutes")).toEqual({ minutes: 90 });
    expect(minutesOf("30 min", "hours")).toEqual({ minutes: 30 });
    expect(minutesOf("1:30", "hours")).toEqual({ minutes: 90 });
  });

  it("gives no value for an empty text", () => {
    expect(minutesOf("")).toEqual({ minutes: null });
    expect(minutesOf("   ")).toEqual({ minutes: null });
  });

  it.each([
    "abc",
    "1 day",
    "h",
    "1:",
    ":",
    "1:60",
    "1:30:60",
    "1:300",
    "1.",
    "1..5",
    "1,5,5",
    "1 2",
    "1 h,",
    "30 min 1 h",
    "1 h 2 h",
    "30m 15 5",
    "1h a",
    "a 30 min",
    ", 30 min",
    "1 h 30 x",
    "P",
    "PT",
    "P1Y",
    "P1M",
    "PT1H30",
    "--1:30",
    "1:30 h",
    "1e3",
    "9".repeat(400),
  ])("refuses %j", (text) => {
    expect(minutesOf(text)).toEqual({ error: "invalid" });
  });

  it("tells a negative duration apart", () => {
    expect(minutesOf("-1:30")).toEqual({ error: "negative" });
    expect(minutesOf("−1:30")).toEqual({ error: "negative" });
    expect(minutesOf("-30 min")).toEqual({ error: "negative" });
    expect(minutesOf("-PT1H")).toEqual({ error: "negative" });
    // A negative zero is none
    expect(minutesOf("-0:00")).toEqual({ minutes: 0 });
    expect(minutesOf("-abc")).toEqual({ error: "invalid" });
  });
});

describe("parseIsoDuration", () => {
  it("reads the parts with their fractions, not rounded", () => {
    expect(parseIsoDuration("PT1H30M")).toBe(90);
    expect(parseIsoDuration("PT1H30M15S")).toBe(90.25);
    expect(parseIsoDuration("P2D")).toBe(2880);
    expect(parseIsoDuration("P1WT1M")).toBe(10_081);
    expect(parseIsoDuration("-PT30M")).toBe(-30);
    expect(parseIsoDuration(" pt5m ")).toBe(5);
  });

  it.each(["", "P", "PT", "P1Y2M", "1:30", "PT1H 30M", "T1H"])(
    "reads no duration in %j",
    (text) => {
      expect(parseIsoDuration(text)).toBeNull();
    },
  );
});

describe("toIsoDuration", () => {
  it.each([
    [0, "PT0S"],
    [45, "PT45M"],
    [60, "PT1H"],
    [90, "PT1H30M"],
    [1500, "PT25H"],
    [-90, "-PT1H30M"],
    [90.4, "PT1H30M"],
  ])("writes %i minutes as %s", (minutes, text) => {
    expect(toIsoDuration(minutes)).toBe(text);
    expect(parseIsoDuration(text)).toBe(Math.round(minutes));
  });
});
