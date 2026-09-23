import type { WeekDay } from "../i18n/types";

export const pad2 = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM-DD` in local time - the value format of `<input type="date">`. */
export const toISODate = (date: Date) =>
  `${String(date.getFullYear()).padStart(4, "0")}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** `HH:mm` in local time - the value format of `<input type="time">`. */
export const toISOTime = (date: Date) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/**
 * Local midnight of a calendar day - also of the years 0 - 99, which
 * `new Date(year, …)` would take for 1900 - 1999.
 */
export function dateOf(year: number, monthIndex: number, day: number) {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  return date;
}

/** Whether `year`-`month`-`day` (month 1 - 12) is a real day of the calendar. */
export const isValidDay = (year: number, month: number, day: number) =>
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= dateOf(year, month, 0).getDate();

/**
 * Parses a `YYYY-MM-DD` date (or the date part of `YYYY-MM-DDTHH:mm`) as
 * local midnight. Returns `null` for anything else - also for a day the
 * month does not have (`2026-02-31`).
 */
export function parseISODate(value: string | null | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidDay(year, month, day)) return null;

  return dateOf(year, month - 1, day);
}

export const startOfDay = (date: Date) =>
  dateOf(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const isSameDay = (a: Date, b: Date) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

/** The first day of the week `date` falls in (at local midnight). */
export function startOfWeek(date: Date, weekStartsOn: WeekDay) {
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  return addDays(startOfDay(date), -offset);
}

/**
 * The days of a month grid: leading `null`s for the weekdays before the 1st,
 * then every day of the month.
 */
export function getMonthDays(month: Date, weekStartsOn: WeekDay) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leading =
    (new Date(year, monthIndex, 1).getDay() - weekStartsOn + 7) % 7;

  const days: (Date | null)[] = Array.from({ length: leading }, () => null);

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, monthIndex, day));
  }

  return days;
}

/** ISO 8601 week number and the year it belongs to (weeks start on Monday). */
export function getISOWeek(date: Date) {
  const target = startOfDay(date);
  // Thursday of the same week decides the year
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));

  const firstThursday = dateOf(target.getFullYear(), 0, 4);
  firstThursday.setDate(
    firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7),
  );

  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / 604_800_000);

  return { week, year: target.getFullYear() };
}

/** 52 or 53 - the number of ISO weeks in `year`. */
export function getISOWeeksInYear(year: number) {
  // December 28th always lies in the last week of the year
  return getISOWeek(new Date(year, 11, 28)).week;
}

export interface DateParts {
  day: number;
  hours: number;
  minutes: number;
  /** 1 - 12 */
  month: number;
  week: number;
  year: number;
}

const PATTERN_TOKEN = /\[([^\]]*)]|YYYY|MM|M|DD|D|HH|H|hh|h|mm|WW|W|A/g;

/** 1 - 12 of the 12-hour clock. */
const hours12 = (hours: number) => hours % 12 || 12;

/**
 * Formats date parts by a pattern such as `DD.MM.YYYY HH:mm` - see
 * `DateFormats` for the supported tokens.
 */
export function formatPattern(pattern: string, parts: Partial<DateParts>) {
  const value = (part: keyof DateParts) => parts[part] ?? 0;

  return pattern.replace(PATTERN_TOKEN, (token, literal?: string) => {
    if (literal !== undefined) return literal;

    switch (token) {
      case "YYYY":
        return String(value("year")).padStart(4, "0");
      case "MM":
        return pad2(value("month"));
      case "M":
        return String(value("month"));
      case "DD":
        return pad2(value("day"));
      case "D":
        return String(value("day"));
      case "HH":
        return pad2(value("hours"));
      case "H":
        return String(value("hours"));
      case "hh":
        return pad2(hours12(value("hours")));
      case "h":
        return String(hours12(value("hours")));
      case "mm":
        return pad2(value("minutes"));
      case "WW":
        return pad2(value("week"));
      case "W":
        return String(value("week"));
      case "A":
        return value("hours") < 12 ? "AM" : "PM";
      default:
        return token;
    }
  });
}

/** Whether a pattern shows the hours on the 12-hour clock (`h`, `hh`). */
export const usesHour12 = (pattern: string) =>
  Array.from(pattern.matchAll(PATTERN_TOKEN)).some(
    ([token]) => token === "h" || token === "hh",
  );

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TOKEN_PARTS: Record<string, keyof DateParts | "hours12" | "meridiem"> = {
  A: "meridiem",
  D: "day",
  DD: "day",
  H: "hours",
  HH: "hours",
  M: "month",
  MM: "month",
  W: "week",
  WW: "week",
  YYYY: "year",
  h: "hours12",
  hh: "hours12",
  mm: "minutes",
};

