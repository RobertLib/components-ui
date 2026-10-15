import { compareDecimals, normalizeDecimal, stepDecimal } from "./decimal";
import { stepValue, toCanonical, type NumberFormat } from "./number-format";

/** A value of `NumberInput` - a number, or a decimal string in `stringMode`. */
export type FieldValue = number | string;

/** The bounds and the step of a field, as values of its kind. */
interface FieldStepOptions<V> {
  max?: V;
  min?: V;
  /** A positive value. */
  step: V;
}

/**
 * What `NumberInput` does with its values - numbers, or the decimal strings
 * of `stringMode`. Methods, so that the values of one kind stand in for
 * those of both.
 */
export interface FieldValues<V extends FieldValue> {
  /** -1, 0 or 1 as `a` is smaller than, equal to or larger than `b`. */
  compare(a: V, b: V): number;
  /** The value as the field shows it without the focus - "1 234,50 Kč". */
  format(value: V): string;
  /** A value of the props - `null` for none, or for one of another shape. */
  from(value: unknown): V | null;
  /** Whether `text` is a number or the start of one - see `NumberFormat`. */
  isPartial(text: string, allowNegative: boolean): boolean;
  /** The value a typed text stands for, rounded - `null` for none. */
  parse(text: string): V | null;
  /** The value rounded as the format does. */
  round(value: V): V;
  /** `count` steps from `value` - see `stepValue`. */
  step(
    value: V | null,
    direction: 1 | -1,
    count: number,
    options: FieldStepOptions<V>,
  ): V;
  /** The value as it is edited - "1234,5". */
  toEditText(value: V): string;
  /** The value as the form submits it - "1234.5". */
  toFormValue(value: V): string;
  /** The value as a number - for `aria-valuenow`. */
  toNumber(value: V): number;
}

/** The values of a field of numbers - `number`, as precise as a double is. */
export function getNumberValues(format: NumberFormat): FieldValues<number> {
  return {
    compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
    format: format.format,
    // A finite number - anything else (`undefined`, `NaN`) is no value
    from: (value) =>
      typeof value === "number" && Number.isFinite(value) ? value : null,
    isPartial: format.isPartial,
    parse: format.parse,
    round: format.round,
    step: stepValue,
    toEditText: format.toEditText,
    toFormValue: toCanonical,
    toNumber: (value) => value,
  };
}

/**
 * The values of a field in `stringMode` - decimal strings with every digit,
 * in the range of a number (up to 1.8e308). A number given in the props is
 * taken by the digits it is written with.
 */
export function getDecimalValues(format: NumberFormat): FieldValues<string> {
  return {
    compare: compareDecimals,
    format: format.decimal.format,
    from: (value) => {
      const decimal =
        typeof value === "string"
          ? normalizeDecimal(value)
          : typeof value === "number" && Number.isFinite(value)
            ? toCanonical(value)
            : null;
      // Every digit, but in the range of a number - `Intl` writes a decimal
      // text beyond it as infinity
      return decimal !== null && Number.isFinite(Number(decimal))
        ? decimal
        : null;
    },
    isPartial: format.isPartial,
    parse: format.decimal.parse,
    round: format.decimal.round,
    step: stepDecimal,
    toEditText: format.decimal.toEditText,
    // Already a decimal text - with the fraction digits of the format
    toFormValue: (value) => value,
    toNumber: Number,
  };
}

/**
 * The values of a field of `format` - numbers, or the decimal strings of
 * `stringMode`. A hook, so that the React Compiler takes them as unchanging
 * - and a call of their methods as no change of them.
 */
export function useFieldValues(
  format: NumberFormat,
  stringMode: boolean,
): FieldValues<FieldValue> {
  return stringMode ? getDecimalValues(format) : getNumberValues(format);
}
