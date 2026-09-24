import { formatDate, getDayPeriods } from "../../utils/date";
import type { Locale } from "../../i18n/types";

/** An object in a list has no text of its own - its JSON tells what it is. */
export function toJson(value: unknown) {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    // A circular structure or a BigInt inside
    return "";
  }
}

/**
 * The text a cell shows for its value when the column has no `render`:
 * strings and numbers as they are, dates by the date (and time) format of
 * the locale, booleans as its "Yes" / "No", and lists as their items joined
 * by commas (objects in them as JSON). `undefined` for values that have no
 * text - objects and React elements.
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
      // AM / PM of the language, as the date picker writes them
      getDayPeriods(locale.code),
    );
  }

  // A list, e.g. tags - React would run its texts together ("alphabeta")
  // and cannot render the objects in it at all
  if (Array.isArray(value)) {
    return value
      .map((item) => formatCellValue(item, locale) ?? toJson(item))
      .filter(Boolean)
      .join(", ");
  }

  return undefined;
}
