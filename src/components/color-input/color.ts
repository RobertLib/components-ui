// Colors of ColorInput - read from the text of a CSS color (hex, rgb(),
// hsl()), written in one of these formats, and converted to the hue,
// saturation and brightness of the picker.

/** A text format of a color. */
export type ColorFormat = "hex" | "rgb" | "hsl";

/** A color in sRGB - the channels 0 to 255, the alpha 0 to 1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * A color as the picker holds it - the hue in degrees (0 to 360), the
 * saturation and the brightness (value) in percent, the alpha 0 to 1. It
 * keeps the hue of a gray, which RGB loses.
 */
export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const HEX = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const FUNCTION = /^(rgba?|hsla?)\((.*)\)$/i;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** A number of CSS - `50`, `.5`, `1e2`; `null` for anything else. */
function readNumber(text: string) {
  return NUMBER.test(text) ? Number(text) : null;
}

/** A number or a percentage, as a fraction of `full` - `50%` of 255. */
function readChannel(text: string, full: number) {
  if (text.endsWith("%")) {
    const percent = readNumber(text.slice(0, -1));
    return percent === null ? null : (percent / 100) * full;
  }
  return readNumber(text);
}

/** An alpha - `0.5` or `50%`, 1 when left out. */
function readAlpha(text: string | undefined) {
  if (text === undefined) return 1;
  const alpha = readChannel(text, 1);
  return alpha === null ? null : clamp(alpha, 0, 1);
}

/** A hue in degrees - `210`, `210deg`, `0.5turn`, `3.14rad`, `200grad`. */
function readHue(text: string) {
  const units: Record<string, number> = {
    deg: 1,
    grad: 0.9,
    rad: 180 / Math.PI,
    turn: 360,
  };
  const match = /^(.*?)(deg|grad|rad|turn)?$/i.exec(text);
  const hue = match ? readNumber(match[1]) : null;
  if (hue === null) return null;
  const degrees = hue * units[(match?.[2] ?? "deg").toLowerCase()];
  return ((degrees % 360) + 360) % 360;
}

/**
 * The arguments of `rgb()` or `hsl()` - separated by commas
 * (`rgb(1, 2, 3, 0.5)`) or by spaces with the alpha after a slash
 * (`rgb(1 2 3 / 50%)`).
 */
function readArguments(text: string) {
  const trimmed = text.trim();
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((part) => part.trim());
    return parts.length === 3 || parts.length === 4 ? parts : null;
  }

  const [channels, alpha, ...rest] = trimmed.split("/");
  if (rest.length > 0) return null;
  const parts = channels.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  if (alpha === undefined) return parts;
  const alphaText = alpha.trim();
  return alphaText && !/\s/.test(alphaText) ? [...parts, alphaText] : null;
}

/**
 * The color a CSS text stands for - `#1e90ff`, `1e90ff`, `#fff`, `#1e90ff80`,
 * `rgb(30, 144, 255)`, `rgba(30 144 255 / 50%)`, `hsl(210, 100%, 56%)`,
 * `hsl(210deg 100% 56% / 0.5)`; `null` for a text that is none of them.
 * Channels past their range are clamped, as in CSS.
 */
export function parseColor(text: string): Rgba | null {
  const trimmed = text.trim();

  const hex = HEX.exec(trimmed)?.[1];
  if (hex) {
    const digits =
      hex.length <= 4
        ? Array.from(hex, (digit) => digit + digit).join("")
        : hex;
    const channel = (index: number) =>
      Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return {
      a: digits.length === 8 ? round(channel(3) / 255, 3) : 1,
      b: channel(2),
      g: channel(1),
      r: channel(0),
    };
  }

  const match = FUNCTION.exec(trimmed);
  const parts = match ? readArguments(match[2]) : null;
  if (!match || !parts) return null;
  const alpha = readAlpha(parts[3]);
  if (alpha === null) return null;

  if (match[1].toLowerCase().startsWith("rgb")) {
    const [r, g, b] = parts.slice(0, 3).map((part) => readChannel(part, 255));
    if (r === null || g === null || b === null) return null;
    return {
      a: alpha,
      b: clamp(b, 0, 255),
      g: clamp(g, 0, 255),
      r: clamp(r, 0, 255),
    };
  }

  const hue = readHue(parts[0]);
  const [saturation, lightness] = parts
    .slice(1, 3)
    .map((part) => readChannel(part.endsWith("%") ? part : `${part}%`, 100));
  if (hue === null || saturation === null || lightness === null) return null;
  return {
    ...hslToRgb(hue, clamp(saturation, 0, 100), clamp(lightness, 0, 100)),
    a: alpha,
  };
}

