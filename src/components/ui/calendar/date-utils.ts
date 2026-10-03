import { copyDate, inTimeZone } from "../../../utils/time-zone";
import type { CalendarAgendaPeriod, CalendarView } from "./types";
import type { WeekDay } from "../../../i18n/types";
import {
  dateOf,
  existingDayOf,
  shiftDay,
  startOfDay,
} from "../../../utils/date";

export { isSameDay } from "../../../utils/date";

/**
 * The start of the day `days` days after the day of `date` - whatever the
 * time of `date`. Unlike `addDays`, which keeps the time, it steps from day
 * to day: where a daylight saving change skips a midnight (Havana,
 * Santiago, Beirut, Cairo, the Azores) that day starts at 1:00, and the
 * days after it start at midnight again.
 */
export const addCalendarDays = (date: Date, days: number) =>
  dateOf(date.getFullYear(), date.getMonth(), date.getDate() + days, date);

/**
 * The start of the day `days` days after the day of `date`, like
 * `addCalendarDays` - `null` for a day the time zone skips as a whole
 * (Samoa went from December 29 to 31 in 2011), which a view leaves out.
 */
export const getCalendarDay = (date: Date, days: number) =>
  existingDayOf(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date,
  );

/** Days from the first day of the week `date` falls in to its day. */
export const daysIntoWeek = (date: Date, weekStartsOn: WeekDay) =>
  (date.getDay() - weekStartsOn + 7) % 7;

/** The start of the first day of the week `date` falls in. */
export const startOfCalendarWeek = (date: Date, weekStartsOn: WeekDay) =>
  addCalendarDays(date, -daysIntoWeek(date, weekStartsOn));

/** The number of the local calendar day, counted in UTC without skipped days. */
function calendarDayNumber(date: Date) {
  const day = new Date(0);
  day.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return day.getTime() / 86_400_000;
}

/** Whole calendar days from the day of `from` to the day of `to`. */
export const daysBetween = (from: Date, to: Date) =>
  calendarDayNumber(to) - calendarDayNumber(from);

/**
 * The clock time `minutes` after the midnight starting the day of `date` -
 * 1440 is the midnight ending it. A time a daylight saving change skips
 * (2:30 when the clocks jump from 2:00 to 3:00) is the end of the gap
 * (3:00), so later times never come out earlier.
 */
export function atMinutes(date: Date, minutes: number) {
  const day = startOfDay(date);
  const result = copyDate(day);
  result.setMinutes(minutes);

  // In a gap `Date` moves on by its length - step back to its end
  while (
    minutesIntoDay(day, result) > minutes &&
    minutesIntoDay(day, copyDate(result, result.getTime() - 60_000)) >= minutes
  ) {
    result.setTime(result.getTime() - 60_000);
  }

  return result;
}

/** `hours` o'clock on the day of `date` - 24 is the midnight ending it. */
export const atHour = (date: Date, hours: number) =>
  atMinutes(date, hours * 60);

/**
 * The clock time of `date` in minutes since the midnight starting `day` -
 * the midnight ending it is 24:00 (1440).
 */
export function minutesIntoDay(day: Date, date: Date) {
  return (
    daysBetween(day, date) * 1440 + date.getHours() * 60 + date.getMinutes()
  );
}

/** `date` moved into [`min`, `max`] - `min` wins when they cross. */
export const clampDate = (date: Date, min: Date, max: Date) =>
  copyDate(
    date,
    Math.max(min.getTime(), Math.min(date.getTime(), max.getTime())),
  );

/**
 * The start of the grid slot at `hours:minutes` on the day of `date`. The
 * row of the end hour stands for the last slot before it - like a range
 * picked there - so the time is one shown; with the end hour 24 (the
 * midnight ending the day) it stays on that day.
 */
export const getSlotStart = (
  date: Date,
  hours: number,
  minutes: number,
  slotMinutes: number,
  endHour: number,
) =>
  atMinutes(date, Math.min(hours * 60 + minutes, endHour * 60 - slotMinutes));

