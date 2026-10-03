import { TZDateMini } from "@date-fns/tz";

/** Time zone carried by a calendar date; ordinary Dates use the host zone. */
export const dateTimeZone = (date?: Date) =>
  date instanceof TZDateMini ? date.timeZone : undefined;

/** The same instant in a named IANA time zone. Does not mutate the input. */
export const inTimeZone = (date: Date, timeZone?: string): Date =>
  timeZone ? new TZDateMini(date.getTime(), timeZone) : new Date(date);

/** Clone or replace an instant, retaining its calendar's time zone. */
export const copyDate = (date: Date, timestamp = date.getTime()): Date =>
  inTimeZone(new Date(timestamp), dateTimeZone(date));

/** Build a midnight in the zone of a reference date, including years 0–99. */
export function zonedDay(
  year: number,
  month: number,
  day: number,
  reference?: Date,
) {
  const zone = dateTimeZone(reference);
  const date: Date = zone
    ? new TZDateMini(2000, 0, 1, zone)
    : new Date(2000, 0, 1);
  date.setFullYear(year, month, day);
  return date;
}
