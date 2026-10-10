import { useCallback } from "react";
import useIsHydrated from "./use-is-hydrated";
import {
  parseMonth,
  parseTime,
  parseWeek,
} from "../components/ui/datetime-picker/parse";
import type { DateFormats, Locale } from "../i18n/ui/types";
import { useLocale } from "../providers/ui-context";
import {
  formatDate,
  formatPattern,
  getDayPeriods,
  getISOWeekOfDay,
  isValidDay,
  writesWeek,
  type DateParts,
} from "../utils/date";
import { dateTimeZone, inTimeZone, isTimeZone } from "../utils/time-zone";

export interface FormatDateOptions {
  /**
   * The IANA time zone a moment in time (a `Date`, an ISO date and time with
   * its zone) is written in, e.g. `"Europe/Prague"` - by default the zone
   * of a date of `useToday` or `inTimeZone`, else the browser's. A value of
   * a picker (`2026-10-01`, `2026-10-01T14:30`) is a time on the clock
   * already, the same everywhere.
   */
  timeZone?: string;
}

/**
 * Writes a date by a pattern of the locale's `formats` - `date` by default,
 * the pattern of its picker for a month, a week or a time, also in place of
 * a `format` with a part they do not have (the day of `2026-10`) - `""` for
 * none, an invalid one or an invalid `timeZone`.
 */
export type FormatDate = (
  value: Date | string | null | undefined,
  format?: keyof DateFormats,
  options?: FormatDateOptions,
) => string;

// The shapes of the values of the pickers - also of one that is no real
// date (`2026-02-30`), which `Date` would take for a day of March, and a
// date and time with a lowercase `t`, which RFC 3339 allows
const PICKER_VALUE =
  /^(?:\d{4}-\d{2}(?:-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?)?|\d{4}-W\d{2}|\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;

// Every part of a date - see `writesOnly`
const ALL_PARTS: DateParts = {
  day: 1,
  hours: 1,
  minutes: 1,
  month: 1,
  week: 1,
  year: 1,
};

/**
 * Whether `pattern` writes nothing but `parts` - `formatPattern` writes a
 * part it is not given as 0 (`10/00/2026`), so a pattern that writes
 * another part comes out different once every part is given.
 */
const writesOnly = (pattern: string, parts: Partial<DateParts>) =>
  formatPattern(pattern, parts) ===
  formatPattern(pattern, { ...ALL_PARTS, ...parts });

/**
 * A value as the pickers take it - `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`,
 * `YYYY-MM`, `YYYY-Www` or `HH:mm` - written as they show it: a time on the
 * clock, not midnight in UTC, which is the day (the month) before west of
 * Greenwich. `""` for one that is no real date or time, `undefined` for
 * anything else.
 */
function formatPickerValue(
  value: string,
  format: keyof DateFormats | undefined,
  locale: Locale,
) {
  if (!PICKER_VALUE.test(value)) return undefined;
  const dayPeriods = getDayPeriods(locale.code);

  // By the pattern of `format` if the value has every part it writes - else
  // by the pattern of its own picker, not with the day of a month as `00`.
  // A pattern with the week writes the year of the ISO week (2024-12-30 is
  // `W01.2025`).
  const write = (
    kind: keyof DateFormats,
    parts: Partial<DateParts>,
    weekYear?: number,
  ) => {
    const wanted = locale.formats[format ?? kind];
    const pattern = writesOnly(wanted, parts) ? wanted : locale.formats[kind];
    return formatPattern(
      pattern,
      weekYear !== undefined && writesWeek(pattern)
        ? { ...parts, year: weekYear }
        : parts,
      dayPeriods,
    );
  };

  // A day, also with a time on the clock - by the calendar alone, which no
  // clock change skips (as one does midnight, or an hour, in some zones)
  const day = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](.+))?$/.exec(value);
  if (day) {
    const year = Number(day[1]);
    const month = Number(day[2]);
    const date = Number(day[3]);
    const time = day[4] === undefined ? undefined : parseTime(day[4]);
    if (!isValidDay(year, month, date) || time === null) return "";
    const isoWeek = getISOWeekOfDay(year, month, date);
    return write(
      "date",
      {
        day: date,
        month,
        week: isoWeek.week,
        year,
        ...(time && {
          hours: Number(time.hours),
          minutes: Number(time.minutes),
        }),
      },
      isoWeek.year,
    );
  }

  const month = parseMonth(value);
  if (month) return write("month", month);

  const week = parseWeek(value);
  if (week) return write("week", week);

  const time = parseTime(value);
  if (time) {
    return write("time", {
      hours: Number(time.hours),
      minutes: Number(time.minutes),
    });
  }

  return "";
}

/** A moment in time on the clock of `timeZone` - `""` for an invalid one. */
function formatInstant(
  date: Date,
  pattern: string,
  locale: Locale,
  timeZone?: string,
) {
  if (Number.isNaN(date.getTime())) return "";
  try {
    return formatDate(
      inTimeZone(date, timeZone),
      pattern,
      getDayPeriods(locale.code),
    );
  } catch {
    // No IANA time zone - nothing, like an invalid date
    return "";
  }
}

/**
 * Writes dates as the pickers of the library show and take them - by the
 * patterns of the locale's `formats` (`DD.MM.YYYY`, `MM/DD/YYYY h:mm A`),
 * which `createLocale` sets - so that a list shows a date as its edit form
 * does:
 *
 * ```tsx
 * const formatDate = useFormatDate();
 * formatDate("2026-10-01"); // "10/01/2026" in `en`, "01.10.2026" in `cs`
 * formatDate("2026-10"); // "10/2026" - by `formats.month`
 * formatDate(entry.createdAt, "dateTime", { timeZone: "Europe/Prague" });
 * ```
 *
 * A moment in time without a `timeZone` is written on the clock of the
 * browser - so as `""` on the server and while a server-rendered page
 * hydrates, whose clock may be another. For dates in words ("1 October
 * 2026"), use `Intl.DateTimeFormat`.
 */
export default function useFormatDate(): FormatDate {
  const locale = useLocale();
  const isHydrated = useIsHydrated();

  return useCallback<FormatDate>(
    (value, format, options) => {
      if (value === null || value === undefined || value === "") return "";
      // Like an invalid date - also for a value it would not change
      const given = options?.timeZone || undefined;
      if (given !== undefined && !isTimeZone(given)) return "";

      if (typeof value === "string") {
        const written = formatPickerValue(value, format, locale);
        if (written !== undefined) return written;
      }
      const date = typeof value === "string" ? new Date(value) : value;
      // The zone of a date of `useToday` or `inTimeZone` - the same on the
      // server and in the browser
      const timeZone = given ?? dateTimeZone(date);
      if (!timeZone && !isHydrated) return "";

      return formatInstant(
        date,
        locale.formats[format ?? "date"],
        locale,
        timeZone,
      );
    },
    [isHydrated, locale],
  );
}
