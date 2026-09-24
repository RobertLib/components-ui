import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The color tokens of the theme, as the stylesheet defines them - read as a
// file, the tests replace imported CSS with nothing
const stylesheet = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../styles.css"),
  "utf8",
);
const tokens = new Map<string, string>([
  ["black", "#000000"],
  ["white", "#ffffff"],
]);
for (const [, name, value] of stylesheet.matchAll(
  /--color-([a-z0-9-]+):\s*([^;]+);/g,
)) {
  tokens.set(name, value.trim());
}

const toLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** Linear sRGB of a color token - `oklch(…)` or `#rrggbb`, clipped to sRGB. */
function linearRgb(name: string): [number, number, number] {
  const value = tokens.get(name);
  if (!value) throw new Error(`No color token "${name}"`);

  if (value.startsWith("#")) {
    const hex = Number.parseInt(value.slice(1), 16);
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((channel) =>
      toLinear(channel / 255),
    ) as [number, number, number];
  }

  const match = /oklch\(([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\)/.exec(value);
  if (!match) throw new Error(`Cannot read the color "${value}"`);
  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.min(Math.max(channel, 0), 1)) as [
    number,
    number,
    number,
  ];
}

const luminance = (name: string) => {
  const [r, g, b] = linearRgb(name);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The WCAG contrast ratio of two color tokens - `primary-600`, `white`. */
export function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** The page backgrounds a component stands on, in the light or the dark. */
export const pageBackgrounds = (dark: boolean) =>
  dark ? ["surface-dark", "background-dark"] : ["surface", "background"];

export interface ColorState {
  dark?: boolean;
  hover?: boolean;
}

/**
 * The color token a utility of the classes (`text`, `bg`, `from`,
 * `focus:ring`, …) gives in a state - `hover:` and `dark:` classes win over
 * the plain ones, and `dark:` over `hover:`, as in the CSS Tailwind writes.
 */
export function colorOf(
  className: string,
  utility: string,
  { dark = false, hover = false }: ColorState = {},
) {
  const classes = className.split(/\s+/);
  const prefixes = [
    ...(dark && hover ? ["dark:hover:", "dark:enabled:hover:"] : []),
    ...(dark ? ["dark:"] : []),
    ...(hover ? ["hover:", "enabled:hover:"] : []),
    "",
  ];

  for (const prefix of prefixes) {
    const start = `${prefix}${utility}-`;
    const found = classes.findLast(
      (name) => name.startsWith(start) && tokens.has(name.slice(start.length)),
    );
    if (found) return found.slice(start.length);
  }
  return undefined;
}
