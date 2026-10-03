import { describe, expect, it, vi } from "vitest";
import {
  getNumberFormat,
  getStepNumberFormat,
  stepValue,
  toCanonical,
} from "./number-format";

const cs = getNumberFormat("cs-CZ");
const en = getNumberFormat("en-US");

describe("getNumberFormat", () => {
  it("formats as the locale writes numbers", () => {
    expect(cs.format(1234.5)).toBe("1\u00a0234,5");
    expect(en.format(1234.5)).toBe("1,234.5");
    expect(cs.toEditText(1234.5)).toBe("1234,5");
    expect(en.toEditText(-1234.5)).toBe("-1234.5");
  });

  it("reads the decimal separator of the locale and groups", () => {
    expect(cs.parse("1234,5")).toBe(1234.5);
    expect(cs.parse("1 234,5")).toBe(1234.5);
    expect(cs.parse("1\u00a0234,5")).toBe(1234.5);
    expect(en.parse("1,234.5")).toBe(1234.5);
    expect(en.parse("-1234.5")).toBe(-1234.5);
    expect(getNumberFormat("de-CH").parse("12'345.6")).toBe(12345.6);
  });

  it("is lenient where the text is unambiguous", () => {
    // Czech groups with spaces - a dot can only separate the fraction
    expect(cs.parse("1.5")).toBe(1.5);
    // A comma not followed by three digits groups nothing
    expect(en.parse("1,5")).toBe(1.5);
    expect(en.parse("1,234")).toBe(1234);
    // Both separators - the last one is the decimal separator
    expect(cs.parse("1,234.5")).toBe(1234.5);
    expect(en.parse("1.234,5")).toBe(1234.5);
    // A repeated separator groups - the decimal one of the locale in groups
    // of three, else it is refused as a second decimal separator
    expect(cs.parse("1.234.567")).toBe(1234567);
    expect(cs.parse("1,234,567")).toBe(1234567);
    expect(en.parse("1.234.567")).toBe(1234567);
    expect(en.parse("1.2.3")).toBeNull();
    expect(cs.isPartial("1,555,", true)).toBe(false);
    // Other minus signs, a plus sign, full-width digits
    expect(cs.parse("\u22125")).toBe(-5);
    expect(cs.parse("+5")).toBe(5);
    expect(cs.parse("\uff11\uff12\uff0c\uff15")).toBe(12.5);
  });

  it("gives null for no number", () => {
    expect(cs.parse("")).toBeNull();
    expect(cs.parse("-")).toBeNull();
    expect(cs.parse(",")).toBeNull();
    expect(cs.parse("abc")).toBeNull();
    expect(cs.parse("1,2,3")).toBeNull();
    expect(cs.parse("1-2")).toBeNull();
  });

  it("accepts the start of a number while typing", () => {
    for (const text of ["", "-", "1,", ",5", "-1 2", "12,34"]) {
      expect(cs.isPartial(text, true)).toBe(true);
    }
    expect(cs.isPartial("1a", true)).toBe(false);
    expect(cs.isPartial("1,2,", true)).toBe(false);
    // A minus sign only where negative numbers are allowed
    expect(cs.isPartial("-1", false)).toBe(false);
  });

  it("allows no decimal separator without fraction digits", () => {
    const whole = getNumberFormat("cs-CZ", { maximumFractionDigits: 0 });
    expect(whole.isPartial("12,", true)).toBe(false);
    expect(whole.isPartial("12.", true)).toBe(false);
    expect(whole.isPartial("12 000", true)).toBe(true);

    // In English the comma groups
    const wholeEn = getNumberFormat("en-US", { maximumFractionDigits: 0 });
    expect(wholeEn.isPartial("1,", true)).toBe(true);
    expect(wholeEn.parse("1,5")).toBe(15);
    expect(wholeEn.isPartial("1.", true)).toBe(false);
  });

  it("rounds to the fraction digits of the format", () => {
    const money = getNumberFormat("cs-CZ", {
      currency: "CZK",
      style: "currency",
    });
    expect(money.format(1234.5)).toBe("1\u00a0234,50\u00a0Kč");
    expect(money.toEditText(1234.5)).toBe("1234,50");
    expect(money.parse("1234,567")).toBe(1234.57);
    expect(money.round(0.1 + 0.2)).toBe(0.3);
    // The currency may be typed, or pasted with the formatted value
    expect(money.parse("1 234,50 Kč")).toBe(1234.5);
    expect(money.round(-0.001)).toBe(0);
    expect(Object.is(money.round(-0.001), -0)).toBe(false);
  });

  it.each(["en-US", "cs-CZ", "pl-PL", "cy-GB", "fr-FR"])(
    "reads every grammatical form of a formatted unit or currency in %s",
    (locale) => {
      const options: Intl.NumberFormatOptions[] = [
        { style: "unit", unit: "meter", unitDisplay: "long" },
        { style: "currency", currency: "USD", currencyDisplay: "name" },
      ];
      for (const formatOptions of options) {
        const format = getNumberFormat(locale, formatOptions);
        for (const value of [0, 1, 2, 3, 4, 5, 6, 11, 21, 1.5, 1e6, -1, -2]) {
          const text = format.format(value);
          expect(format.isPartial(text, true), text).toBe(true);
          expect(format.parse(text), text).toBe(value);
        }
      }
    },
  );

  it.each([
    { roundingMode: "trunc", value: 1.239, expected: 1.23 },
    { roundingMode: "ceil", value: -1.239, expected: -1.23 },
    { roundingMode: "floor", value: -1.231, expected: -1.24 },
    { roundingMode: "halfEven", value: 1.225, expected: 1.22 },
    { roundingMode: "halfEven", value: 1.235, expected: 1.24 },
  ] as const)(
    "uses $roundingMode to read and edit $value as $expected",
    ({ roundingMode, value, expected }) => {
      const format = getNumberFormat("en-US", {
        maximumFractionDigits: 2,
        roundingMode,
      });
      expect(format.parse(String(value))).toBe(expected);
      expect(format.round(value)).toBe(expected);
      expect(format.toEditText(value)).toBe(String(expected));
      expect(format.format(value)).toBe(String(expected));
    },
  );

  it("uses the currency's rounding increment when reading and editing", () => {
    const format = getNumberFormat("en-US", {
      currency: "CHF",
      roundingIncrement: 5,
      roundingMode: "trunc",
      style: "currency",
    });
    expect(format.parse("1.29")).toBe(1.25);
    expect(format.round(1.29)).toBe(1.25);
    expect(format.toEditText(1.29)).toBe("1.25");
    expect(format.toEditText(1)).toBe("1.00");
  });

  it("rounds the percent number before converting it to a fraction", () => {
    const format = getNumberFormat("cs-CZ", {
      maximumFractionDigits: 1,
      roundingMode: "floor",
      style: "percent",
    });
    expect(format.parse("12,39 %")).toBe(0.123);
    expect(format.round(0.1239)).toBe(0.123);
    expect(format.toEditText(0.1239)).toBe("12,3");
    expect(format.format(0.1239)).toBe("12,3\u00a0%");
  });

  it("uses significant digits consistently when reading and editing", () => {
    const format = getNumberFormat("en-US", {
      maximumSignificantDigits: 3,
      roundingMode: "trunc",
    });
    expect(format.parse("1239")).toBe(1230);
    expect(format.round(1239)).toBe(1230);
    expect(format.toEditText(1239)).toBe("1230");
    expect(format.format(1239)).toBe("1,230");
  });

  it.each<Intl.NumberFormatOptions>([
    { notation: "compact" },
    {
      maximumFractionDigits: 0,
      maximumSignificantDigits: 3,
      roundingPriority: "morePrecision",
    },
  ])("accepts fractions kept by significant digits with %j", (options) => {
    for (const locale of ["en-US", "cs-CZ"]) {
      const format = getNumberFormat(locale, options);
      const text = format.toEditText(1.5);
      expect(format.isPartial(text, true)).toBe(true);
      expect(format.parse(text)).toBe(1.5);
      expect(format.round(1.5)).toBe(1.5);
    }
  });

  it("still refuses fractions when lessPrecision requires whole numbers", () => {
    const format = getNumberFormat("en-US", {
      maximumFractionDigits: 0,
      maximumSignificantDigits: 3,
      roundingPriority: "lessPrecision",
    });
    expect(format.isPartial("1.5", true)).toBe(false);
    expect(format.round(1.5)).toBe(2);
  });

  it("keeps a finer step with compact notation's default precision", () => {
    const format = getStepNumberFormat("en-US", { notation: "compact" }, 0.01);
    expect(format.round(10.01)).toBe(10.01);
    expect(format.toEditText(10.01)).toBe("10.01");
  });

  it("keeps all the digits a number has", () => {
    const precise = getNumberFormat("en-US", { maximumFractionDigits: 9 });
    expect(en.parse("1234567890123456")).toBe(1234567890123456);
    expect(en.round(1234567890123456)).toBe(1234567890123456);
    expect(en.toEditText(1234567890123456)).toBe("1234567890123456");
    expect(precise.parse("1234567.123456789")).toBe(1234567.123456789);
  });

  it.each([
    { notation: "scientific", value: 0.000123456, rounded: 0.0001235 },
    { notation: "scientific", value: 123456.789, rounded: 123500 },
    { notation: "engineering", value: 0.0001234567, rounded: 0.000123457 },
    { notation: "engineering", value: 123456.789, rounded: 123457 },
  ] as const)(
    "rounds $notation $value by its mantissa when reading and editing",
    ({ notation, value, rounded }) => {
      const format = getNumberFormat("cs-CZ", { notation });
      const text = String(rounded).replace(".", ",");
      expect(format.round(value)).toBe(rounded);
      expect(format.parse(String(value))).toBe(rounded);
      expect(format.toEditText(value)).toBe(text);
      expect(format.parse(text)).toBe(rounded);
      expect(format.format(rounded)).toBe(format.format(value));
    },
  );

  it.each(["scientific", "engineering"] as const)(
    "allows fractions with a whole %s mantissa and honors its rounding mode",
    (notation) => {
      const format = getNumberFormat("en-US", {
        notation,
        maximumFractionDigits: 0,
        roundingMode: "trunc",
      });
      const expected = notation === "scientific" ? 0.0001 : 0.000123;
      expect(format.isPartial("0.0001239", true)).toBe(true);
      expect(format.parse("0.0001239")).toBe(expected);
      expect(format.toEditText(0.0001239)).toBe(String(expected));
    },
  );

  it("edits an exponential percentage as its rounded percent number", () => {
    const format = getNumberFormat("en-US", {
      notation: "scientific",
      style: "percent",
      maximumFractionDigits: 2,
    });
    expect(format.format(0.000001234)).toBe("1.23E-4%");
    expect(format.toEditText(0.000001234)).toBe("0.000123");
    expect(format.parse("0.0001234")).toBe(0.00000123);
  });

  it("types percentages as the percent number", () => {
    const percent = getNumberFormat("cs-CZ", {
      maximumFractionDigits: 1,
      style: "percent",
    });
    expect(percent.format(0.255)).toBe("25,5\u00a0%");
    expect(percent.toEditText(0.255)).toBe("25,5");
    expect(percent.parse("25,5")).toBe(0.255);
    expect(percent.parse("7 %")).toBe(0.07);
    expect(percent.fractionDigits).toBe(1);
  });

  it("keeps the typed percent digits at a significant-digit rounding boundary", () => {
    const format = getNumberFormat("en-US", {
      maximumSignificantDigits: 1,
      style: "percent",
    });
    expect(format.parse("0.14999999999999996")).toBe(0.001);
    expect(format.parse("-0.14999999999999996")).toBe(-0.001);
  });

  it.each([1e307, -1e307, Number.MAX_VALUE, -Number.MAX_VALUE])(
    "keeps the finite percentage %s when its percent number overflows",
    (value) => {
      const format = getNumberFormat("en-US", { style: "percent" });
      const text = format.toEditText(value);
      expect(format.round(value)).toBe(value);
      expect(format.isPartial(text, true)).toBe(true);
      expect(format.parse(text)).toBe(value);
      expect(format.parse(format.format(value))).toBe(value);
    },
  );

  it.each(["standard", "scientific", "engineering"] as const)(
    "rounds and edits overflowing percentages with %s notation",
    (notation) => {
      const format = getNumberFormat("cs-CZ", {
        maximumSignificantDigits: 3,
        notation,
        roundingMode: "trunc",
        style: "percent",
      });
      for (const value of [1.23456789e307, -1.23456789e307]) {
        const expected = Math.sign(value) * 1.23e307;
        expect(format.round(value)).toBe(expected);
        expect(format.parse(format.toEditText(value))).toBe(expected);
      }
      expect(format.isPartial("9".repeat(312), true)).toBe(false);
      expect(format.parse("9".repeat(312))).toBeNull();
    },
  );

  it.each(["standard", "scientific", "engineering"] as const)(
    "keeps a finite percentage when %s rounding overflows its percent number",
    (notation) => {
      const format = getNumberFormat("en-US", {
        maximumSignificantDigits: 1,
        notation,
        style: "percent",
      });
      for (const value of [1.79e306, -1.79e306]) {
        const expected = Math.sign(value) * 2e306;
        expect(format.round(value)).toBe(expected);
        expect(format.parse(format.toEditText(value))).toBe(expected);
      }
    },
  );

  it("reads a 0 before a separator as no group - 0,234 is 0.234", () => {
    expect(en.parse("0,234")).toBe(0.234);
    expect(en.parse("-0,234")).toBe(-0.234);
    expect(getNumberFormat("de-DE").parse("0.234")).toBe(0.234);
    // After another digit it still groups
    expect(en.parse("10,234")).toBe(10234);
  });

  it("reads the parentheses of an accounting format as a minus sign", () => {
    const accounting = getNumberFormat("en-US", {
      currency: "USD",
      currencySign: "accounting",
      style: "currency",
    });
    expect(accounting.format(-1234.5)).toBe("($1,234.50)");
    expect(accounting.parse("($1,234.50)")).toBe(-1234.5);
    expect(accounting.parse("(12)")).toBe(-12);
    expect(accounting.parse("$12")).toBe(12);
    expect(accounting.isPartial("(12)", false)).toBe(false);
    expect(accounting.parse("(-12)")).toBeNull();
    // Without an accounting format parentheses are no number
    expect(en.parse("(12)")).toBeNull();
  });

  it("refuses a number too long for a double", () => {
    expect(en.parse("9".repeat(400))).toBeNull();
    expect(en.isPartial("9".repeat(400), true)).toBe(false);
    expect(en.parse("9".repeat(300))).toBe(1e300);
  });

  it.each(["en-US", "fa-IR"])(
    "keeps accounting signs around direction marks in %s",
    (locale) => {
      const accounting = getNumberFormat(locale, {
        currency: "USD",
        currencySign: "accounting",
        style: "currency",
      });
      for (const mark of ["", "\u061c", "\u200e", "\u200f"]) {
        const text = `${mark}${accounting.format(-1234.5)}${mark}`;
        expect(accounting.parse(text)).toBe(-1234.5);
        expect(accounting.isPartial(text, true)).toBe(true);
        expect(accounting.isPartial(text, false)).toBe(false);
      }
      expect(accounting.parse(accounting.format(1234.5))).toBe(1234.5);
      expect(accounting.parse("\u200e(-12)\u200f")).toBeNull();
    },
  );

  it("reads the digits of the locale's own numbering system", () => {
    const arabic = getNumberFormat("ar-EG");
    expect(arabic.format(1234.5)).toBe(
      "\u0661\u066c\u0662\u0663\u0664\u066b\u0665",
    );
    expect(arabic.parse(arabic.format(1234.5))).toBe(1234.5);
    expect(arabic.parse("\u0661\u0662\u066b\u0665")).toBe(12.5);
    // The edited text has Latin digits - those parse too
    expect(arabic.toEditText(1234.5)).toBe("1234.5");
    expect(arabic.parse("1234.5")).toBe(1234.5);

    const persian = getNumberFormat("fa");
    expect(persian.parse(persian.format(-1234.5))).toBe(-1234.5);

    // The edited text marks the direction of a negative number with another
    // mark (U+200E) than the display (U+061C)
    const edit = arabic.toEditText(-1234.5);
    expect(arabic.isPartial(edit, true)).toBe(true);
    expect(arabic.parse(edit)).toBe(-1234.5);
    expect(getNumberFormat("ar-SA").parse(edit)).toBe(-1234.5);
    expect(getNumberFormat("th-TH-u-nu-thai").parse("\u0e51\u0e52")).toBe(12);
  });

  it("falls back to the plain format for options Intl refuses", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const format = getNumberFormat("cs-CZ", { style: "currency" });

    expect(format.format(1.5)).toBe("1,5");
    expect(warn).toHaveBeenCalled();
  });
});

