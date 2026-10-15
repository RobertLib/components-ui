import { describe, expect, it } from "vitest";
import {
  compareDecimals,
  decimalPlaces,
  isDecimal,
  normalizeDecimal,
  shiftDecimal,
  stepDecimal,
} from "./decimal";
import { getNumberFormat, getStepNumberFormat } from "./number-format";

describe("decimal texts", () => {
  it("writes a decimal in its shortest form", () => {
    expect(normalizeDecimal("+01234.500")).toBe("1234.5");
    expect(normalizeDecimal("-0.0")).toBe("0");
    expect(normalizeDecimal(" 1E2 ")).toBe("100");
    expect(normalizeDecimal("1.5e-3")).toBe("0.0015");
    expect(normalizeDecimal(".5")).toBe("0.5");
    expect(normalizeDecimal("5.")).toBe("5");
    expect(normalizeDecimal("-12345678901234567890.123456789")).toBe(
      "-12345678901234567890.123456789",
    );

    for (const text of [
      "",
      "-",
      ".",
      "abc",
      "1,5",
      "1.2.3",
      "0x10",
      "1e2000",
    ]) {
      expect(normalizeDecimal(text)).toBeNull();
    }
    expect(isDecimal("-0.1")).toBe(true);
    expect(isDecimal("Infinity")).toBe(false);
  });

  it("shifts the decimal point exactly, keeping the zeros", () => {
    expect(shiftDecimal("25.50", -2)).toBe("0.2550");
    expect(shiftDecimal("0.2550", 2)).toBe("25.50");
    expect(shiftDecimal("0.1", 3)).toBe("100");
    expect(shiftDecimal("1.235E4", 0)).toBe("12350");
    expect(shiftDecimal("-1.235E-4", 0)).toBe("-0.0001235");
    // No minus sign for zero
    expect(shiftDecimal("-0.00", 0)).toBe("0.00");
  });

  it("compares numbers a double cannot tell apart", () => {
    expect(compareDecimals("0.30", "0.3")).toBe(0);
    expect(compareDecimals("9007199254740993", "9007199254740992")).toBe(1);
    expect(compareDecimals("-1", "0")).toBe(-1);
    expect(compareDecimals("-0.000000000000000000001", "0")).toBe(-1);
    expect(decimalPlaces("0.0001")).toBe(4);
    expect(decimalPlaces("12")).toBe(0);
    expect(decimalPlaces("1.5E-3")).toBe(4);
  });
});

describe("stepDecimal", () => {
  it("steps exactly - no 0.30000000000000004", () => {
    expect(stepDecimal("0.2", 1, 1, { step: "0.1" })).toBe("0.3");
    expect(stepDecimal("0.3", -1, 1, { step: "0.1" })).toBe("0.2");
    expect(stepDecimal("9007199254740993", 1, 1, { step: "1" })).toBe(
      "9007199254740994",
    );
    expect(
      stepDecimal("12345678901234567890.25", 1, 10, { step: "0.25" }),
    ).toBe("12345678901234567892.75");
  });

  it("steps on the grid of the step from min, like a native input", () => {
    // Between two steps - to the next one
    expect(stepDecimal("1.23", 1, 1, { step: "0.1" })).toBe("1.3");
    expect(stepDecimal("1.23", -1, 1, { step: "0.1" })).toBe("1.2");
    expect(stepDecimal("-1.25", 1, 1, { step: "0.5" })).toBe("-1");
    expect(stepDecimal("-1.25", -1, 1, { step: "0.5" })).toBe("-1.5");
    expect(stepDecimal("0.05", 1, 1, { min: "0.05", step: "0.1" })).toBe(
      "0.15",
    );
    expect(stepDecimal("0.2", 1, 1, { min: "0.05", step: "0.1" })).toBe("0.25");
  });

  it("stays within min and max, and never steps backwards", () => {
    expect(stepDecimal("9", 1, 1, { max: "10", step: "3" })).toBe("9");
    expect(stepDecimal("8", 1, 1, { max: "10", step: "3" })).toBe("9");
    // A value past `max` stays
    expect(stepDecimal("11", 1, 1, { max: "10", step: "3" })).toBe("11");
    expect(stepDecimal("1", -1, 5, { min: "0", step: "1" })).toBe("0");
  });

  it("starts an empty field at min going up and at max going down", () => {
    expect(stepDecimal(null, 1, 1, { min: "5", step: "1" })).toBe("5");
    expect(stepDecimal(null, -1, 1, { max: "7.5", step: "1" })).toBe("7.5");
    expect(stepDecimal(null, 1, 1, { step: "1" })).toBe("0");
  });
});

describe("decimal formats", () => {
  const czk = getNumberFormat("cs-CZ", { currency: "CZK", style: "currency" });

  it("writes, reads and rounds amounts exactly", () => {
    expect(czk.decimal.format("1234.5")).toBe("1 234,50 Kč");
    expect(czk.decimal.format("12345678901234567890.12")).toBe(
      "12 345 678 901 234 567 890,12 Kč",
    );
    expect(czk.decimal.parse("1 234,5 Kč")).toBe("1234.50");
    expect(czk.decimal.parse("-0,1")).toBe("-0.10");
    expect(czk.decimal.parse("")).toBeNull();
    // Half away from zero - also where the double of 1.005 is 1.00499…
    expect(czk.decimal.round("1.005")).toBe("1.01");
    expect(czk.decimal.round("-0.004")).toBe("0.00");
    expect(czk.decimal.toEditText("1234.5")).toBe("1234,50");
    expect(czk.decimal.toEditText("-7")).toBe("-7,00");
  });

  it("keeps every digit of a number in the range of a double", () => {
    const plain = getNumberFormat("en-US");
    expect(plain.decimal.parse("123456789012345678901234567890.1234")).toBe(
      "123456789012345678901234567890.123",
    );
    expect(plain.decimal.format("123456789012345678901234567890")).toBe(
      "123,456,789,012,345,678,901,234,567,890",
    );
    // Beyond it `Intl` writes infinity - such a text is no number either
    expect(plain.isPartial("9".repeat(400), true)).toBe(false);
  });

  it("reads a percentage as its fraction", () => {
    const percent = getNumberFormat("cs-CZ", {
      maximumFractionDigits: 1,
      style: "percent",
    });
    expect(percent.decimal.parse("25,5")).toBe("0.255");
    expect(percent.decimal.parse("25,55 %")).toBe("0.256");
    expect(percent.decimal.format("0.255")).toBe("25,5 %");
    expect(percent.decimal.toEditText("0.255")).toBe("25,5");
    expect(percent.decimal.round("0.12345")).toBe("0.123");
  });

  it("writes out a number of a scientific notation", () => {
    const scientific = getNumberFormat("en-US", { notation: "scientific" });
    expect(scientific.decimal.round("12345")).toBe("12350");
    expect(scientific.decimal.format("12345")).toBe("1.235E4");
    expect(scientific.decimal.toEditText("0.000123456")).toBe("0.0001235");
  });

  it("keeps the fraction digits of a fine step given as a text", () => {
    const format = getStepNumberFormat("en-US", undefined, "0.00001");
    expect(format.decimal.round("1.123456")).toBe("1.12346");
  });

  it("writes the edited number with the marks of a right-to-left language", () => {
    const arabic = getNumberFormat("ar-EG");
    const edited = arabic.decimal.toEditText("-1234.5");
    expect(edited).toMatch(/1234\.5$/);
    expect(arabic.decimal.parse(edited)).toBe("-1234.5");
  });
});
