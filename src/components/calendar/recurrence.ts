import type { CalendarEvent, CalendarRecurrence } from "./types";
import type { WeekDay } from "../../i18n/types";
import { dateOf, existingDayOf, startOfDay } from "../../utils/date";
import {
  addCalendarDays,
  daysBetween,
  daysIntoWeek,
  getCalendarDay,
  startOfCalendarWeek,
} from "./date-utils";
import { getAllDayRange } from "./utils";

type Frequency = CalendarRecurrence["freq"];

const FREQUENCIES: readonly Frequency[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

/** A day of the week of a rule - `nth` picks one of them in the period. */
interface WeekdayRule {
  day: WeekDay;
  /** 1 the first, -1 the last such day of the month or year. */
  nth?: number;
}

/** A recurrence rule with its values checked and its defaults filled in. */
interface Rule {
  count?: number;
  freq: Frequency;
  interval: number;
  monthDays?: number[];
  months?: number[];
  setPos?: number[];
  /**
   * The last moment an occurrence may start - with `wholeDay` any time of
   * the day of `date`.
   */
  until?: { date: Date; wholeDay: boolean };
  weekStart: WeekDay;
  weekdays?: WeekdayRule[];
}

/**
 * How many periods (days, weeks, …) one rule may walk through - a rule that
 * no day matches (February 30) must not keep a render busy.
 */
const MAX_PERIODS = 100_000;

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const isWeekDay = (value: unknown): value is WeekDay =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;

const isInRange = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) &&
  (value as number) !== 0 &&
  (value as number) >= min &&
  (value as number) <= max;

const isLocalMidnight = (date: Date) =>
  startOfDay(date).getTime() === date.getTime();

// What `new Date("2026-09-24")` gives
const isUTCMidnight = (date: Date) => date.getTime() % 86_400_000 === 0;

/**
 * The calendar day of a date given without a time - a UTC midnight that is
 * not a local one (`new Date("2026-09-24")`) is its UTC day, like the dates
 * of all-day events.
 */
function calendarDay(date: Date) {
  return isUTCMidnight(date) && !isLocalMidnight(date)
    ? dateOf(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    : startOfDay(date);
}

/** A non-empty list of the valid values, or nothing. */
function validList<T>(values: unknown, isValid: (value: unknown) => boolean) {
  if (!Array.isArray(values)) return undefined;
  const valid = (values as unknown[]).filter(isValid) as T[];
  return valid.length > 0 ? valid : undefined;
}

/** A `CalendarRecurrence` of the app as a `Rule` - `null` when it has no `freq`. */
function ruleOf(recurrence: CalendarRecurrence): Rule | null {
  if (!FREQUENCIES.includes(recurrence.freq)) return null;

  const { byWeekday, count, interval, until } = recurrence;
  const weekdays = validList<WeekdayRule>(
    Array.isArray(byWeekday)
      ? byWeekday.map((entry) =>
          typeof entry === "object" && entry !== null
            ? { day: entry.day, nth: entry.nth }
            : { day: entry },
        )
      : undefined,
    (entry) => {
      const { day, nth } = entry as WeekdayRule;
      return isWeekDay(day) && (nth === undefined || isInRange(nth, -53, 53));
    },
  );

  let untilRule: Rule["until"];
  if (isValidDate(until)) {
    const wholeDay = isLocalMidnight(until) || isUTCMidnight(until);
    untilRule = { date: wholeDay ? calendarDay(until) : until, wholeDay };
  }

  return {
    // At least the event itself
    count:
      count === undefined ? undefined : Math.max(1, Math.floor(count) || 1),
    freq: recurrence.freq,
    interval:
      Number.isFinite(interval) && (interval as number) >= 1
        ? Math.floor(interval as number)
        : 1,
    monthDays: validList(recurrence.byMonthDay, (day) =>
      isInRange(day, -31, 31),
    ),
    months: validList(recurrence.byMonth, (month) => isInRange(month, 1, 12)),
    setPos: validList(recurrence.bySetPos, (position) =>
      isInRange(position, -366, 366),
    ),
    until: untilRule,
    weekStart: isWeekDay(recurrence.weekStart) ? recurrence.weekStart : 1,
    weekdays,
  };
}

const ICAL_WEEKDAYS: Record<string, WeekDay> = {
  FR: 5,
  MO: 1,
  SA: 6,
  SU: 0,
  TH: 4,
  TU: 2,
  WE: 3,
};

/** A list of integers of an `RRULE` part, or `null` when one is not. */
function integers(value: string, min: number, max: number) {
  const numbers = value.split(",").map((item) => Number(item.trim()));
  return numbers.every((number) => isInRange(number, min, max))
    ? numbers
    : null;
}

/**
 * The `UNTIL` of an `RRULE`: a date (`20261231` - the whole day) or a date
 * and time, in UTC with `Z` or on the local clock without.
 */
function parseUntil(value: string): Rule["until"] | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/i.exec(
    value.trim(),
  );
  if (!match) return null;

  const [, year, month, day, hours, minutes, seconds, utc] = match;
  const date = dateOf(Number(year), Number(month) - 1, Number(day));
  if (hours === undefined) return { date, wholeDay: true };

  if (utc) {
    date.setTime(0);
    date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    date.setUTCHours(Number(hours), Number(minutes), Number(seconds));
  } else {
    date.setHours(Number(hours), Number(minutes), Number(seconds));
  }

  return { date, wholeDay: false };
}

