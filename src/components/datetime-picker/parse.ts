import {
  addDays,
  getISOWeek,
  getISOWeeksInYear,
  isValidDay,
  pad2,
  padYear,
  parseISODate,
  parsePattern,
  toISODate,
  type DayPeriods,
} from "../../utils/date";
import type { DateTimePickerType } from ".";

/** Splits `HH:mm` (optionally with seconds) into its parts. */
export const parseTime = (value: string | undefined) => {
  const match = value?.match(/^(\d{2}):(\d{2})/);
  return match ? { hours: match[1], minutes: match[2] } : null;
};

/** A time as `HH:mm`, without its seconds - `undefined` for anything else. */
export const normalizeTime = (value: string | undefined) => {
  const time = parseTime(value);
  return time ? `${time.hours}:${time.minutes}` : undefined;
};

/**
 * A date-time as `YYYY-MM-DDTHH:mm`, without its seconds. A date alone gets
 * the time `dayTime` - e.g. the first minute of the day for a `min`.
 */
export const normalizeDateTime = (
  value: string | undefined,
  dayTime: string,
) => {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  return match ? `${match[1]}T${match[2] ?? dayTime}` : undefined;
};

/**
 * `value` moved into [`min`, `max`]. Values of one fixed-width format, like
 * `HH:mm` or `YYYY-MM-DDTHH:mm`, compare as strings.
 */
export const clampValue = (value: string, min?: string, max?: string) => {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
};

/** Whether `value` lies in [`min`, `max`] - compared like in `clampValue`. */
export const isInRange = (value: string, min?: string, max?: string) =>
  clampValue(value, min, max) === value;

/**
 * Whether the time `time` (`HH:mm`) lies in [`min`, `max`]. A reversed range
 * - `min` after `max`, like 22:00 - 06:00 - spans midnight, as it does for
 * a native time input.
 */
export const isTimeInRange = (time: string, min?: string, max?: string) =>
  min && max && min > max
    ? time >= min || time <= max
    : isInRange(time, min, max);

/** The minutes the time lists offer for `step`: 15 - `00`, `15`, `30`, `45`. */
export const getMinuteOptions = (step: number) =>
  Array.from({ length: Math.ceil(60 / step) }, (_, index) =>
    pad2(index * step),
  );

/** Minutes since midnight of an `HH:mm` time. */
const minutesOfDay = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * The time the time lists offer nearest to `time` (`HH:mm`): with minutes of
 * the `step` and in [`min`, `max`] (see `isTimeInRange`) - so a clamped,
 * kept or typed time is one of the options. A time half way between two
 * goes to the later one. When no option lies in the range, `time` moved
 * into the range. The nearest time of the same day - it never goes over
 * midnight, `23:58` with a step of 5 is `23:55` (not `00:00`, which would
 * be another day); `snapDateTime` goes on to the next day.
 */
export function snapTime(
  time: string,
  step: number,
  min?: string,
  max?: string,
) {
  const target = minutesOfDay(time);
  const minuteOptions = getMinuteOptions(step);
  let nearest: string | null = null;
  let nearestDistance = Infinity;

  // Over the times of the day in their order - on a tie the later one wins
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of minuteOptions) {
      const option = `${pad2(hour)}:${minute}`;
      if (!isTimeInRange(option, min, max)) continue;

      const distance = Math.abs(minutesOfDay(option) - target);
      if (distance <= nearestDistance) {
        nearest = option;
        nearestDistance = distance;
      }
    }
  }

  return nearest ?? clampValue(time, min, max);
}

/**
 * `snapTime` for the time of a date-time (`YYYY-MM-DDTHH:mm`) - the time
 * part of `min` / `max` applies on their own day only. Unlike a time alone
 * it may go on to the midnight of the next day when that is nearer
 * (`2026-09-24T23:58` with a step of 5 is `2026-09-25T00:00`) and not
 * after `max`.
 */
