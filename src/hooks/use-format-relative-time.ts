import { useCallback } from "react";
import useCurrentMinute from "../components/ui/calendar/use-current-minute";
import useFormatDate from "./use-format-date";
import { useLocale } from "../providers/ui-context";
import { startOfDay } from "../utils/date";
import { inTimeZone } from "../utils/time-zone";

export interface FormatRelativeTimeOptions {
  /**
   * Past this many days the time is written as a date and time of the
   * locale (`dateTime`) instead - "12. 3. 2026 14:30" says more than
   * "před 7 měsíci". `undefined` writes every time relative.
   */
  absoluteAfterDays?: number;
  /** `Intl.RelativeTimeFormat` style - `"short"` writes "před 5 min". */
  style?: Intl.RelativeTimeFormatStyle;
}

/**
 * Writes a moment in time relative to now in the language of the locale -
 * "před 5 minutami", "včera", "in 2 hours". `""` for none or an invalid one.
 */
export type FormatRelativeTime = (
  value: Date | string | number | null | undefined,
  options?: FormatRelativeTimeOptions,
) => string;

// Literals - a module-level expression would stay in every app that
// imports the library
const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function toDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole calendar days from `now` to `date` - 1 for any time of tomorrow. */
function calendarDays(date: Date, now: Date, timeZone?: string) {
  const day = startOfDay(inTimeZone(date, timeZone)).getTime();
  const today = startOfDay(inTimeZone(now, timeZone)).getTime();
  // A day is 23 or 25 hours long when the clocks change
  return Math.round((day - today) / DAY);
}

/** Whole calendar months from `now` to `date`. */
function calendarMonths(date: Date, now: Date, timeZone?: string) {
  const zoned = inTimeZone(date, timeZone);
  const today = inTimeZone(now, timeZone);
  return (
    (zoned.getFullYear() - today.getFullYear()) * 12 +
    zoned.getMonth() -
    today.getMonth()
  );
}

/**
 * Writes times relative to now - "před 5 minutami", "včera", "za 2 hodiny" -
 * by `Intl.RelativeTimeFormat` in the language of the locale, and writes
 * them again every minute. Less than 45 seconds is "now"; minutes up to 45,
 * hours up to 22, then calendar days ("včera"), weeks, months and years.
 *
 * On the server and while a server-rendered page hydrates, it writes the
 * date and time (the locale's `dateTime`): the clock of the server is not
 * the user's. Call it once in a list and pass the function down - each call
 * runs its own timer.
 */
export default function useFormatRelativeTime(
  timeZone?: string,
): FormatRelativeTime {
  const locale = useLocale();
  const formatDate = useFormatDate();
  const now = useCurrentMinute(true);

  return useCallback<FormatRelativeTime>(
    (value, options = {}) => {
      if (value === null || value === undefined || value === "") return "";
      const date = toDate(value);
      if (!date) return "";

      const absolute = () => formatDate(date, "dateTime", { timeZone });
      if (!now) return absolute();

      // The real moment, not the minute `now` was taken at
      const current = new Date(Math.max(now.getTime(), Date.now()));
      const diff = date.getTime() - current.getTime();
      const distance = Math.abs(diff);

      const { absoluteAfterDays, style = "long" } = options;
      if (
        absoluteAfterDays !== undefined &&
        distance > absoluteAfterDays * DAY
      ) {
        return absolute();
      }

      const format = new Intl.RelativeTimeFormat(locale.code, {
        numeric: "auto",
        style,
      });

      if (distance < 45 * SECOND) return format.format(0, "second");
      if (distance < 45 * MINUTE) {
        return format.format(
          Math.round(diff / MINUTE) || Math.sign(diff),
          "minute",
        );
      }
      if (distance < 22 * HOUR) {
        return format.format(
          Math.round(diff / HOUR) || Math.sign(diff),
          "hour",
        );
      }

      const days = calendarDays(date, current, timeZone);
      if (Math.abs(days) < 7) {
        return format.format(days || Math.sign(diff), "day");
      }
      if (Math.abs(days) < 28)
        return format.format(Math.round(days / 7), "week");

      const months = calendarMonths(date, current, timeZone);
      if (Math.abs(months) < 12) {
        return format.format(months || Math.sign(diff), "month");
      }
      return format.format(Math.trunc(months / 12) || Math.sign(diff), "year");
    },
    [formatDate, locale.code, now, timeZone],
  );
}