describe("getStepNumberFormat", () => {
  it("keeps the fraction digits of a step finer than the format's", () => {
    expect(
      getStepNumberFormat("en-US", undefined, 0.0001).parse("0.0001"),
    ).toBe(0.0001);
    expect(getStepNumberFormat("en-US", undefined, 0.5).fractionDigits).toBe(3);
    // Of the percent number for a percentage: 0.001 is 0.1 %
    expect(
      getStepNumberFormat("en-US", { style: "percent" }, 0.001).fractionDigits,
    ).toBe(1);
    expect(
      getStepNumberFormat(
        "en-US",
        { currency: "EUR", style: "currency" },
        0.001,
      ).format(1.005),
    ).toBe("€1.005");
    // Digits the options set stay
    expect(
      getStepNumberFormat("en-US", { maximumFractionDigits: 2 }, 0.0001)
        .fractionDigits,
    ).toBe(2);
  });
});

describe("toCanonical", () => {
  it("writes the value as a form submits it", () => {
    expect(toCanonical(1234.5)).toBe("1234.5");
    expect(toCanonical(-0.5)).toBe("-0.5");
    expect(toCanonical(1e-7)).toBe("0.0000001");
    expect(toCanonical(1e21)).toBe("1000000000000000000000");
  });

  it.each([
    1e-21,
    -1.2345678912345679e-25,
    Number.MIN_VALUE,
    Number.MAX_VALUE,
    1e18 + 128,
  ])("submits %s without rounding or exponent notation", (value) => {
    const text = toCanonical(value);
    expect(text).toMatch(/^-?\d+(?:\.\d+)?$/);
    expect(Number(text)).toBe(value);
  });
});

