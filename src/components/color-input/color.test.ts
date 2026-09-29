import { describe, expect, it } from "vitest";
import {
  formatColor,
  hsvToRgb,
  normalizeColor,
  parseColor,
  rgbToHsv,
  toCssColor,
} from "./color";

const dodgerBlue = { a: 1, b: 255, g: 144, r: 30 };

describe("parseColor", () => {
  it("reads hex colors of 3, 4, 6 and 8 digits, with or without #", () => {
    expect(parseColor("#1e90ff")).toEqual(dodgerBlue);
    expect(parseColor("1E90FF")).toEqual(dodgerBlue);
    expect(parseColor("#fff")).toEqual({ a: 1, b: 255, g: 255, r: 255 });
    expect(parseColor("#0f08")).toEqual({ a: 0.533, b: 0, g: 255, r: 0 });
    expect(parseColor(" #1e90ff80 ")).toEqual({ ...dodgerBlue, a: 0.502 });
  });

  it("reads rgb() and rgba() with commas or spaces, numbers or percents", () => {
    expect(parseColor("rgb(30, 144, 255)")).toEqual(dodgerBlue);
    expect(parseColor("rgba(30,144,255,0.5)")).toEqual({
      ...dodgerBlue,
      a: 0.5,
    });
    expect(parseColor("rgb(30 144 255 / 50%)")).toEqual({
      ...dodgerBlue,
      a: 0.5,
    });
    expect(parseColor("RGB(100%, 0%, 50%)")).toEqual({
      a: 1,
      b: 127.5,
      g: 0,
      r: 255,
    });
    // Clamped, as in CSS
    expect(parseColor("rgb(300, -5, 0)")).toEqual({ a: 1, b: 0, g: 0, r: 255 });
  });

  it("reads hsl() and hsla() with the units of the hue", () => {
    const red = { a: 1, b: 0, g: 0, r: 255 };
    expect(parseColor("hsl(0, 100%, 50%)")).toEqual(red);
    expect(parseColor("hsl(360deg 100% 50%)")).toEqual(red);
    expect(parseColor("hsl(0.5turn 100% 50%)")).toEqual({
      a: 1,
      b: 255,
      g: 255,
      r: 0,
    });
    expect(parseColor("hsla(120, 100%, 25%, .5)")).toEqual({
      a: 0.5,
      b: 0,
      g: 127.5,
      r: 0,
    });
    expect(parseColor("hsl(240 100 50)")).toEqual({
      a: 1,
      b: 255,
      g: 0,
      r: 0,
    });
  });

  it("refuses what is no color", () => {
    for (const text of [
      "",
      "blue",
      "#12",
      "#12345",
      "rgb(1, 2)",
      "rgb(1, 2, x)",
      "rgb(1 2 3 / )",
      "rgb(1 2 3 4)",
      "hsl(a, 50%, 50%)",
      "rgba(1, 2, 3, 4, 5)",
    ]) {
      expect(parseColor(text), text).toBeNull();
    }
  });
});

describe("formatColor", () => {
  it("writes a color in each format", () => {
    expect(formatColor(dodgerBlue, "hex", false)).toBe("#1e90ff");
    expect(formatColor(dodgerBlue, "rgb", false)).toBe("rgb(30, 144, 255)");
    expect(formatColor(dodgerBlue, "hsl", false)).toBe("hsl(210, 100%, 56%)");
  });

  it("keeps the alpha of a translucent color only when asked", () => {
    const translucent = { ...dodgerBlue, a: 0.5 };
    expect(formatColor(translucent, "hex", true)).toBe("#1e90ff80");
    expect(formatColor(translucent, "rgb", true)).toBe(
      "rgba(30, 144, 255, 0.5)",
    );
    expect(formatColor(translucent, "hsl", true)).toBe(
      "hsla(210, 100%, 56%, 0.5)",
    );
    expect(formatColor(translucent, "hex", false)).toBe("#1e90ff");
    // Opaque - written without the alpha
    expect(formatColor(dodgerBlue, "rgb", true)).toBe("rgb(30, 144, 255)");
  });

  it("writes a paintable color with its alpha", () => {
    expect(toCssColor({ ...dodgerBlue, a: 0.5 })).toBe("rgb(30 144 255 / 0.5)");
  });
});

describe("the picker's colors", () => {
  it("convert between RGB and hue, saturation and brightness", () => {
    const hsv = rgbToHsv(dodgerBlue);
    expect(hsv.h).toBeCloseTo(209.6, 1);
    expect(hsv.s).toBeCloseTo(88.2, 1);
    expect(hsv.v).toBe(100);
    expect(formatColor(hsvToRgb(hsv), "hex", false)).toBe("#1e90ff");

    expect(hsvToRgb({ a: 1, h: 0, s: 0, v: 100 })).toEqual({
      a: 1,
      b: 255,
      g: 255,
      r: 255,
    });
    expect(rgbToHsv({ a: 1, b: 0, g: 0, r: 0 })).toEqual({
      a: 1,
      h: 0,
      s: 0,
      v: 0,
    });
  });

  it("go round the hue for every sector", () => {
    for (const hex of [
      "#ff0000",
      "#ffff00",
      "#00ff00",
      "#00ffff",
      "#0000ff",
      "#ff00ff",
      "#808080",
    ]) {
      const color = parseColor(hex)!;
      expect(formatColor(hsvToRgb(rgbToHsv(color)), "hex", false)).toBe(hex);
    }
  });
});

describe("normalizeColor", () => {
  it("writes a typed color in the format of the field - empty stays empty", () => {
    expect(normalizeColor("rgb(30 144 255)", "hex", false)).toBe("#1e90ff");
    expect(normalizeColor("#1E90FF", "hsl", false)).toBe("hsl(210, 100%, 56%)");
    expect(normalizeColor("  ", "hex", false)).toBe("");
    expect(normalizeColor("nope", "hex", false)).toBeNull();
  });
});
