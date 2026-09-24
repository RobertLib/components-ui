import { formatCellValue } from "./format-value";
import { getColumnValue, toNumber } from "./query";
import { toIntlLocale } from "../../i18n/format";
import type { Column, ColumnSummary } from "./types";
import type { Locale } from "../../i18n/types";

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

/** The smallest or the largest of the values - `null` without any. */
function extreme<V>(values: V[], isBefore: (a: V, b: V) => boolean) {
  let result: V | null = null;
  for (const value of values) {
    if (result === null || isBefore(value, result)) result = value;
  }
  return result;
}

/**
 * The aggregate of a column over `rows`: `count` counts the rows, `sum`,
 * `avg`, `min` and `max` take the numbers among the values (also numbers
 * stored as strings) - `min` / `max` the dates of a column without numbers.
 * `sum` of no numbers is 0, the others are `null` then. A function
 * `summary` returns what it returns.
 */
export function computeSummary<T>(
  summary: ColumnSummary<T>,
  column: Column<T>,
  rows: T[],
): unknown {
  if (typeof summary === "function") return summary(rows);
  if (summary === "count") return rows.length;

  const values = rows.map((row) => getColumnValue(row, column));
  const numbers = values
    .map(toNumber)
    .filter((value): value is number => value !== null && !Number.isNaN(value));

  switch (summary) {
    case "sum":
      return numbers.reduce((total, value) => total + value, 0);
    case "avg":
      return numbers.length
        ? numbers.reduce((total, value) => total + value, 0) / numbers.length
        : null;
    case "min":
    case "max": {
      const isBefore =
        summary === "min"
          ? (a: number, b: number) => a < b
          : (a: number, b: number) => a > b;
      if (numbers.length > 0) return extreme(numbers, isBefore);

      return extreme(values.filter(isValidDate), (a, b) =>
        isBefore(a.getTime(), b.getTime()),
      );
    }
  }
}

const numberFormats = new Map<string, Intl.NumberFormat>();

/** A number as the language writes it - an average with two decimals at most. */
function formatSummaryNumber(
  localeCode: string,
  value: number,
  isAverage: boolean,
) {
  const key = `${localeCode}|${isAverage}`;
  let format = numberFormats.get(key);

  if (!format) {
    format = new Intl.NumberFormat(
      toIntlLocale(localeCode),
      isAverage ? { maximumFractionDigits: 2 } : undefined,
    );
    numberFormats.set(key, format);
  }

  return format.format(value);
}

/**
 * A summary value for display: numbers as the language writes them
 * (`1 234,5`), dates by its date format, `null` as nothing - anything else
 * (text, elements) as it is.
 */
export function formatSummaryValue(
  value: unknown,
  locale: Locale,
  isAverage = false,
): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? formatSummaryNumber(locale.code, value, isAverage)
      : null;
  }
  if (value instanceof Date || typeof value === "boolean") {
    return formatCellValue(value, locale);
  }

  return value as React.ReactNode;
}