/** The first and the last day of the week `date` falls in. */
export const getWeekStartEnd = (
  date: Date,
  weekStartsOn: WeekDay,
): { start: Date; end: Date } => {
  // Counted from `date` - a first day the time zone skips starts later
  const offset = daysIntoWeek(date, weekStartsOn);
  return {
    start: addCalendarDays(date, -offset),
    end: addCalendarDays(date, 6 - offset),
  };
};

/**
 * What the agenda lists - one day is the `"day"`, anything else than a
 * period or a positive number of days the `"month"`.
 */
export function normalizeAgendaPeriod(
  period: CalendarAgendaPeriod | undefined,
): CalendarAgendaPeriod {
  if (typeof period === "number") {
    if (!Number.isFinite(period) || period < 1) return "month";
    return Math.floor(period) === 1 ? "day" : Math.floor(period);
  }
  return period === "day" || period === "week" ? period : "month";
}

export interface VisibleRangeOptions {
  /**
   * What the agenda view lists - pass the `agendaPeriod` of the calendar.
   * Default `"month"`.
   */
  agendaPeriod?: CalendarAgendaPeriod;
  /** IANA time zone of the calendar, e.g. `Europe/Prague`. */
  timeZone?: string;
}

/**
 * The days a view actually paints, as a half-open [start, end) interval:
 * a single day (the day and the timeline day views), a week (also of the
 * timeline), the six whole weeks `MonthView` lays out starting with the
 * week holding the 1st, or the period of the agenda (the month, week or day
 * of `date`, or a number of days from it). With `hiddenDays` the range
 * still has them - their events are not shown. Fetch exactly this
 * window, so moving to another period never pulls in events no tile can
 * show. Pass the `weekStartsOn` of the locale the calendar shows
 * (`useLocale()`), so the weeks match its columns, and the `agendaPeriod`
 * of the calendar.
 */
export const getVisibleRange = (
  date: Date,
  view: CalendarView,
  weekStartsOn: WeekDay,
  options?: VisibleRangeOptions,
): { start: Date; end: Date } => {
  if (options?.timeZone) date = inTimeZone(date, options.timeZone);
  if (view === "agenda") {
    const period = normalizeAgendaPeriod(options?.agendaPeriod);

    if (typeof period === "number") {
      const start = startOfDay(date);
      return { start, end: addCalendarDays(start, period) };
    }
    if (period !== "month") return getVisibleRange(date, period, weekStartsOn);

    // The month itself - no days of the weeks around it
    const start = dateOf(date.getFullYear(), date.getMonth(), 1, date);
    return {
      start,
      end: dateOf(date.getFullYear(), date.getMonth() + 1, 1, date),
    };
  }

  if (view === "day" || view === "timelineDay") {
    const start = startOfDay(date);
    return { start, end: addCalendarDays(start, 1) };
  }

  // Counted from `date` and the 1st - from a first day of the week the time
  // zone skips (see `getCalendarDay`) the range would end a day late
  if (view === "week" || view === "timelineWeek") {
    const offset = daysIntoWeek(date, weekStartsOn);
    return {
      start: addCalendarDays(date, -offset),
      end: addCalendarDays(date, 7 - offset),
    };
  }

  const firstOfMonth = dateOf(date.getFullYear(), date.getMonth(), 1, date);
  const leading = daysIntoWeek(firstOfMonth, weekStartsOn);
  return {
    start: addCalendarDays(firstOfMonth, -leading),
    end: addCalendarDays(firstOfMonth, 42 - leading),
  };
};

/**
 * The first day from `date` on (`direction` 1) or back (-1) that is not
 * among `hiddenDays` - `date` itself when it is not. All days hidden count
 * as none.
 */
export function skipHiddenDays(
  date: Date,
  hiddenDays: ReadonlySet<number>,
  direction: 1 | -1 = 1,
) {
  if (hiddenDays.size === 0 || hiddenDays.size >= 7) return date;

  let day = date;
  for (let step = 0; step < 7 && hiddenDays.has(day.getDay()); step++) {
    const next = shiftDay(day, direction);
    // The time of `date` stays - it is the date of the calendar
    day = copyDate(date);
    day.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  }
  return day;
}