describe("stepValue", () => {
  it("steps on the grid of the step, counted from min", () => {
    expect(stepValue(3, 1, 1, { step: 1 })).toBe(4);
    expect(stepValue(3.7, 1, 1, { step: 1 })).toBe(4);
    expect(stepValue(3.7, -1, 1, { step: 1 })).toBe(3);
    expect(stepValue(2, 1, 1, { min: 1, step: 5 })).toBe(6);
    expect(stepValue(0.2, 1, 1, { step: 0.1 })).toBe(0.3);
    expect(stepValue(0.3, -1, 1, { step: 0.1 })).toBe(0.2);
    expect(stepValue(5, 1, 10, { step: 1 })).toBe(15);
  });

  it("stays within min and max", () => {
    expect(stepValue(9, 1, 1, { max: 10, step: 1 })).toBe(10);
    expect(stepValue(10, 1, 1, { max: 10, step: 1 })).toBe(10);
    expect(stepValue(1, -1, 10, { min: 0, step: 1 })).toBe(0);
    // The last step within max, as a native input does
    expect(stepValue(8, 1, 1, { max: 10, min: 0, step: 3 })).toBe(9);
    expect(stepValue(150, -1, 1, { max: 100, step: 1 })).toBe(100);
    expect(stepValue(-5, 1, 1, { min: 0, step: 1 })).toBe(0);
  });

  it("never lowers the value going up, or raises it going down", () => {
    // A max off the grid of the steps - the last step is below it
    expect(stepValue(10, 1, 1, { max: 10, min: 0, step: 3 })).toBe(10);
    expect(stepValue(9.5, 1, 1, { max: 10, min: 0, step: 3 })).toBe(9.5);
    expect(stepValue(10, 1, 1, { max: 10, min: 0.5, step: 1 })).toBe(10);
    // A value past a bound stays - as the stepUp() of a native input
    expect(stepValue(150, 1, 1, { max: 100, step: 1 })).toBe(150);
    expect(stepValue(-5, -1, 1, { min: 0, step: 1 })).toBe(-5);
  });

  it("steps large values with a small step", () => {
    const steps = [0.1, 0.01, 0.05, 0.001];
    for (const step of steps) {
      const decimals = String(step).split(".")[1].length;
      for (const magnitude of [1e5, 1e6, 1e7, 1e9, 1e11]) {
        for (let index = 0; index < 50; index++) {
          const value = Number((magnitude + index * step).toFixed(decimals));
          const up = Number((value + step).toFixed(decimals));
          const down = Number((value - step).toFixed(decimals));
          expect(stepValue(value, 1, 1, { step })).toBe(up);
          expect(stepValue(value, -1, 1, { step })).toBe(down);
        }
      }
    }
    // Off the grid it still moves to the next step
    expect(stepValue(1000000.191, 1, 1, { step: 0.01 })).toBe(1000000.2);
    expect(stepValue(1000000.191, -1, 1, { step: 0.01 })).toBe(1000000.19);
  });

  it("starts an empty field at a bound or 0", () => {
    expect(stepValue(null, 1, 1, { step: 1 })).toBe(0);
    expect(stepValue(null, 1, 1, { min: 5, step: 1 })).toBe(5);
    expect(stepValue(null, -1, 1, { max: 20, step: 1 })).toBe(20);
    expect(stepValue(null, 1, 1, { max: -5, step: 1 })).toBe(-5);
  });

  it("takes exactly one step throughout the safe integer range", () => {
    for (const magnitude of [1e15, 2e15, Number.MAX_SAFE_INTEGER - 10]) {
      for (const value of [magnitude, -magnitude]) {
        expect(stepValue(value, 1, 1, { step: 1 })).toBe(value + 1);
        expect(stepValue(value, -1, 1, { step: 1 })).toBe(value - 1);
        expect(stepValue(value, 1, 1, { min: value - 5, step: 1 })).toBe(
          value + 1,
        );
        expect(stepValue(value, -1, 1, { min: value - 5, step: 1 })).toBe(
          value - 1,
        );
      }
    }
    // A representable fraction is still between steps at these magnitudes.
    expect(stepValue(1e15 + 0.75, 1, 1, { step: 1 })).toBe(1e15 + 1);
    expect(stepValue(1e15 + 0.25, -1, 1, { step: 1 })).toBe(1e15);
    expect(stepValue(1e15, 1, 10, { max: 1e15 + 1.75, step: 1 })).toBe(
      1e15 + 1,
    );
    expect(stepValue(0.1 + 0.2, -1, 1, { step: 0.1 })).toBe(0.2);
  });
});
