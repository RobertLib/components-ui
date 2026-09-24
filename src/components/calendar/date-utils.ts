import type { CalendarAgendaPeriod, CalendarView } from "./types";
import type { WeekDay } from "../../i18n/types";
import { dateOf, existingDayOf, startOfDay } from "../../utils/date";

export { isSameDay } from "../../utils/date";

/**
 * The start of the day `days` days after the day of `date` - whatever the
 * time of `date`. Unlike `addDays`, which keeps the time, it steps from day
 * to day: where a daylight saving change skips a midnight (Havana,
 * Santiago, Beirut, Cairo, the Azores) that day starts at 1:00, and the
 * days after it start at midnight again.
 */
export const addCalendarDays = (date: Date, days: number) =>
  dateOf(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * The start of the day `days` days after the day of `date`, like
 * `addCalendarDays` - `null` for a day the time zone skips as a whole
 * (Samoa went from December 29 to 31 in 2011), which a view leaves out.
 */
export const getCalendarDay = (date: Date, days: number) =>
  existingDayOf(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Days from the first day of the week `date` falls in to its day. */
export const daysIntoWeek = (date: Date, weekStartsOn: WeekDay) =>
  (date.getDay() - weekStartsOn + 7) % 7;

/** The start of the first day of the week `date` falls in. */
export const startOfCalendarWeek = (date: Date, weekStartsOn: WeekDay) =>
  addCalendarDays(date, -daysIntoWeek(date, weekStartsOn));

/** Whole days from the day of `from` to the day of `to`. */
export const daysBetween = (from: Date, to: Date) =>
  // Rounded - a day with a daylight saving change is not 24 hours long
  Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );

/**
 * The clock time `minutes` after the midnight starting the day of `date` -
 * 1440 is the midnight ending it. A time a daylight saving change skips
 * (2:30 when the clocks jump from 2:00 to 3:00) is the end of the gap
 * (3:00), so later times never come out earlier.
 */
export function atMinutes(date: Date, minutes: number) {
  const day = startOfDay(date);
  const result = new Date(day);
  result.setMinutes(minutes);

  // In a gap `Date` moves on by its length - step back to its end
  while (
    minutesIntoDay(day, result) > minutes &&
    minutesIntoDay(day, new Date(result.getTime() - 60_000)) >= minutes
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
  new Date(Math.max(min.getTime(), Math.min(date.getTime(), max.getTime())));

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
}

/**
 * The days a view actually paints, as a half-open [start, end) interval:
 * a single day, a week, the six whole weeks `MonthView` lays out starting
 * with the week holding the 1st, or the period of the agenda (the month,
 * week or day of `date`, or a number of days from it). Fetch exactly this
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
  if (view === "agenda") {
    const period = normalizeAgendaPeriod(options?.agendaPeriod);

    if (typeof period === "number") {
      const start = startOfDay(date);
      return { start, end: addCalendarDays(start, period) };
    }
    if (period !== "month") return getVisibleRange(date, period, weekStartsOn);

    // The month itself - no days of the weeks around it
    const start = dateOf(date.getFullYear(), date.getMonth(), 1);
    return { start, end: dateOf(date.getFullYear(), date.getMonth() + 1, 1) };
  }

  if (view === "day") {
    const start = startOfDay(date);
    return { start, end: addCalendarDays(start, 1) };
  }

  // Counted from `date` and the 1st - from a first day of the week the time
  // zone skips (see `getCalendarDay`) the range would end a day late
  if (view === "week") {
    const offset = daysIntoWeek(date, weekStartsOn);
    return {
      start: addCalendarDays(date, -offset),
      end: addCalendarDays(date, 7 - offset),
    };
  }

  const firstOfMonth = dateOf(date.getFullYear(), date.getMonth(), 1);
  const leading = daysIntoWeek(firstOfMonth, weekStartsOn);
  return {
    start: addCalendarDays(firstOfMonth, -leading),
    end: addCalendarDays(firstOfMonth, 42 - leading),
  };
};