/**
 * Reads the subset of an iCalendar `RRULE` the calendar supports - see
 * `CalendarEvent.recurrence`. `null` for anything else, e.g. `BYHOUR`,
 * which would make occurrences the calendar cannot show.
 */
function parseRule(text: string): Rule | null {
  // "RRULE:FREQ=…" - possibly among other lines, like DTSTART
  const line =
    text
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => /^RRULE:/i.test(item)) ?? text.trim();
  const rule: Partial<Rule> = { interval: 1, weekStart: 1 };

  for (const part of line.replace(/^RRULE:/i, "").split(";")) {
    if (!part.trim()) continue;
    const [key, value = ""] = part.split("=");

    switch (key.trim().toUpperCase()) {
      case "FREQ": {
        const freq = value.trim().toLowerCase() as Frequency;
        if (!FREQUENCIES.includes(freq)) return null;
        rule.freq = freq;
        break;
      }
      case "INTERVAL":
      case "COUNT": {
        const [number] = integers(value, 1, Number.MAX_SAFE_INTEGER) ?? [];
        if (number === undefined) return null;
        if (key.trim().toUpperCase() === "COUNT") rule.count = number;
        else rule.interval = number;
        break;
      }
      case "UNTIL": {
        const until = parseUntil(value);
        if (!until) return null;
        rule.until = until;
        break;
      }
      case "BYDAY": {
        const weekdays: WeekdayRule[] = [];
        for (const item of value.split(",")) {
          const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(
            item.trim(),
          );
          const nth = match?.[1] === undefined ? undefined : Number(match[1]);
          if (!match || (nth !== undefined && !isInRange(nth, -53, 53))) {
            return null;
          }
          weekdays.push({ day: ICAL_WEEKDAYS[match[2].toUpperCase()], nth });
        }
        rule.weekdays = weekdays;
        break;
      }
      case "BYMONTHDAY": {
        const days = integers(value, -31, 31);
        if (!days) return null;
        rule.monthDays = days;
        break;
      }
      case "BYMONTH": {
        const months = integers(value, 1, 12);
        if (!months) return null;
        rule.months = months;
        break;
      }
      case "BYSETPOS": {
        const positions = integers(value, -366, 366);
        if (!positions) return null;
        rule.setPos = positions;
        break;
      }
      case "WKST": {
        const day = ICAL_WEEKDAYS[value.trim().toUpperCase()];
        if (day === undefined) return null;
        rule.weekStart = day;
        break;
      }
      default:
        // BYHOUR, BYMINUTE, BYSECOND, BYWEEKNO, BYYEARDAY, RSCALE, …
        return null;
    }
  }

  return rule.freq ? (rule as Rule) : null;
}

/** The rule of an event - `null` when it has none or one the calendar cannot read. */
function readRule(recurrence: unknown): Rule | null {
  if (typeof recurrence === "string") return parseRule(recurrence);
  if (typeof recurrence === "object" && recurrence !== null) {
    return ruleOf(recurrence as CalendarRecurrence);
  }
  return null;
}

