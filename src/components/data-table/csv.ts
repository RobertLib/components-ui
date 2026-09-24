import { formatCellValue, toJson } from "./format-value";
import { getColumnValue, toNumber } from "./query";
import { toIntlLocale } from "../../i18n/format";
import type { Column } from "./types";
import type { Locale } from "../../i18n/types";

export interface CsvOptions {
  /**
   * The language the values are written in - numbers with its decimal
   * separator (without grouping, so a spreadsheet reads them as numbers),
   * dates by its date format, booleans as its "Yes" / "No". It also picks
   * the default `separator`.
   */
  locale: Locale;
  /**
   * The field separator - by default `;` for languages writing a decimal
   * comma (so e.g. a Czech Excel opens the file in columns) and `,` for the
   * others.
   */
  separator?: string;
}

// A cell starting with one of these is taken for a formula by spreadsheets
// - also with the full-width forms some of them accept, and after spaces
// (non-breaking and ideographic too) that importers trim (CSV injection)
const FORMULA_START = /^\s*[=+\-@\t\r＝＋－＠]/;

const decimalSeparators = new Map<string, string>();

/** The decimal separator of a language - `.` in English, `,` in Czech. */
function getDecimalSeparator(localeCode: string) {
  let separator = decimalSeparators.get(localeCode);

  if (separator === undefined) {
    separator =
      new Intl.NumberFormat(toIntlLocale(localeCode))
        .formatToParts(1.5)
        .find((part) => part.type === "decimal")?.value ?? ".";
    decimalSeparators.set(localeCode, separator);
  }

  return separator;
}

/** The field separator a spreadsheet of the language expects. */
export const getCsvSeparator = (localeCode: string) =>
  getDecimalSeparator(localeCode) === "," ? ";" : ",";

const numberFormats = new Map<string, Intl.NumberFormat>();

// Written by some languages (Swedish, Finnish) - text to a spreadsheet
const MINUS_SIGN = String.fromCharCode(0x2212);

/** A number as a spreadsheet of the language reads it - `1234,5` in Czech. */
function formatCsvNumber(localeCode: string, value: number) {
  let format = numberFormats.get(localeCode);

  if (!format) {
    format = new Intl.NumberFormat(toIntlLocale(localeCode), {
      maximumFractionDigits: 20,
      useGrouping: false,
    });
    numberFormats.set(localeCode, format);
  }

  return Number.isFinite(value)
    ? format.format(value).replace(MINUS_SIGN, "-")
    : "";
}

/**
 * A text that cannot start a formula. A number stored as text (`-3.50`,
 * `+1e3`) is none - the spreadsheet reads it as the number it is, not as
 * a text with a quote in front.
 */
const protectText = (text: string) =>
  FORMULA_START.test(text) && toNumber(text) === null ? `'${text}` : text;

/** A field quoted (RFC 4180), quotes doubled. */
const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;

/**
 * A text field: protected from starting a formula, and quoted when it has
 * a quote, a line break or a list separator - also the one not used, as a
 * spreadsheet set up for it would split the field, and the part after the
 * split could start a formula.
 */
function toTextField(text: string, separator: string) {
  const protectedText = protectText(text);
  return protectedText.includes(separator) || /[",;\t\r\n]/.test(protectedText)
    ? quote(protectedText)
    : protectedText;
}

/**
 * A value as a field. Numbers, dates and booleans are written by the table
 * - they cannot start a formula, and need quotes only for the separator
 * (a decimal comma where `,` separates).
 */
function toField(value: unknown, locale: Locale, separator: string) {
  let text: string;

  if (typeof value === "number") text = formatCsvNumber(locale.code, value);
  else if (typeof value === "bigint") text = String(value);
  else if (typeof value === "boolean" || value instanceof Date) {
    text = formatCellValue(value, locale) ?? "";
  } else {
    return toTextField(
      formatCellValue(value, locale) ?? toJson(value),
      separator,
    );
  }

  return text.includes(separator) ? quote(text) : text;
}

/**
 * The rows as CSV text: a header row with the column names, then a line
 * per row with the values of `columns` in their order - `exportValue` of a
 * column, or the value its cell shows without a `render`. Lines end with
 * CRLF; add a BOM before saving (`downloadCsv` does) so that Excel reads
 * the file as UTF-8.
 *
 * ```ts
 * const csv = createCsv(rows, columns, { locale: useLocale() });
 * ```
 */
export function createCsv<T>(
  rows: T[],
  columns: Column<T>[],
  { locale, separator = getCsvSeparator(locale.code) }: CsvOptions,
) {
  const header = columns
    .map((column) => toTextField(column.labelTitle ?? column.label, separator))
    .join(separator);
  const lines = rows.map((row) =>
    columns
      .map((column) =>
        toField(
          column.exportValue
            ? column.exportValue(row)
            : getColumnValue(row, column),
          locale,
          separator,
        ),
      )
      .join(separator),
  );

  return [header, ...lines].join("\r\n");
}

/**
 * Saves CSV text as a file in the browser - with a UTF-8 BOM, so that Excel
 * shows the accented letters right. `.csv` is added to a `filename`
 * without it.
 */
export function downloadCsv(csv: string, filename: string) {
  const name = /\.csv$/i.test(filename) ? filename : `${filename}.csv`;
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();

  // Some browsers read the file only after the click has returned
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
