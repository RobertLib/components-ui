import type { CalendarBusinessHours } from "./types";

/** A part of a day in clock minutes since its midnight - `to` exclusive. */
export interface MinuteRange {
  from: number;
  to: number;
}

/**
 * The working hours of each weekday (`Date#getDay()`), in clock minutes -
 * sorted, and joined where they touch or overlap.
 */
export type BusinessSchedule = ReadonlyMap<number, readonly MinuteRange[]>;

/** What `businessHours: true` stands for - 9:00 to 17:00, Monday to Friday. */
const DEFAULT_HOURS: CalendarBusinessHours = { end: "17:00", start: "09:00" };

const WORK_WEEK = [1, 2, 3, 4, 5];

/** Minutes since midnight of `"HH:mm"` - `null` for anything else. */
function parseTime(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) {
    return null;
  }
  return hours * 60 + minutes;
}

/** `ranges` sorted, the touching and overlapping ones joined. */
function joinRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const joined: MinuteRange[] = [];

  for (const range of sorted) {
    const last = joined[joined.length - 1];
    if (last && range.from <= last.to) {
      last.to = Math.max(last.to, range.to);
    } else {
      joined.push({ ...range });
    }
  }
  return joined;
}

/**
 * The `businessHours` of the calendar by weekday - `null` without them.
 * `true` is 9:00 - 17:00 on Monday to Friday. Hours that cannot be read
 * (not `"HH:mm"`, an end before the start) are left out - `invalid` lists
 * them.
 */
export function normalizeBusinessHours(
  value: boolean | CalendarBusinessHours | CalendarBusinessHours[] | undefined,
): { invalid: CalendarBusinessHours[]; schedule: BusinessSchedule | null } {
  if (!value) return { invalid: [], schedule: null };

  const entries =
    value === true ? [DEFAULT_HOURS] : Array.isArray(value) ? value : [value];
  const byDay = new Map<number, MinuteRange[]>();
  const invalid: CalendarBusinessHours[] = [];

  for (const entry of entries) {
    const from = parseTime(entry.start);
    const to = parseTime(entry.end);
    if (from === null || to === null || to <= from) {
      invalid.push(entry);
      continue;
    }

    for (const day of entry.days ?? WORK_WEEK) {
      byDay.set(day, [...(byDay.get(day) ?? []), { from, to }]);
    }
  }

  const schedule = new Map<number, MinuteRange[]>();
  for (const [day, ranges] of byDay) schedule.set(day, joinRanges(ranges));
  return { invalid, schedule };
}

/** The working hours of the weekday of `day`. */
export const getBusinessRanges = (
  schedule: BusinessSchedule,
  day: Date,
): readonly MinuteRange[] => schedule.get(day.getDay()) ?? [];

/** Whether `day` has working hours at all. */
export const hasBusinessHours = (schedule: BusinessSchedule, day: Date) =>
  getBusinessRanges(schedule, day).length > 0;

/**
 * Whether the time from `from` to `to` (clock minutes of `day`) lies wholly
 * in the working hours of the day.
 */
export const isBusinessTime = (
  schedule: BusinessSchedule,
  day: Date,
  from: number,
  to: number,
) =>
  getBusinessRanges(schedule, day).some(
    (range) => range.from <= from && to <= range.to,
  );

/**
 * The parts of `from` - `to` (clock minutes of `day`) out of its working
 * hours - what the views shade.
 */
export function getOffHours(
  schedule: BusinessSchedule,
  day: Date,
  from: number,
  to: number,
): MinuteRange[] {
  const result: MinuteRange[] = [];
  let cursor = from;

  for (const range of getBusinessRanges(schedule, day)) {
    if (range.to <= cursor) continue;
    if (range.from >= to) break;
    if (range.from > cursor) result.push({ from: cursor, to: range.from });
    cursor = Math.max(cursor, range.to);
  }
  if (cursor < to) result.push({ from: cursor, to });

  return result;
}