const daysInMonth = (year: number, month: number) =>
  dateOf(year, month + 1, 0).getDate();

const byTime = (a: Date, b: Date) => a.getTime() - b.getTime();

/** The dates sorted, each once. */
function uniqueSorted(dates: Date[]) {
  return dates
    .sort(byTime)
    .filter(
      (date, index) =>
        index === 0 || date.getTime() !== dates[index - 1].getTime(),
    );
}

/**
 * Whether `date` is the `nth` of its weekday in its month or year - counted
 * from the end when negative.
 */
function isNthWeekday(date: Date, nth: number, scope: "month" | "year") {
  let index: number;
  let length: number;

  if (scope === "month") {
    index = date.getDate();
    length = daysInMonth(date.getFullYear(), date.getMonth());
  } else {
    const firstDay = dateOf(date.getFullYear(), 0, 1);
    index = daysBetween(firstDay, date) + 1;
    length = daysBetween(firstDay, dateOf(date.getFullYear() + 1, 0, 1));
  }

  return nth > 0
    ? Math.ceil(index / 7) === nth
    : Math.ceil((length - index + 1) / 7) === -nth;
}

const matchesWeekday = (
  date: Date,
  weekdays: WeekdayRule[],
  scope: "month" | "year",
) =>
  weekdays.some(
    ({ day, nth }) =>
      date.getDay() === day &&
      (nth === undefined || isNthWeekday(date, nth, scope)),
  );

/** The days of `year` - or of the month `month` of it - with the weekdays. */
function weekdayDates(
  weekdays: WeekdayRule[],
  year: number,
  month: number | null,
) {
  const scope = month === null ? "year" : "month";
  const months =
    month === null ? Array.from({ length: 12 }, (_, index) => index) : [month];
  const dates: Date[] = [];

  // Each day by its number - a day a daylight saving change starts at 1:00
  // does not move the days after it, and a day the time zone skips is none
  for (const monthIndex of months) {
    for (let day = 1; day <= daysInMonth(year, monthIndex); day++) {
      const date = existingDayOf(year, monthIndex, day);
      if (date && matchesWeekday(date, weekdays, scope)) dates.push(date);
    }
  }

  return dates;
}

/**
 * The days a month gives by `BYMONTHDAY` (limited by `BYDAY`), by `BYDAY`,
 * or the day of the month of the event - not in a month without it, nor
 * when the time zone skips it.
 */
function monthDates(rule: Rule, year: number, month: number, event: Date) {
  const length = daysInMonth(year, month);

  if (rule.monthDays) {
    const dates = rule.monthDays
      .map((day) => (day > 0 ? day : length + 1 + day))
      .filter((day) => day >= 1 && day <= length)
      .map((day) => existingDayOf(year, month, day))
      .filter((date) => date !== null);
    const { weekdays } = rule;
    return uniqueSorted(
      weekdays
        ? dates.filter((date) => matchesWeekday(date, weekdays, "month"))
        : dates,
    );
  }

  if (rule.weekdays) return weekdayDates(rule.weekdays, year, month);

  const date =
    event.getDate() <= length
      ? existingDayOf(year, month, event.getDate())
      : null;
  return date ? [date] : [];
}

/** The days of a year: by `BYMONTH`, `BYMONTHDAY`, `BYDAY` or the date of the event. */
function yearDates(rule: Rule, year: number, event: Date) {
  if (rule.months) {
    return uniqueSorted(
      [...rule.months].flatMap((month) =>
        monthDates(rule, year, month - 1, event),
      ),
    );
  }

  if (rule.monthDays) {
    return Array.from({ length: 12 }, (_, month) =>
      monthDates(rule, year, month, event),
    ).flat();
  }

  if (rule.weekdays) return weekdayDates(rule.weekdays, year, null);

  // February 29 only in leap years
  const date = existingDayOf(year, event.getMonth(), event.getDate());
  return date && date.getMonth() === event.getMonth() ? [date] : [];
}

/** The positions `BYSETPOS` picks from the days of a period. */
function pickPositions(dates: Date[], positions: number[]) {
  const indexes = new Set<number>();

  for (const position of positions) {
    const index = position > 0 ? position - 1 : dates.length + position;
    if (index >= 0 && index < dates.length) indexes.add(index);
  }

  return [...indexes].sort((a, b) => a - b).map((index) => dates[index]);
}

