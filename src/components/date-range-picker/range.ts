import type { DayRange } from "../datetime-picker/day-grid";
import type { WeekDay } from "../../i18n/types";
import {
  addDays,
  dateOf,
  formatDate,
  isSameDay,
  parseISODate,
  startOfWeek,
  toISODate,
} from "../../utils/date";
import type { DateRange, DateRangePresetKey } from ".";

/** What stands between the two days of a range in the field. */
export const RANGE_SEPARATOR = " – ";

/** What limits the ranges that can be picked. */
export interface RangeLimits {
  /** The latest day. */
  max: Date | null;
  /** The most days of a range. */
  maxDays?: number;
  /** The earliest day. */
  min: Date | null;
  /** The fewest days of a range. */
  minDays?: number;
}

/**
 * A range as one string - `2026-09-24/2026-09-30`, the ISO 8601 interval -
 * or `""` without a range. The value of the field and of its `name` input.
 */
export const encodeRange = (range: DateRange | null | undefined) =>
  range?.start && range.end ? `${range.start}/${range.end}` : "";

/** The range of `encodeRange` - `null` for `""`. */
export function decodeRange(value: string): DateRange | null {
  const [start = "", end = ""] = value.split("/");
  return start && end ? { end, start } : null;
}

/** Two days as a range, in order. */
export const orderDays = (a: Date, b: Date): DayRange =>
  a <= b ? { end: b, start: a } : { end: a, start: b };

/** The days of a range, in order - `null` for none or one of no real days. */
export function toDayRange(range: DateRange | null | undefined) {
  const start = parseISODate(range?.start);
  const end = parseISODate(range?.end);
  return start && end ? orderDays(start, end) : null;
}

/** The value of a range of days. */
export const toDateRange = ({ end, start }: DayRange): DateRange => ({
  end: toISODate(end),
  start: toISODate(start),
});

/** How many days a range has - both ends count, a week has 7. */
export const countDays = ({ end, start }: DayRange) =>
  // Rounded - a day is 23 or 25 hours long when the clocks change
  Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

/** Whether `day` lies in [`min`, `max`]. */
export const isDayAllowed = (day: Date, { max, min }: RangeLimits) =>
  (!min || day >= min) && (!max || day <= max);

/** Whether a range has as many days as `minDays` / `maxDays` allow. */
export function hasAllowedLength(range: DayRange, limits: RangeLimits) {
  const days = countDays(range);
  return days >= (limits.minDays ?? 1) && days <= (limits.maxDays ?? Infinity);
}

/** Whether a range can be picked - inside [`min`, `max`], of an allowed length. */
export const isAllowedRange = (range: DayRange, limits: RangeLimits) =>
  isDayAllowed(range.start, limits) &&
  isDayAllowed(range.end, limits) &&
  hasAllowedLength(range, limits);

/** `range` cut to [`min`, `max`] - `null` when nothing of it is left. */
export function clampRange(
  range: DayRange,
  { max, min }: RangeLimits,
): DayRange | null {
  const start = min && range.start < min ? min : range.start;
  const end = max && range.end > max ? max : range.end;
  return start <= end ? { end, start } : null;
}

export const isSameRange = (a: DayRange, b: DayRange) =>
  isSameDay(a.start, b.start) && isSameDay(a.end, b.end);

/** A range as the field shows it: `24.09.2026 – 30.09.2026`. */
export const formatRange = ({ end, start }: DayRange, pattern: string) =>
  `${formatDate(start, pattern)}${RANGE_SEPARATOR}${formatDate(end, pattern)}`;

/**
 * The days of a built-in preset, counted from `today`: the "last" days end
 * with today, a week starts on `weekStartsOn`, and "this" week, month and
 * year are whole - a `max` of today cuts them to the days so far.
 */
export function getPresetRange(
  key: DateRangePresetKey,
  today: Date,
  weekStartsOn: WeekDay,
): DayRange {
  const year = today.getFullYear();
  const month = today.getMonth();
  const weekStart = startOfWeek(today, weekStartsOn);

  switch (key) {
    case "today":
      return { end: today, start: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { end: yesterday, start: yesterday };
    }
    case "last7Days":
      return { end: today, start: addDays(today, -6) };
    case "last30Days":
      return { end: today, start: addDays(today, -29) };
    case "thisWeek":
      return { end: addDays(weekStart, 6), start: weekStart };
    case "lastWeek":
      return { end: addDays(weekStart, -1), start: addDays(weekStart, -7) };
    case "thisMonth":
      return { end: dateOf(year, month + 1, 0), start: dateOf(year, month, 1) };
    case "lastMonth":
      return { end: dateOf(year, month, 0), start: dateOf(year, month - 1, 1) };
    case "thisYear":
      return { end: dateOf(year, 11, 31), start: dateOf(year, 0, 1) };
    case "lastYear":
      return { end: dateOf(year - 1, 11, 31), start: dateOf(year - 1, 0, 1) };
  }
}
