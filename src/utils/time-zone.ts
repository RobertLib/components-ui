// Native Intl supplies IANA zone rules; no bundled time-zone database is needed.
const formats = new Map<string, Intl.DateTimeFormat>();

function zoneFormat(timeZone: string) {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      hourCycle: "h23",
      era: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    // Bound the cache when an application accepts arbitrary zone names.
    if (formats.size >= 100) formats.delete(formats.keys().next().value!);
    formats.set(timeZone, format);
  }
  return format;
}

/** Encode wall-clock fields as UTC, keeping years 0–99 and subsecond precision. */
function wallTime(timestamp: number, timeZone: string) {
  if (!Number.isFinite(timestamp)) return NaN;
  const parts = Object.fromEntries(
    zoneFormat(timeZone)
      .formatToParts(timestamp)
      .map(({ type, value }) => [type, value]),
  );
  const wall = new Date(0);
  wall.setUTCFullYear(
    parts.era === "BC" ? 1 - Number(parts.year) : Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );
  wall.setUTCHours(
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    new Date(timestamp).getUTCMilliseconds(),
  );
  return wall.getTime();
}

/** Date-compatible disambiguation: earlier repeated time, forward through a gap. */
function instantAt(wall: number, timeZone: string) {
  if (!Number.isFinite(wall)) return NaN;
  const offsets = new Set<number>();
  for (const days of [-2, -1, 0, 1, 2]) {
    const sample = wall + days * 86_400_000;
    offsets.add(wallTime(sample, timeZone) - sample);
  }
  const candidates = [...offsets].map((offset) => {
    const instant = wall - offset;
    return { instant, wall: wallTime(instant, timeZone) };
  });
  const exact = candidates.filter((candidate) => candidate.wall === wall);
  if (exact.length)
    return Math.min(...exact.map((candidate) => candidate.instant));
  const after = candidates
    .filter((candidate) => candidate.wall > wall)
    .sort((a, b) => a.wall - b.wall || a.instant - b.instant);
  return after[0]?.instant ?? NaN;
}

/** Internal Date carrying a zone; UTC methods and serialization retain the instant. */
class CalendarDate extends Date {
  readonly timeZone: string;
  private cachedTime = NaN;
  private cachedWall = new Date(NaN);

  constructor(timestamp: number, timeZone: string) {
    super(timestamp);
    zoneFormat(timeZone); // Validate the IANA identifier even for an invalid date.
    this.timeZone = timeZone;
  }

  private wall() {
    const timestamp = this.getTime();
    if (!Object.is(timestamp, this.cachedTime)) {
      this.cachedTime = timestamp;
      this.cachedWall = new Date(wallTime(timestamp, this.timeZone));
    }
    return this.cachedWall;
  }
  private update(change: (wall: Date) => number, recoverInvalid = false) {
    const wall = new Date(
      recoverInvalid && !Number.isFinite(this.getTime())
        ? 0
        : this.wall().getTime(),
    );
    return this.setTime(instantAt(change(wall), this.timeZone));
  }
  override getFullYear() {
    return this.wall().getUTCFullYear();
  }
  override getMonth() {
    return this.wall().getUTCMonth();
  }
  override getDate() {
    return this.wall().getUTCDate();
  }
  override getDay() {
    return this.wall().getUTCDay();
  }
  override getHours() {
    return this.wall().getUTCHours();
  }
  override getMinutes() {
    return this.wall().getUTCMinutes();
  }
  override getSeconds() {
    return this.wall().getUTCSeconds();
  }
  override getMilliseconds() {
    return this.wall().getUTCMilliseconds();
  }
  override getTimezoneOffset() {
    return (this.getTime() - this.wall().getTime()) / 60_000;
  }
  override setFullYear(year: number, month?: number, day?: number) {
    return this.update(
      (wall) =>
        wall.setUTCFullYear(
          year,
          month ?? wall.getUTCMonth(),
          day ?? wall.getUTCDate(),
        ),
      true,
    );
  }
  override setMonth(month: number, day?: number) {
    return this.update((wall) =>
      wall.setUTCMonth(month, day ?? wall.getUTCDate()),
    );
  }
  override setDate(day: number) {
    return this.update((wall) => wall.setUTCDate(day));
  }
  override setHours(
    hours: number,
    minutes?: number,
    seconds?: number,
    ms?: number,
  ) {
    return this.update((wall) =>
      wall.setUTCHours(
        hours,
        minutes ?? wall.getUTCMinutes(),
        seconds ?? wall.getUTCSeconds(),
        ms ?? wall.getUTCMilliseconds(),
      ),
    );
  }
  override setMinutes(minutes: number, seconds?: number, ms?: number) {
    return this.update((wall) =>
      wall.setUTCMinutes(
        minutes,
        seconds ?? wall.getUTCSeconds(),
        ms ?? wall.getUTCMilliseconds(),
      ),
    );
  }
  override setSeconds(seconds: number, ms?: number) {
    return this.update((wall) =>
      wall.setUTCSeconds(seconds, ms ?? wall.getUTCMilliseconds()),
    );
  }
  override setMilliseconds(ms: number) {
    return this.update((wall) => wall.setUTCMilliseconds(ms));
  }
}

/** Whether `timeZone` is an IANA time zone `Intl` knows. */
export function isTimeZone(timeZone: string) {
  try {
    zoneFormat(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Time zone carried by a calendar date; ordinary Dates use the host zone. */
export const dateTimeZone = (date?: Date) =>
  date instanceof CalendarDate ? date.timeZone : undefined;

/** The same instant in a named IANA time zone. Does not mutate the input. */
export const inTimeZone = (date: Date, timeZone?: string): Date =>
  timeZone ? new CalendarDate(date.getTime(), timeZone) : new Date(date);

/** Clone or replace an instant, retaining its calendar's time zone. */
export const copyDate = (date: Date, timestamp = date.getTime()): Date =>
  inTimeZone(new Date(timestamp), dateTimeZone(date));

/** Build midnight in the zone of a reference, including years 0–99. */
export function zonedDay(
  year: number,
  month: number,
  day: number,
  reference?: Date,
) {
  const zone = dateTimeZone(reference);
  if (!zone) {
    const date = new Date(2000, 0, 1);
    date.setFullYear(year, month, day);
    return date;
  }
  const wall = new Date(0);
  wall.setUTCFullYear(year, month, day);
  return new CalendarDate(instantAt(wall.getTime(), zone), zone);
}