/** RGB of a hue, saturation and lightness - the channels unrounded. */
function hslToRgb(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (lightness - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return { b: channel(4), g: channel(8), r: channel(0) };
}

/** The hue, saturation and lightness of an RGB color. */
function rgbToHsl({ r, g, b }: Rgba) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return {
    h: hueOf(red, green, blue, max, delta),
    l: lightness * 100,
    s: saturation * 100,
  };
}

/** The hue of the channels (0 to 1) - 0 for a gray. */
function hueOf(
  red: number,
  green: number,
  blue: number,
  max: number,
  delta: number,
) {
  if (delta === 0) return 0;
  const hue =
    max === red
      ? ((green - blue) / delta) % 6
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return (hue * 60 + 360) % 360;
}

/** The picker's hue, saturation and brightness of an RGB color. */
export function rgbToHsv(color: Rgba): Hsva {
  const red = color.r / 255;
  const green = color.g / 255;
  const blue = color.b / 255;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  return {
    a: color.a,
    h: hueOf(red, green, blue, max, delta),
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

/** The RGB color of the picker's hue, saturation and brightness. */
export function hsvToRgb({ a, h, s, v }: Hsva): Rgba {
  const saturation = s / 100;
  const value = v / 100;
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return (
      255 * (value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1)))
    );
  };
  return { a, b: channel(1), g: channel(3), r: channel(5) };
}

const toHex = (channel: number) =>
  Math.round(clamp(channel, 0, 255))
    .toString(16)
    .padStart(2, "0");

/**
 * The text of a color in `format` - `#1e90ff`, `rgb(30, 144, 255)`,
 * `hsl(210, 100%, 56%)`. With `withAlpha`, a translucent color keeps its
 * alpha: `#1e90ff80`, `rgba(30, 144, 255, 0.5)`, `hsla(210, 100%, 56%,
 * 0.5)`; an opaque one is written without it - also one whose alpha
 * rounds to opaque (0.999), so that the text reads back as it is written.
 */
export function formatColor(
  color: Rgba,
  format: ColorFormat,
  withAlpha: boolean,
) {
  const alpha = withAlpha ? clamp(color.a, 0, 1) : 1;

  if (format === "hex") {
    const hex = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    const alphaHex = toHex(alpha * 255);
    return alphaHex === "ff" ? hex : `${hex}${alphaHex}`;
  }

  // Translucent as written - the 0.996 of `#000000fe` is 1 with two decimals
  const roundedAlpha = round(alpha, 2);
  const translucent = roundedAlpha < 1;
  const alphaText = String(roundedAlpha);

  if (format === "rgb") {
    const channels = [color.r, color.g, color.b]
      .map((channel) => Math.round(clamp(channel, 0, 255)))
      .join(", ");
    return translucent ? `rgba(${channels}, ${alphaText})` : `rgb(${channels})`;
  }

  const { h, l, s } = rgbToHsl(color);
  const channels = `${Math.round(h) % 360}, ${Math.round(s)}%, ${Math.round(l)}%`;
  return translucent ? `hsla(${channels}, ${alphaText})` : `hsl(${channels})`;
}

/**
 * A color the browser can paint, for the swatches - with its alpha, also
 * where the field leaves it out.
 */
export function toCssColor(color: Rgba) {
  const channels = [color.r, color.g, color.b]
    .map((channel) => Math.round(clamp(channel, 0, 255)))
    .join(" ");
  return `rgb(${channels} / ${round(clamp(color.a, 0, 1), 3)})`;
}

/**
 * `text` written as a value of the field - in `format`, without an alpha
 * unless `withAlpha`; `null` when it is no color, `""` for no text.
 */
export function normalizeColor(
  text: string,
  format: ColorFormat,
  withAlpha: boolean,
) {
  if (!text.trim()) return "";
  const color = parseColor(text);
  return color ? formatColor(color, format, withAlpha) : null;
}
