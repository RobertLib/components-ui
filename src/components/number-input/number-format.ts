import logger from "../../utils/logger";
import { toIntlLocale } from "../../i18n/format";

/** The characters a locale writes numbers with, and what to ignore around them. */
interface NumberSymbols {
  /** Texts of the format around the number - a currency, a percent sign, a unit. */
  affixes: string[];
  /** Whether the format writes a negative number in parentheses - "($5.00)". */
  accounting: boolean;
  /** The decimal separator with Latin digits - those of the edited text. */
  decimal: string;
  /** The group separator with Latin digits. */
  group: string;
  /**
   * The digits and separators of the locale's own numbering system (Arabic
   * "١٢٣٫٤") - with the Latin ones they stand for.
   */
  native: Map<string, string>;
}

/** What a typed text says - see `readNumber`. */
interface ReadNumber {
  /** Whether it has a decimal separator - a fraction was started. */
  hasDecimal: boolean;
  negative: boolean;
  /** The number it stands for - `null` without digits or for no number. */
  number: number | null;
  /** Whether it is a number, or the start of one typing can complete. */
  valid: boolean;
}

/** Writes and reads the numbers of one locale and format - see `getNumberFormat`. */
export interface NumberFormat {
  /**
   * The most fraction digits the value keeps - of the percent number
   * (25.5 %), not of the fraction, for `style: "percent"`.
   */
  fractionDigits: number;
  /** The value as the field shows it without the focus - "1 234,50 Kč". */
  format: (value: number) => string;
  /**
   * Whether `text` is a number or the start of one - checked on every
   * keystroke. A minus sign only with `allowNegative`.
   */
  isPartial: (text: string, allowNegative: boolean) => boolean;
  /**
   * The value a typed text stands for, rounded to `fractionDigits` - `null`
   * for a text without a number.
   */
  parse: (text: string) => number | null;
  /** The value rounded to `fractionDigits`. */
  round: (value: number) => number;
  /**
   * The value as it is edited - without grouping and symbols, with the
   * decimal separator of the locale: "1234,5".
   */
  toEditText: (value: number) => string;
}

