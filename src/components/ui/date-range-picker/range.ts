import type { DayRange } from "../datetime-picker/day-grid";
import type { WeekDay } from "../../../i18n/ui/types";
import { formatMessage } from "../../../i18n/ui/format";
import {
  dateOf,
  formatDate,
  isSameDay,
  parseISODate,
  shiftDay,
  toISODate,
} from "../../../utils/date";
import {
  findDisabledDay,
  type DateDisabledPredicate,
} from "../datetime-picker/availability";
import type { DateRange, DateRangePresetKey } from ".";

/** What stands between the two days of a range in the field. */
export const RANGE_SEPARATOR = " – ";

/** The presets of `presets={true}`. */
export const DEFAULT_PRESETS: DateRangePresetKey[] = [
  "today",
  "yesterday",
  "last7Days",
  "last30Days",
  "thisMonth",
  "lastMonth",
];

/** A whole number of days, at least 1 - `undefined` for no limit. */
export const toDayLimit = (days: number | undefined) =>
  days === undefined || !Number.isFinite(days)
    ? undefined
    : Math.max(1, Math.round(days));

/** What limits the ranges that can be picked. */
export interface RangeLimits {
  /**
   * A range may have days of `isDateDisabled` between its first and its
   * last day.
   */
  allowDisabledInRange?: boolean;
  /** Days that cannot be picked - nor lie in a range, see above. */
  isDateDisabled?: DateDisabledPredicate;
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

/**
 * Whether a range can be typed - inside [`min`, `max`], of an allowed
 * length. One over a disabled day is taken, and made invalid (see
 * `findUnavailableDay`).
 */
export const isAllowedRange = (range: DayRange, limits: RangeLimits) =>
  isDayAllowed(range.start, limits) &&
  isDayAllowed(range.end, limits) &&
  hasAllowedLength(range, limits);

/**
 * The first day of `isDateDisabled` that keeps a range from being picked:
 * one of its ends, or - unless `allowDisabledInRange` - any day of it.
 * `null` when there is none.
 */
export function findUnavailableDay(
  { end, start }: DayRange,
  { allowDisabledInRange, isDateDisabled }: RangeLimits,
) {
  if (!isDateDisabled) return null;
  if (!allowDisabledInRange) return findDisabledDay(start, end, isDateDisabled);
  if (isDateDisabled(start)) return start;
  return isDateDisabled(end) ? end : null;
}

/**
 * `range` without the disabled days at its ends - its first and last day
 * that can be picked. `null` when it has none.
 */
export function trimDisabledEnds(
  range: DayRange,
  isDateDisabled: DateDisabledPredicate | undefined,
): DayRange | null {
  if (!isDateDisabled) return range;

  const start = findDisabledDay(
    range.start,
    range.end,
    (day) => !isDateDisabled(day),
  );
  if (!start) return null;
  let end = range.end;
  while (end > start && isDateDisabled(end)) end = shiftDay(end, -1);
  return { end, start };
}

// How far from the first day picked the days are looked through for one
// that blocks the range - ten years
const MAX_BLOCKER_DISTANCE = 3660;

/**
 * The nearest days of `isDateDisabled` before and after `anchor` - a range
 * starting at `anchor` cannot reach over them unless `allowDisabledInRange`.
 * Looked for as far as a range may reach: `minDays` / `maxDays`, `min` /
 * `max`, or ten years. `null` for no limit on that side.
 */
export function findBlockingDays(anchor: Date, limits: RangeLimits) {
  const { allowDisabledInRange, isDateDisabled, max, maxDays, min } = limits;
  if (!isDateDisabled || allowDisabledInRange) {
    return { after: null, before: null };
  }

  const distance = Math.min(maxDays ?? Infinity, MAX_BLOCKER_DISTANCE);
  const find = (direction: 1 | -1) => {
    let day = anchor;
    for (let step = 1; step < distance; step++) {
      day = shiftDay(day, direction);
      if (
        (direction > 0 && max && day > max) ||
        (direction < 0 && min && day < min)
      ) {
        return null;
      }
      if (isDateDisabled(day)) return day;
    }
    return null;
  };

  return { after: find(1), before: find(-1) };
}

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

/** The form validity message for a range outside its allowed day counts. */
export const getRangeLengthMessage = (
  range: DayRange | null,
  limits: RangeLimits,
  pattern: string,
  outOfRangeText: string,
) =>
  range && !hasAllowedLength(range, limits)
    ? formatMessage(outOfRangeText, { text: formatRange(range, pattern) })
    : "";

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
  const intoWeek = (today.getDay() - weekStartsOn + 7) % 7;
  // Derive each week's boundary from its calendar day. A week starting on
  // a day whose midnight is skipped starts at 1:00, but still ends at the
  // midnight of its own last day.
  const weekDay = (offset: number) =>
    dateOf(year, month, today.getDate() - intoWeek + offset);

  switch (key) {
    case "today":
      return { end: today, start: today };
    case "yesterday": {
      const yesterday = shiftDay(today, -1);
      return { end: yesterday, start: yesterday };
    }
    case "last7Days":
      return { end: today, start: shiftDay(today, -6) };
    case "last30Days":
      return { end: today, start: shiftDay(today, -29) };
    case "thisWeek":
      return { end: weekDay(6), start: weekDay(0) };
    case "lastWeek":
      return { end: weekDay(-1), start: weekDay(-7) };
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