/** The first day of the `index`-th period of the rule since the event's. */
function periodStart(rule: Rule, event: Date, index: number) {
  const step = index * rule.interval;

  switch (rule.freq) {
    case "daily":
      return addCalendarDays(event, step);
    case "weekly":
      return addCalendarDays(
        event,
        step * 7 - daysIntoWeek(event, rule.weekStart),
      );
    case "monthly":
      return dateOf(event.getFullYear(), event.getMonth() + step, 1);
    default:
      return dateOf(event.getFullYear() + step, 0, 1);
  }
}

/** Whole periods of the rule from the event's to the one of `date`. */
function periodsBetween(rule: Rule, event: Date, date: Date) {
  switch (rule.freq) {
    case "daily":
      return daysBetween(event, date);
    case "weekly":
      return Math.floor(
        daysBetween(startOfCalendarWeek(event, rule.weekStart), date) / 7,
      );
    case "monthly":
      return (
        (date.getFullYear() - event.getFullYear()) * 12 +
        date.getMonth() -
        event.getMonth()
      );
    default:
      return date.getFullYear() - event.getFullYear();
  }
}

/**
 * The days the `index`-th period of the rule gives, in order - at local
 * midnights. `period` is its first day. Daily and weekly periods count their
 * days from the day of the event - a day the time zone skips gives none.
 */
function periodDates(rule: Rule, index: number, period: Date, event: Date) {
  const step = index * rule.interval;
  let dates: Date[];

  switch (rule.freq) {
    case "daily": {
      const day = getCalendarDay(event, step);
      dates = day ? [day] : [];
      const { monthDays, weekdays } = rule;
      // The day-of-month and weekday parts only limit a daily rule
      if (monthDays) {
        dates = dates.filter((date) => {
          const length = daysInMonth(date.getFullYear(), date.getMonth());
          return monthDays.some(
            (monthDay) =>
              (monthDay > 0 ? monthDay : length + 1 + monthDay) ===
              date.getDate(),
          );
        });
      }
      if (weekdays) {
        dates = dates.filter((date) =>
          weekdays.some(({ day }) => day === date.getDay()),
        );
      }
      break;
    }
    case "weekly": {
      const days = new Set(
        rule.weekdays?.map(({ day }) => day) ?? [event.getDay()],
      );
      const first = step * 7 - daysIntoWeek(event, rule.weekStart);
      dates = Array.from({ length: 7 }, (_, offset) =>
        getCalendarDay(event, first + offset),
      )
        .filter((date) => date !== null)
        .filter((date) => days.has(date.getDay() as WeekDay));
      break;
    }
    case "monthly":
      dates = monthDates(rule, period.getFullYear(), period.getMonth(), event);
      break;
    default:
      dates = yearDates(rule, period.getFullYear(), event);
  }

  const { months, setPos } = rule;
  if (months) {
    dates = dates.filter((date) => months.includes(date.getMonth() + 1));
  }

  return setPos ? pickPositions(dates, setPos) : dates;
}

/** `date` at the clock time of `time`. */
function atClockOf(date: Date, time: Date) {
  const result = new Date(date);
  // A time a daylight saving change skips moves on by the gap, like in
  // iCalendar
  result.setHours(
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  );
  return result;
}

/**
 * The occurrences of one recurring event overlapping `range`. `replaced` are
 * the starts of occurrences the app stored as events of their own.
 */