const MINUS_SIGNS = /[\u2212\u2012\u2013\uFE63\uFF0D]/g;
// The full-width digits, comma, full stop and plus of East Asian input
const FULL_WIDTH = /[\uFF0B\uFF0C\uFF0E\uFF10-\uFF19]/g;
// Only ever grouping - no locale writes a decimal separator so
const GROUPING_MARKS = /[\s'\u2019\u02BC]/g;

const INVALID: ReadNumber = {
  hasDecimal: false,
  negative: false,
  number: null,
  valid: false,
};

const countOf = (text: string, char: string) => text.split(char).length - 1;

/**
 * The decimal and the group separator of the dots and commas in `digits` -
 * lenient where the text is unambiguous: "1.5" is 1.5 in Czech (which
 * groups with spaces), "1,5" is 1.5 in English (a comma not followed by
 * three digits groups nothing), "1.234,5" and "1,234.5" are 1234.5
 * anywhere, and a separator repeated ("1.234.567") groups. In a field
 * without fraction digits the group separator of the locale always groups.
 */
function separatorsOf(
  digits: string,
  symbols: NumberSymbols,
  fractionDigits: number,
) {
  const dots = countOf(digits, ".");
  const commas = countOf(digits, ",");

  // Both - the last one separates the fraction
  if (dots > 0 && commas > 0) {
    const decimal =
      digits.lastIndexOf(".") > digits.lastIndexOf(",") ? "." : ",";
    return { decimal, group: decimal === "." ? "," : "." };
  }

  if (dots === 0 && commas === 0) return {};

  const char = dots > 0 ? "." : ",";
  if (char === symbols.decimal) return { decimal: char };

  const followedByGroup = /^\d{3}(?!\d)/.test(
    digits.slice(digits.indexOf(char) + 1),
  );
  // A group follows a digit other than 0 - "0,234" is 0.234 in English too
  const groupsDigits = /[1-9]/.test(digits.slice(0, digits.indexOf(char)));
  const isGroup =
    dots + commas > 1 ||
    (char === symbols.group &&
      (fractionDigits === 0 || (followedByGroup && groupsDigits)));

  return isGroup ? { group: char } : { decimal: char };
}

/**
 * Reads a typed text: the digits with the separators of `separatorsOf`, a
 * leading minus sign, spaces and apostrophes as grouping, and the currency,
 * percent sign or unit of the format anywhere. `valid` tells whether it is
 * a number or the start of one ("", "-", "1,"), `number` what it stands for.
 * The digits of the locale's numbering system count as Latin ones, and an
 * accounting format's parentheses as a minus sign.
 */
function readNumber(
  text: string,
  symbols: NumberSymbols,
  fractionDigits: number,
): ReadNumber {
  // "($1,234.50)" - before the parentheses go with the other affixes
  const parenthesized = symbols.accounting && /^\s*\(.*\)\s*$/.test(text);

  let normalized = Array.from(
    text,
    (char) => symbols.native.get(char) ?? char,
  ).join("");
  for (const affix of symbols.affixes) {
    normalized = normalized.split(affix).join("");
  }
  normalized = normalized
    .replace(FULL_WIDTH, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .replace(GROUPING_MARKS, "")
    .replace(MINUS_SIGNS, "-")
    // A plus sign says nothing - "+5" of `signDisplay: "always"`
    .replace(/^\+/, "");

  const match = /^(-?)([\d.,]*)$/.exec(normalized);
  // No second minus sign in parentheses
  if (!match || (parenthesized && match[1])) return INVALID;

  const digits = match[2];
  const sign = parenthesized ? "-" : match[1];
  const { decimal, group } = separatorsOf(digits, symbols, fractionDigits);
  const decimalIndex = decimal ? digits.lastIndexOf(decimal) : -1;
  const integer = decimalIndex < 0 ? digits : digits.slice(0, decimalIndex);
  const fraction = decimalIndex < 0 ? "" : digits.slice(decimalIndex + 1);
  const integerDigits = group ? integer.split(group).join("") : integer;

  // One decimal separator, and nothing but digits around it
  if (!/^\d*$/.test(integerDigits) || !/^\d*$/.test(fraction)) return INVALID;

  const hasDigits = integerDigits !== "" || fraction !== "";
  const number = hasDigits
    ? Number(`${sign}${integerDigits || "0"}.${fraction || "0"}`)
    : null;

  // More digits than a number holds - Infinity is no value
  if (number !== null && !Number.isFinite(number)) return INVALID;

  return {
    hasDecimal: decimalIndex >= 0,
    negative: sign === "-",
    number,
    valid: true,
  };
}

/** The decimal and the group separator of a format. */
function separatorsOfFormat(format: Intl.NumberFormat) {
  const parts = format.formatToParts(-12345.6);
  return {
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
    group: parts.find((part) => part.type === "group")?.value ?? ",",
  };
}

/**
 * The digits and separators of the numbering systems `display` and the
 * locale write with - mapped to the Latin digits and the separators of
 * `latin`. Empty for a locale writing Latin digits.
 */
function readNativeSymbols(
  locale: string,
  display: Intl.NumberFormat,
  latin: { decimal: string; group: string },
) {
  const native = new Map<string, string>();
  const systems = new Set([
    display.resolvedOptions().numberingSystem,
    new Intl.NumberFormat(locale).resolvedOptions().numberingSystem,
  ]);

  for (const numberingSystem of systems) {
    if (numberingSystem === "latn") continue;

    const digits = new Intl.NumberFormat(locale, {
      numberingSystem,
      useGrouping: false,
    });
    for (let digit = 0; digit <= 9; digit++) {
      native.set(digits.format(digit), String(digit));
    }

    const separators = separatorsOfFormat(
      new Intl.NumberFormat(locale, { numberingSystem }),
    );
    if (separators.decimal !== latin.decimal) {
      native.set(separators.decimal, latin.decimal);
    }
    if (separators.group !== latin.group) {
      native.set(separators.group, latin.group);
    }
  }

  return native;
}

/** The separators of a locale, and the texts of `display` around a number. */
function readSymbols(locale: string, display: Intl.NumberFormat) {
  const latin = separatorsOfFormat(
    new Intl.NumberFormat(locale, { numberingSystem: "latn" }),
  );
  const affixTypes = new Set(["currency", "literal", "percentSign", "unit"]);
  const displayParts = display.formatToParts(-12345.6);

  return {
    accounting: displayParts.some(
      (part) => part.type === "literal" && part.value.includes("("),
    ),
    affixes: [
      ...new Set(
        displayParts
          .filter((part) => affixTypes.has(part.type))
          .map((part) => part.value.trim())
          .filter(Boolean),
      ),
    ],
    ...latin,
    native: readNativeSymbols(locale, display, latin),
  };
}

/**
 * The display format - or the plain number format, with a warning, for
 * options `Intl` refuses (a style `currency` without a `currency`, an
 * unknown currency code, …), which would crash the render.
 */
function createDisplayFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
) {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch (error) {
    logger.warn(
      `NumberInput: Intl.NumberFormat refuses the formatOptions ${JSON.stringify(options)} (${String(error)}) - the plain number format is used instead.`,
    );
    return new Intl.NumberFormat(locale);
  }
}

// Removes the float noise of `value * 100` and `value / 100` - the digits a
// double holds past the 15th are noise there
const cleanFloat = (value: number) => Number(value.toPrecision(15));

function createNumberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): NumberFormat {
  const display = createDisplayFormat(locale, options);
  const resolved = display.resolvedOptions();
  // Formats rounded to significant digits have no fraction digits
  const fractionDigits = resolved.maximumFractionDigits ?? 20;
  const scale = resolved.style === "percent" ? 100 : 1;
  const symbols = readSymbols(locale, display);

  const edit = new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: Math.min(
      resolved.minimumFractionDigits ?? 0,
      fractionDigits,
    ),
    numberingSystem: "latn",
    useGrouping: false,
  });
  // A number JavaScript reads back - rounded as `Intl` rounds
  const plain = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  });

  // The typed number (25 for 25 %) rounded, then scaled to the value -
  // `|| 0` turns -0 into 0. Without a scale it keeps all its digits
  // (1234567890123456).
  const toValue = (typed: number) => {
    const rounded = Number(plain.format(typed));
    return (scale === 1 ? rounded : cleanFloat(rounded / scale)) || 0;
  };
  const toTyped = (value: number) =>
    scale === 1 ? value : cleanFloat(value * scale);

  return {
    fractionDigits,
    format: (value) => display.format(value),
    isPartial: (text, allowNegative) => {
      const read = readNumber(text, symbols, fractionDigits);
      return (
        read.valid &&
        (allowNegative || !read.negative) &&
        (fractionDigits > 0 || !read.hasDecimal)
      );
    },
    parse: (text) => {
      const { number } = readNumber(text, symbols, fractionDigits);
      return number === null ? null : toValue(number);
    },
    round: (value) => toValue(toTyped(value)),
    toEditText: (value) => edit.format(toTyped(value)),
  };
}

