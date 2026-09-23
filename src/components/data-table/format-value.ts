import { formatDate } from "../../utils/date";
import type { Locale } from "../../i18n/types";

/**
 * The text a cell shows for its value when the column has no `render`:
 * strings and numbers as they are, dates by the date (and time) format of
 * the locale, booleans as its "Yes" / "No". `undefined` for values that have
 * no text - objects, arrays and React elements.
 */
export function formatCellValue(
  value: unknown,
  locale: Locale,
): string | undefined {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? locale.messages.common.yes : locale.messages.common.no;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    // A date at midnight stands for the day itself
    const hasTime = value.getHours() !== 0 || value.getMinutes() !== 0;
    return formatDate(
      value,
      hasTime ? locale.formats.dateTime : locale.formats.date,
    );
  }

  return undefined;
}
