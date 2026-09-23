import type { CalendarView } from "./types";
import type { WeekDay } from "../../i18n/types";
import { addDays, startOfDay, startOfWeek } from "../../utils/date";

export { isSameDay } from "../../utils/date";

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
 * row of the end hour 24 is the midnight ending the day - it stands for the
 * last slot, so a click or drag there stays on that day.
 */
export const getSlotStart = (
  date: Date,
  hours: number,
  minutes: number,
  slotMinutes: number,
) => atMinutes(date, Math.min(hours * 60 + minutes, 1440 - slotMinutes));

/** The first and the last day of the week `date` falls in. */
export const getWeekStartEnd = (
  date: Date,
  weekStartsOn: WeekDay,
): { start: Date; end: Date } => {
  const start = startOfWeek(date, weekStartsOn);
  return { start, end: addDays(start, 6) };
};

/**
 * The days a view actually paints, as a half-open [start, end) interval:
 * a single day, a week, or - for the month view - the six whole weeks
 * `MonthView` lays out starting with the week holding the 1st. Fetch
 * exactly this window, so moving to another period never pulls in events
 * no tile can show. Pass the `weekStartsOn` of the locale the calendar
 * shows (`useLocale()`), so the weeks match its columns.
 */
export const getVisibleRange = (
  date: Date,
  view: CalendarView,
  weekStartsOn: WeekDay,
): { start: Date; end: Date } => {
  if (view === "day") {
    const start = startOfDay(date);
    return { start, end: addDays(start, 1) };
  }

  if (view === "week") {
    const start = startOfWeek(date, weekStartsOn);
    return { start, end: addDays(start, 7) };
  }

  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(firstOfMonth, weekStartsOn);
  return { start, end: addDays(start, 42) };
};
