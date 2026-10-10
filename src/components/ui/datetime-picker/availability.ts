import {
  dateOf,
  daysInMonth,
  existingDayOf,
  parseISODate,
  shiftDay,
} from "../../../utils/date";
import type { DateTimePickerType } from ".";

/**
 * Tells the days that cannot be picked - `isDateDisabled` of the pickers
 * and calendars. Called with the local midnight of a day - 1:00 of a day
 * whose midnight a clock change skips.
 */
export type DateDisabledPredicate = (date: Date) => boolean;

// The most days checked one by one - a range of a century. The days of a
// longer one (typed by mistake) are checked no further.
const MAX_CHECKED_DAYS = 36_600;

/** Whether every day of the month (1 - 12) of `year` is disabled. */
export function isMonthUnavailable(
  year: number,
  month: number,
  isDateDisabled: DateDisabledPredicate,
) {
  const days = daysInMonth(year, month - 1);
  for (let day = 1; day <= days; day++) {
    // Not a day the time zone skipped - `dateOf` takes it for the next one,
    // of the next month at its end (Kiritimati, December 31, 1994)
    const date = existingDayOf(year, month - 1, day);
    if (date && !isDateDisabled(date)) return false;
  }
  return true;
}

/** The start of Monday of the ISO week `week` of `year`. */
export function isoWeekStart(year: number, week: number) {
  // January 4th always lies in the first week
  const january4 = dateOf(year, 0, 4);
  return dateOf(year, 0, 4 - ((january4.getDay() + 6) % 7) + (week - 1) * 7);
}

/** Whether every day of the week starting on `monday` is disabled. */
export function isWeekUnavailable(
  monday: Date,
  isDateDisabled: DateDisabledPredicate,
) {
  for (let day = 0; day < 7; day++) {
    // Each day from its own start - a clock change may skip the midnight
    // of one, not of the days after it - and none the time zone skipped
    const date = existingDayOf(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + day,
      monday,
    );
    if (date && !isDateDisabled(date)) return false;
  }
  return true;
}

/**
 * The first disabled day from `start` to `end`, both included, going
 * forward - `null` when there is none.
 */
export function findDisabledDay(
  start: Date,
  end: Date,
  isDateDisabled: DateDisabledPredicate,
) {
  let day = start;
  for (let count = 0; day <= end && count < MAX_CHECKED_DAYS; count++) {
    if (isDateDisabled(day)) return day;
    day = shiftDay(day, 1);
  }
  return null;
}

/**
 * The nearest day to `from` that can be picked - not disabled and in
 * [`min`, `max`] - looking a year ahead first, then a year back. `from`
 * itself when there is none.
 */
export function findEnabledDay(
  from: Date,
  isDateDisabled: DateDisabledPredicate | undefined,
  min?: Date | null,
  max?: Date | null,
) {
  const isAllowed = (day: Date) =>
    (!min || day >= min) && (!max || day <= max) && !isDateDisabled?.(day);
  if (isAllowed(from)) return from;

  for (const direction of [1, -1] as const) {
    let day = from;
    for (let count = 0; count < 366; count++) {
      day = shiftDay(day, direction);
      if (
        (direction > 0 && max && day > max) ||
        (direction < 0 && min && day < min)
      ) {
        break;
      }
      if (isAllowed(day)) return day;
    }
  }
  return from;
}

/**
 * Whether `isDateDisabled` leaves nothing of a value of a picker of `type`
 * that can be picked: its day (also of a date-time), or every day of its
 * month or week. `false` for a time, and for no value.
 */
export function isValueUnavailable(
  value: string,
  type: DateTimePickerType,
  isDateDisabled: DateDisabledPredicate | undefined,
) {
  if (!isDateDisabled || !value) return false;

  switch (type) {
    case "date":
    case "datetime-local": {
      const day = parseISODate(value);
      return !!day && isDateDisabled(day);
    }
    case "month": {
      const month = /^(\d{4})-(\d{2})$/.exec(value);
      return (
        !!month &&
        isMonthUnavailable(Number(month[1]), Number(month[2]), isDateDisabled)
      );
    }
    case "week": {
      const week = /^(\d{4})-W(\d{2})$/.exec(value);
      return (
        !!week &&
        isWeekUnavailable(
          isoWeekStart(Number(week[1]), Number(week[2])),
          isDateDisabled,
        )
      );
    }
    default:
      return false;
  }
}