/**
 * Reads date parts from a text typed in the shape of a pattern - the inverse
 * of `formatPattern`, forgiving about what the user types: any separators
 * (`1-2-2026` for `DD.MM.YYYY`) or none (`01022026`), one-digit numbers and
 * the bracketed text left out (`39.2026` for `[W]WW.YYYY`). Only checks the
 * shape - whether the parts make a real date is up to the caller. `null`
 * when the text does not fit the pattern.
 */
export function parsePattern(
  text: string,
  pattern: string,
): Partial<DateParts> | null {
  const parts: (keyof typeof TOKEN_PARTS)[] = [];
  let source = "";
  let lastIndex = 0;

  const addLiteral = (literal: string) => {
    // Separators are interchangeable and optional, bracketed text optional
    source += /^[\s./\-:,]+$/.test(literal)
      ? "[\\s./\\-:,]*"
      : `(?:${escapeRegExp(literal)})?[\\s./\\-:,]*`;
  };

  for (const match of pattern.matchAll(PATTERN_TOKEN)) {
    const between = pattern.slice(lastIndex, match.index);
    if (between) addLiteral(between);
    lastIndex = match.index + match[0].length;

    if (match[1] !== undefined) {
      if (match[1]) addLiteral(match[1]);
      continue;
    }

    parts.push(match[0]);
    source +=
      match[0] === "YYYY"
        ? "(\\d{4})"
        : match[0] === "A"
          ? "(?:([ap])\\.?\\s*m?\\.?)?"
          : "(\\d{1,2})";
  }

  const rest = pattern.slice(lastIndex);
  if (rest) addLiteral(rest);

  const found = new RegExp(`^\\s*${source}\\s*$`, "i").exec(text);
  if (!found) return null;

  const result: Partial<DateParts> = {};
  let hour12: number | undefined;
  let isPm: boolean | undefined;

  parts.forEach((token, index) => {
    const captured = found[index + 1];
    const part = TOKEN_PARTS[token];

    if (part === "meridiem") {
      if (captured) isPm = captured.toLowerCase() === "p";
    } else if (part === "hours12") {
      hour12 = Number(captured);
    } else {
      result[part] = Number(captured);
    }
  });

  if (hour12 !== undefined) {
    if (isPm === undefined) {
      // Without AM / PM the hours are read as the 24-hour clock - "21:05"
      result.hours = hour12;
    } else {
      // 12 AM is midnight, 12 PM noon
      if (hour12 < 1 || hour12 > 12) return null;
      result.hours = (hour12 % 12) + (isPm ? 12 : 0);
    }
  }

  return result;
}

/**
 * `formatPattern` for a `Date`. A pattern with the week (`W`, `WW`) shows
 * the year the ISO week belongs to - 2024-12-30 is `W01.2025`.
 */
export function formatDate(date: Date, pattern: string) {
  const isoWeek = getISOWeek(date);
  const showsWeek = Array.from(pattern.matchAll(PATTERN_TOKEN)).some(
    ([token]) => token === "W" || token === "WW",
  );

  return formatPattern(pattern, {
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    month: date.getMonth() + 1,
    week: isoWeek.week,
    year: showsWeek ? isoWeek.year : date.getFullYear(),
  });
}

export const capitalize = (text: string, localeCode?: string) =>
  text.charAt(0).toLocaleUpperCase(localeCode) + text.slice(1);

const nameCache = new Map<string, string[]>();

function cachedNames(key: string, build: () => string[]) {
  let names = nameCache.get(key);

  if (!names) {
    names = build();
    nameCache.set(key, names);
  }

  return names;
}

/** Month names in the nominative ("Leden", "January"), January first. */
export function getMonthNames(
  localeCode: string,
  width: "long" | "short" = "long",
) {
  return cachedNames(`month:${localeCode}:${width}`, () => {
    const format = new Intl.DateTimeFormat(localeCode, { month: width });
    return Array.from({ length: 12 }, (_, month) =>
      capitalize(format.format(new Date(2021, month, 1)), localeCode),
    );
  });
}

/** Weekday names ordered from `weekStartsOn`, e.g. `["Po", "Út", …]`. */
export function getWeekdayNames(
  localeCode: string,
  weekStartsOn: WeekDay,
  width: "long" | "short" = "short",
) {
  const names = cachedNames(`weekday:${localeCode}:${width}`, () => {
    const format = new Intl.DateTimeFormat(localeCode, { weekday: width });
    // 2021-02-07 is a Sunday, so index 0 = Sunday like Date#getDay()
    return Array.from({ length: 7 }, (_, day) =>
      capitalize(format.format(new Date(2021, 1, 7 + day)), localeCode),
    );
  });

  return [...names.slice(weekStartsOn), ...names.slice(0, weekStartsOn)];
}

/** "Září 2026", "September 2026" */
export const formatMonthYear = (date: Date, localeCode: string) =>
  capitalize(
    new Intl.DateTimeFormat(localeCode, {
      month: "long",
      year: "numeric",
    }).format(date),
    localeCode,
  );