const formats = new Map<string, NumberFormat>();

/**
 * Writes and reads numbers in the locale `localeCode` with the
 * `Intl.NumberFormatOptions` of a field - created once per locale and
 * options.
 */
export function getNumberFormat(
  localeCode: string,
  options: Intl.NumberFormatOptions = {},
) {
  const locale = toIntlLocale(localeCode);
  const key = `${locale}\u0000${JSON.stringify(options)}`;
  let format = formats.get(key);

  if (!format) {
    format = createNumberFormat(locale, options);
    formats.set(key, format);
  }

  return format;
}

const canonical = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 20,
  useGrouping: false,
});

/**
 * The value as the form submits it - "1234.5", never in the exponent
 * notation of `String()` ("1e-7").
 */
export const toCanonical = (value: number) => canonical.format(value);

/** How many fraction digits `value` is written with. */
function decimalsOf(value: number) {
  const [digits, exponent] = String(value).split("e");
  const fraction = digits.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent ?? 0));
}

const roundTo = (value: number, decimals: number) =>
  Number(value.toFixed(Math.min(decimals, 100))) || 0;

/** The bounds and the step of a field. */
export interface StepOptions {
  max?: number;
  min?: number;
  /** A positive number. */
  step: number;
}

/**
 * Where `value` lies on the grid of `step` from `base` - in steps. The float
 * noise of the numbers (0.30000000000000004, and 100000018.99999999 for
 * 1000000.19 in steps of 0.01) grows with their size in steps, so the
 * tolerance that keeps a value on the grid grows with it - a few units of
 * the last of the 16 digits a double holds.
 */
function gridPosition(value: number, base: number, step: number) {
  const position = (value - base) / step;
  const size = (Math.abs(value) + Math.abs(base)) / step;
  return { position, tolerance: Math.max(1e-9, size * 1e-15) };
}

/**
 * The value `count` steps up (`direction` 1) or down (-1) from `value` - on
 * the grid of `step` counted from `min` (or 0) like a native number input:
 * a value between two steps moves to the next one. Within `min` and `max`;
 * an empty field starts at `min` going up and at `max` going down (or 0).
 * Like the `stepUp()` of a native input, a step up never lowers the value
 * (and one down never raises it) - at a `max` off the grid, or with a value
 * past it, the value stays.
 */
export function stepValue(
  value: number | null,
  direction: 1 | -1,
  count: number,
  { max, min, step }: StepOptions,
) {
  const clamp = (next: number) =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));

  if (value === null) return clamp((direction > 0 ? min : max) ?? 0);

  const base = min ?? 0;
  const decimals = Math.max(decimalsOf(step), decimalsOf(base));
  const { position, tolerance } = gridPosition(value, base, step);
  const index =
    direction > 0
      ? Math.floor(position + tolerance) + count
      : Math.ceil(position - tolerance) - count;
  let next = roundTo(base + index * step, decimals);

  // Past `max` - the last step within it, as a native input does
  if (max !== undefined && next > max) {
    const last = gridPosition(max, base, step);
    next = roundTo(
      base + Math.floor(last.position + last.tolerance) * step,
      decimals,
    );
  }

  next = clamp(next);
  return (direction > 0 ? next < value : next > value) ? value : next;
}