function expandEvent<T extends CalendarEvent>(
  event: T,
  range: { end: Date; start: Date },
  replaced: Date[] | undefined,
): T[] {
  const rule = readRule(event.recurrence);
  if (!rule || !isValidDate(event.start) || !isValidDate(event.end)) {
    return [event];
  }

  const allDay = !!event.allDay;
  // An all-day event goes by the days the views show it on - also of dates
  // of `YYYY-MM-DD` strings (UTC midnights); its occurrences start at local
  // midnights
  const { end: eventEnd, start: eventStart } = allDay
    ? getAllDayRange(event)
    : event;
  const firstDay = startOfDay(eventStart);
  const first = allDay ? firstDay : eventStart;
  // The days it shows on - the end is exclusive
  const days =
    eventEnd > eventStart
      ? daysBetween(firstDay, new Date(eventEnd.getTime() - 1)) + 1
      : 1;
  // Timed: the clock time of the end, `endDays` after the start's day
  const endDays = daysBetween(eventStart, eventEnd);
  const length = Math.max(0, eventEnd.getTime() - eventStart.getTime());

  const endOf = (start: Date) => {
    if (allDay) return addCalendarDays(start, days);
    // An occurrence ending at 10:00 ends at 10:00 also after a daylight
    // saving change - not at 9:00 or 11:00
    const end = atClockOf(addCalendarDays(start, endDays), eventEnd);
    return end >= start ? end : new Date(start.getTime() + length);
  };

  // The occurrences left out - an all-day event by their days
  const keyOf = (date: Date) =>
    allDay ? `d${calendarDay(date).getTime()}` : `t${date.getTime()}`;
  const excluded = new Set(
    [
      ...(Array.isArray(event.exdates) ? event.exdates : []),
      ...(replaced ?? []),
    ]
      .filter(isValidDate)
      .map(keyOf),
  );

  // Occurrences start before it (exclusive)
  const until = rule.until
    ? rule.until.wholeDay
      ? addCalendarDays(rule.until.date, 1).getTime()
      : rule.until.date.getTime() + 1
    : Infinity;

  const occurrences: T[] = [];
  const add = (start: Date) => {
    const end = endOf(start);
    // In the range - also an occurrence without a length at its start
    const overlaps =
      start < range.end && (end > range.start || start >= range.start);
    if (!overlaps || excluded.has(keyOf(start))) return;

    occurrences.push({
      ...event,
      end,
      id: `${event.id}@${start.toISOString()}`,
      occurrenceStart: start,
      recurringEventId: event.id,
      start,
    });
  };

  // The event itself is the first occurrence - also when its day does not
  // fit the rule, as in iCalendar
  add(first);
  let count = 1;

  // Without a count the periods long before the range need not be walked
  let period = 0;
  const earliest = addCalendarDays(range.start, -days - 1);
  if (rule.count === undefined && earliest > firstDay) {
    period = Math.max(
      0,
      Math.floor(periodsBetween(rule, firstDay, earliest) / rule.interval) - 1,
    );
  }

  for (const last = period + MAX_PERIODS; period < last; period++) {
    const periodDay = periodStart(rule, firstDay, period);
    if (periodDay >= range.end || periodDay.getTime() >= until) break;

    for (const day of periodDates(rule, period, periodDay, firstDay)) {
      const start = allDay ? day : atClockOf(day, eventStart);
      if (start <= first) continue;
      if (
        start.getTime() >= until ||
        start >= range.end ||
        (rule.count !== undefined && count >= rule.count)
      ) {
        return occurrences;
      }

      count++;
      add(start);
    }
  }

  return occurrences;
}

/**
 * Replaces each recurring event (with a `recurrence`) by its occurrences
 * overlapping `range` - a half-open interval, like the one of
 * `getCalendarVisibleRange`; the other events stay as they are. An
 * occurrence is the event with its own `start` and `end`, a unique `id`,
 * `recurringEventId` (the `id` of the event) and `occurrenceStart`. The
 * occurrences take the clock time of the event, also over a daylight saving
 * change, and all-day ones whole days; `exdates` and events of the app with
 * `recurringEventId` + `occurrenceStart` (edited occurrences) leave theirs
 * out. `Calendar` does this itself - use it to list occurrences elsewhere.
 */
export function expandRecurringEvents<T extends CalendarEvent>(
  events: T[],
  range: { end: Date; start: Date },
): T[] {
  // Occurrences the app keeps as events of their own - they replace the
  // occurrence of their series
  const replaced = new Map<string, Date[]>();
  for (const event of events) {
    if (
      typeof event.recurringEventId === "string" &&
      isValidDate(event.occurrenceStart)
    ) {
      replaced.set(event.recurringEventId, [
        ...(replaced.get(event.recurringEventId) ?? []),
        event.occurrenceStart,
      ]);
    }
  }

  return events.flatMap((event) =>
    // An occurrence (or an edited one) is not repeated again
    event.recurrence && event.recurringEventId === undefined
      ? expandEvent(event, range, replaced.get(event.id))
      : [event],
  );
}
