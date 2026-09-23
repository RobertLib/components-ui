import {
  getISOWeeksInYear,
  isValidDay,
  pad2,
  parsePattern,
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

const isTime = (hours: number, minutes: number) =>
  hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;

const isoYear = (year: number) => String(year).padStart(4, "0");

/**
 * The value - in the format of the native input - of a text typed in the
 * display `pattern` of the locale, e.g. `2026-09-24` for `24.9.2026`.
 * `null` when the text is no real date or time (`31.02.2026`).
 */
export function parseDisplayValue(
  text: string,
  pattern: string,
  type: DateTimePickerType,
): string | null {
  const parts = parsePattern(text, pattern);
  if (!parts) return null;

  const { day, hours = 0, minutes = 0, month, week, year } = parts;
  const time = `${pad2(hours)}:${pad2(minutes)}`;

  if (type === "time") {
    return isTime(hours, minutes) ? time : null;
  }

  if (year === undefined) return null;

  switch (type) {
    case "month":
      return month !== undefined && month >= 1 && month <= 12
        ? `${isoYear(year)}-${pad2(month)}`
        : null;
    case "week":
      return week !== undefined && week >= 1 && week <= getISOWeeksInYear(year)
        ? `${isoYear(year)}-W${pad2(week)}`
        : null;
    default: {
      if (month === undefined || day === undefined) return null;
      if (!isValidDay(year, month, day)) return null;

      const date = `${isoYear(year)}-${pad2(month)}-${pad2(day)}`;
      if (type === "date") return date;
      return isTime(hours, minutes) ? `${date}T${time}` : null;
    }
  }
}