export function snapDateTime(
  value: string,
  step: number,
  min?: string,
  max?: string,
) {
  const day = value.slice(0, 10);
  const time = value.slice(11, 16);
  const timeLimit = (limit: string | undefined) =>
    limit?.startsWith(day) ? limit.slice(11, 16) : undefined;

  const snapped = `${day}T${snapTime(time, step, timeLimit(min), timeLimit(max))}`;

  // The midnight ending the day - a tie goes to the later one, like above
  const date = parseISODate(day);
  if (!date) return snapped;
  const midnight = `${toISODate(addDays(date, 1))}T00:00`;
  const distance = Math.abs(
    minutesOfDay(snapped.slice(11)) - minutesOfDay(time),
  );

  return 1440 - minutesOfDay(time) <= distance && isInRange(midnight, min, max)
    ? midnight
    : snapped;
}

const isTime = (hours: number, minutes: number) =>
  hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;

/**
 * The value - in the format of the native input - of a text typed in the
 * display `pattern` of the locale, e.g. `2026-09-24` for `24.9.2026`.
 * `dayPeriods` are the AM / PM of the locale. A year left out is the one of
 * `today` (of its ISO week for a week), two digits one of the 80 years
 * before it and the 19 after it: `24.9.` and `24.9.26` are `2026-09-24` in
 * 2026, `3.7.85` is `1985-07-03`. `null` when the text is no real date or
 * time (`31.02.2026`).
 */
export function parseDisplayValue(
  text: string,
  pattern: string,
  type: DateTimePickerType,
  dayPeriods?: DayPeriods,
  today = new Date(),
): string | null {
  const parts = parsePattern(text, pattern, dayPeriods, today.getFullYear());
  if (!parts) return null;

  const { day, hours = 0, minutes = 0, month, week } = parts;
  const time = `${pad2(hours)}:${pad2(minutes)}`;

  if (type === "time") {
    return isTime(hours, minutes) ? time : null;
  }

  const year =
    parts.year ??
    (type === "week" ? getISOWeek(today).year : today.getFullYear());

  switch (type) {
    case "month":
      return month !== undefined && month >= 1 && month <= 12
        ? `${padYear(year)}-${pad2(month)}`
        : null;
    case "week":
      return week !== undefined && week >= 1 && week <= getISOWeeksInYear(year)
        ? `${padYear(year)}-W${pad2(week)}`
        : null;
    default: {
      if (month === undefined || day === undefined) return null;
      if (!isValidDay(year, month, day)) return null;

      const date = `${padYear(year)}-${pad2(month)}-${pad2(day)}`;
      if (type === "date") return date;
      return isTime(hours, minutes) ? `${date}T${time}` : null;
    }
  }
}

/**
 * The first and the last day - `YYYY-MM-DD`, in order - of a range typed in
 * the date `pattern` of the locale: `24.9.2026 – 30.9.2026`, with anything
 * that is no digit between the two days (a dash, `-`, `~`, `..`, a word or
 * just a space), or as digits only (`2409202630092026`). The days are read
 * as forgivingly as by `parseDisplayValue` - also with the year left out or
 * of two digits (`24.9. – 30.9.`, the year of `today`); a reversed pair is
 * swapped, and one day alone (`24.9.2026 –`) is a range of that day. `null`
 * when the text is no range of real days.
 */
export function parseDisplayRange(
  text: string,
  pattern: string,
  today = new Date(),
): { end: string; start: string } | null {
  // A dash typed after the first day without the second one is left out
  // - digits start and end the days of a date pattern
  const typed = text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const parseDay = (part: string) =>
    parseDisplayValue(part, pattern, "date", undefined, today);

  const single = parseDay(typed);
  if (single) return { end: single, start: single };

  // The first place the text splits at into two days - what stands between
  // them left out. Short texts, so trying every place costs nothing.
  for (let index = 1; index < typed.length; index++) {
    const start = parseDay(typed.slice(0, index).replace(/\D+$/, ""));
    if (!start) continue;

    const end = parseDay(typed.slice(index).replace(/^\D+/, ""));
    if (end) return start <= end ? { end, start } : { end: start, start: end };
  }

  return null;
}
