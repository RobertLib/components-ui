import { useCallback } from "react";
import type { DateFormats } from "../i18n/ui/types";
import { useLocale } from "../providers/ui-context";
import { formatDate, getDayPeriods, parseISODate } from "../utils/date";
import { inTimeZone } from "../utils/time-zone";

export interface FormatDateOptions {
  /**
   * The IANA time zone a date with a time is written in, e.g.
   * `"Europe/Prague"` - the browser's by default. A date alone
   * (`2026-10-01`) is the same day everywhere.
   */
  timeZone?: string;
}

/**
 * Writes a date - a `Date`, a `YYYY-MM-DD` date or an ISO date and time -
 * by a pattern of the locale's `formats`, `""` for none or an invalid one.
 */
export type FormatDate = (
  value: Date | string | null | undefined,
  format?: keyof DateFormats,
  options?: FormatDateOptions,
) => string;

/**
 * Writes dates as the pickers of the library show and take them - by the
 * patterns of the locale's `formats` (`D. M. YYYY`, `MM/DD/YYYY h:mm A`),
 * which `createLocale` sets - so that a list shows a date as its edit form
 * does:
 *
 * ```tsx
 * const formatDate = useFormatDate();
 * formatDate(member.birthDate); // "1. 10. 2026"
 * formatDate(entry.createdAt, "dateTime", { timeZone: "Europe/Prague" });
 * ```
 *
 * For dates in words ("1 October 2026"), use `Intl.DateTimeFormat`.
 */
export default function useFormatDate(): FormatDate {
  const locale = useLocale();

  return useCallback<FormatDate>(
    (value, format = "date", options) => {
      if (value === null || value === undefined || value === "") return "";

      // A date alone is a day of the calendar - not midnight in UTC, which
      // is the day before west of Greenwich
      const isDateOnly =
        typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
      const date = isDateOnly
        ? parseISODate(value)
        : typeof value === "string"
          ? new Date(value)
          : value;
      if (!date || Number.isNaN(date.getTime())) return "";

      return formatDate(
        isDateOnly ? date : inTimeZone(date, options?.timeZone),
        locale.formats[format],
        getDayPeriods(locale.code),
      );
    },
    [locale],
  );
}
