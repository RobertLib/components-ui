import { formatCellValue } from "./format-value";
import { getColumnValue, toNumber } from "./query";
import { toIntlLocale } from "../../i18n/format";
import { parseISODate } from "../../utils/date";
import type { Column, ColumnSummary } from "./types";
import type { Locale } from "../../i18n/types";

// `2026-09-24`, `2026-09-24T10:30`, `2026-09-24T08:30:00Z` - the dates of an
// API, which sends them as texts
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T|$)/;

/** The moment of a date - a `Date` or an ISO text - or `null` for none. */
function toTime(value: unknown) {
  let time: number | undefined;

  if (value instanceof Date) {
    time = value.getTime();
  } else if (typeof value === "string" && ISO_DATE.test(value)) {
    // A day alone is that day here - `Date.parse` takes it for midnight in
    // UTC, the day before west of Greenwich; a date-time without a zone is
    // local time, one with a zone the moment it names
    time =
      value.length === 10 ? parseISODate(value)?.getTime() : Date.parse(value);
  }

  return time === undefined || Number.isNaN(time) ? null : time;
}

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
 * stored as strings) - `min` / `max` the dates of a column without numbers,
 * `Date`s or ISO texts, returned as they are. `sum` of no numbers is 0, the
 * others are `null` then. A function `summary` returns what it returns.
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

      // The date as the cells show it - a text stays a text
      const dates = values.flatMap((value) => {
        const time = toTime(value);
        return time === null ? [] : [{ time, value }];
      });
      return extreme(dates, (a, b) => isBefore(a.time, b.time))?.value ?? null;
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
