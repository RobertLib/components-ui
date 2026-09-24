import { describe, expect, it, vi } from "vitest";
import { getNumberFormat, stepValue, toCanonical } from "./number-format";

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
    // A repeated separator groups
    expect(cs.parse("1.234.567")).toBe(1234567);
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

  it("keeps all the digits a number has", () => {
    const precise = getNumberFormat("en-US", { maximumFractionDigits: 9 });
    expect(en.parse("1234567890123456")).toBe(1234567890123456);
    expect(en.round(1234567890123456)).toBe(1234567890123456);
    expect(en.toEditText(1234567890123456)).toBe("1234567890123456");
    expect(precise.parse("1234567.123456789")).toBe(1234567.123456789);
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

  it("falls back to the plain format for options Intl refuses", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const format = getNumberFormat("cs-CZ", { style: "currency" });

    expect(format.format(1.5)).toBe("1,5");
    expect(warn).toHaveBeenCalled();
  });
});

describe("toCanonical", () => {
  it("writes the value as a form submits it", () => {
    expect(toCanonical(1234.5)).toBe("1234.5");
    expect(toCanonical(-0.5)).toBe("-0.5");
    expect(toCanonical(1e-7)).toBe("0.0000001");
    expect(toCanonical(1e21)).toBe("1000000000000000000000");
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
    expect(stepValue(150, 1, 1, { max: 100, step: 1 })).toBe(100);
  });

  it("starts an empty field at a bound or 0", () => {
    expect(stepValue(null, 1, 1, { step: 1 })).toBe(0);
    expect(stepValue(null, 1, 1, { min: 5, step: 1 })).toBe(5);
    expect(stepValue(null, -1, 1, { max: 20, step: 1 })).toBe(20);
    expect(stepValue(null, 1, 1, { max: -5, step: 1 })).toBe(-5);
  });
});
