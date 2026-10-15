/**
 * Exact arithmetic on decimal strings ("1234.50", "-0.1") for the
 * `stringMode` of `NumberInput` - with `BigInt`, so that neither a sum like
 * 0.1 + 0.2 nor a number beyond 2^53 loses a digit, as a `number` would.
 */

/**
 * A decimal number as the integer of its digits and the number of them
 * after the decimal point: -12.50 is `{ digits: -1250n, scale: 2 }`.
 */
interface Scaled {
  digits: bigint;
  scale: number;
}

// A sign, digits with an optional decimal point, an optional exponent -
// "-1234.5", ".5", "1.", "1.2345E4" (of a scientific format)
const DECIMAL_TEXT = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i;

// The largest exponent read - an exponent writes its zeros out, and one of
// a million would make a string of a million digits
const MAX_EXPONENT = 1000;

/** The scaled number of a decimal text - `null` for any other text. */
function toScaled(text: string): Scaled | null {
  const match = DECIMAL_TEXT.exec(text.trim());
  if (!match || (!match[2] && !match[3])) return null;

  const [, sign, integer = "", fraction = "", exponentText = "0"] = match;
  const exponent = Number(exponentText);
  if (Math.abs(exponent) > MAX_EXPONENT) return null;

  let digitsText = `${integer}${fraction}` || "0";
  let scale = fraction.length - exponent;
  // A positive exponent past the fraction - its zeros written out
  if (scale < 0) {
    digitsText += "0".repeat(-scale);
    scale = 0;
  }
  const digits = BigInt(digitsText);
  return { digits: sign === "-" ? -digits : digits, scale };
}

/**
 * The decimal text of a scaled number - with all its `scale` fraction
 * digits, trailing zeros too ("1234.50"), and no minus sign for zero.
 */
function toText({ digits, scale }: Scaled) {
  const negative = digits < 0n;
  const text = (negative ? -digits : digits)
    .toString()
    .padStart(scale + 1, "0");
  const integer = scale > 0 ? text.slice(0, -scale) : text;
  const fraction = scale > 0 ? text.slice(-scale) : "";
  return `${negative ? "-" : ""}${integer}${fraction && `.${fraction}`}`;
}

/** The two numbers with the same scale - their digits compare as integers. */
function align(a: Scaled, b: Scaled) {
  const scale = Math.max(a.scale, b.scale);
  return {
    a: a.digits * 10n ** BigInt(scale - a.scale),
    b: b.digits * 10n ** BigInt(scale - b.scale),
    scale,
  };
}

/** The shortest decimal text of a scaled number - without trailing zeros. */
function toShortText(scaled: Scaled) {
  let { digits, scale } = scaled;
  while (scale > 0 && digits % 10n === 0n) {
    digits /= 10n;
    scale--;
  }
  return toText({ digits, scale });
}

/**
 * The decimal text of `text` in its shortest form - "1234.5" for
 * "+01234.500", "100" for "1E2", "0" for "-0.0" - or `null` for a text that
 * is no decimal number.
 */
export function normalizeDecimal(text: string) {
  const scaled = toScaled(text);
  return scaled && toShortText(scaled);
}

/**
 * `text` multiplied by 10 to the power of `places` - exactly, with the
 * trailing zeros it has: "25.50" shifted by -2 is "0.2550".
 */
export function shiftDecimal(text: string, places: number) {
  const scaled = toScaled(text);
  if (!scaled) return text;

  const scale = scaled.scale - places;
  return toText(
    scale < 0
      ? { digits: scaled.digits * 10n ** BigInt(-scale), scale: 0 }
      : { digits: scaled.digits, scale },
  );
}

/** -1, 0 or 1 as `a` is smaller than, equal to or larger than `b`. */
export function compareDecimals(a: string, b: string) {
  const left = toScaled(a);
  const right = toScaled(b);
  if (!left || !right) return 0;

  const aligned = align(left, right);
  return aligned.a < aligned.b ? -1 : aligned.a > aligned.b ? 1 : 0;
}

/** Whether `text` is a decimal number - zero or negative included. */
export const isDecimal = (text: string) => toScaled(text) !== null;

/** The fraction digits `text` is written with - 4 for "0.0001". */
export function decimalPlaces(text: string) {
  return Math.max(0, toScaled(text)?.scale ?? 0);
}

/** `a` divided by `b` (positive), rounded down - also for a negative `a`. */
const floorDivide = (a: bigint, b: bigint) =>
  a >= 0n ? a / b : -((-a + b - 1n) / b);

/** The bounds and the step of a field - decimal texts. */
export interface DecimalStepOptions {
  max?: string;
  min?: string;
  /** A positive decimal. */
  step: string;
}

/**
 * `stepValue` for decimal texts - exact at any size and precision: the
 * value `count` steps up (`direction` 1) or down (-1) from `value`, on the
 * grid of `step` counted from `min` (or 0) like a native number input. A
 * value between two steps moves to the next one; an empty field starts at
 * `min` going up and at `max` going down (or 0). Within `min` and `max`, and
 * never backwards: past a `max` off the grid the value stays.
 */
export function stepDecimal(
  value: string | null,
  direction: 1 | -1,
  count: number,
  { max, min, step }: DecimalStepOptions,
) {
  const clamp = (next: string) => {
    if (min !== undefined && compareDecimals(next, min) < 0) return min;
    if (max !== undefined && compareDecimals(next, max) > 0) return max;
    return next;
  };

  const start = () => clamp((direction > 0 ? min : max) ?? "0");
  if (value === null) return start();

  const current = toScaled(value);
  const stepScaled = toScaled(step);
  if (!current || !stepScaled || stepScaled.digits <= 0n) return start();

  const base = toScaled(min ?? "0") ?? { digits: 0n, scale: 0 };
  const top = max === undefined ? null : toScaled(max);
  // One scale for all of them - their digits are then whole numbers
  const scale = Math.max(
    current.scale,
    base.scale,
    stepScaled.scale,
    top?.scale ?? 0,
  );
  const at = (scaled: Scaled) =>
    scaled.digits * 10n ** BigInt(scale - scaled.scale);
  const valueDigits = at(current);
  const baseDigits = at(base);
  const stepDigits = at(stepScaled);

  const offset = valueDigits - baseDigits;
  const index =
    direction > 0
      ? floorDivide(offset, stepDigits) + BigInt(count)
      : -floorDivide(-offset, stepDigits) - BigInt(count);
  let next = baseDigits + index * stepDigits;

  // Past `max` - the last step within it, as a native input does
  if (top && next > at(top)) {
    next =
      baseDigits + floorDivide(at(top) - baseDigits, stepDigits) * stepDigits;
  }

  const result = clamp(toShortText({ digits: next, scale }));
  const order = compareDecimals(result, value);
  return (direction > 0 ? order < 0 : order > 0) ? value : result;
}
