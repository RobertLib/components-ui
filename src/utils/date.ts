import { toIntlLocale } from "../i18n/format";
import type { DatePatternToken, WeekDay } from "../i18n/types";

export const pad2 = (value: number) => String(value).padStart(2, "0");

/** A year with four digits, as the values of native inputs have it - `0999`. */
export const padYear = (year: number) => String(year).padStart(4, "0");

/** `YYYY-MM-DD` in local time - the value format of `<input type="date">`. */
export const toISODate = (date: Date) =>
  `${padYear(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

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

/**
 * Local midnight of a calendar day like `dateOf` - `null` for a day the time
 * zone skips as a whole (Samoa went from December 29 to 31 in 2011), which
 * `dateOf` takes for the day after it. `day` may lie outside the month (`0`,
 * `32`), as for `dateOf`.
 */
export function existingDayOf(year: number, monthIndex: number, day: number) {
  const date = dateOf(year, monthIndex, day);
  // The same day in UTC, which skips none
  const calendarDay = new Date(0);
  calendarDay.setUTCFullYear(year, monthIndex, day);
  return date.getDate() === calendarDay.getUTCDate() ? date : null;
}

/**
 * Local midnight of the day `days` days after the day of `date` - past a day
 * the time zone skips (see `existingDayOf`) on to the next one, in the
 * direction of `days` or of `direction`.
 */
export function shiftDay(
  date: Date,
  days: number,
  direction: 1 | -1 = days < 0 ? -1 : 1,
) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = date.getDate() + days;

  // A time zone skips a single day - the next step finds one
  for (let step = 0; step < 7; step++) {
    const result = existingDayOf(year, monthIndex, day + step * direction);
    if (result) return result;
  }
  return dateOf(year, monthIndex, day);
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

/**
 * The start of the day `offset` months from the day of `date` - the last day
 * of a shorter month: January 31 + 1 is February 28 (29).
 */
export function addMonths(date: Date, offset: number) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth() + offset;
  const lastDay = dateOf(year, monthIndex + 1, 0).getDate();
  return dateOf(year, monthIndex, Math.min(date.getDate(), lastDay));
}

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
 * then every day of the month - a `null` for a day the time zone skips (see
 * `existingDayOf`), so the days after it stay under their weekdays.
 */
export function getMonthDays(month: Date, weekStartsOn: WeekDay) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = dateOf(year, monthIndex + 1, 0).getDate();
  const leading = (dateOf(year, monthIndex, 1).getDay() - weekStartsOn + 7) % 7;

  const days: (Date | null)[] = Array.from({ length: leading }, () => null);

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(existingDayOf(year, monthIndex, day));
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
  return getISOWeek(dateOf(year, 11, 28)).week;
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

/** The texts of the `A` token: AM and PM, e.g. `["dop.", "odp."]` in Czech. */
export type DayPeriods = readonly [am: string, pm: string];

const DEFAULT_DAY_PERIODS: DayPeriods = ["AM", "PM"];

/** 1 - 12 of the 12-hour clock. */
const hours12 = (hours: number) => hours % 12 || 12;

/**
 * Formats date parts by a pattern such as `DD.MM.YYYY HH:mm` - see
 * `DateFormats` for the supported tokens. `A` is written with `dayPeriods`
 * (see `getDayPeriods`).
 */
export function formatPattern(
  pattern: string,
  parts: Partial<DateParts>,
  dayPeriods: DayPeriods = DEFAULT_DAY_PERIODS,
) {
  const value = (part: keyof DateParts) => parts[part] ?? 0;

  return pattern.replace(PATTERN_TOKEN, (token, literal?: string) => {
    if (literal !== undefined) return literal;

    switch (token) {
      case "YYYY":
        return padYear(value("year"));
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
        return dayPeriods[value("hours") < 12 ? 0 : 1];
      default:
        return token;
    }
  });
}

/**
 * A pattern as the placeholder of a field shows it: its bracketed text left
 * out with the separators after it - before it at the end (`[W]WW.YYYY` -
 * `WW.YYYY`, `[KW] WW YYYY` - `WW YYYY`), each token written by `tokens` if
 * they have it - with `{ YYYY: "RRRR" }` `DD.MM.YYYY` is the Czech
 * `DD.MM.RRRR`.
 */
export function formatPlaceholder(
  pattern: string,
  tokens: Partial<Record<DatePatternToken, string>> = {},
) {
  return pattern
    .replace(new RegExp(`${SEPARATOR}*\\[[^\\]]*]$`), "")
    .replace(new RegExp(`\\[[^\\]]*]${SEPARATOR}*`, "g"), "")
    .replace(
      PATTERN_TOKEN,
      (token) => tokens[token as DatePatternToken] ?? token,
    );
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

const SEPARATOR = "[\\s./\\-:,]";

// The numbers a token takes - the two-digit ones tried first, so that digits
// typed without separators split into numbers that fit: "24092026" is
// 24.09.2026, "9242026" 9/24/2026
const NUMBER_SOURCES: Record<keyof DateParts, string> = {
  day: "3[01]|[12]\\d|0?[1-9]",
  // Also the 12-hour clock - read as the 24-hour one without AM / PM
  hours: "2[0-3]|[01]?\\d",
  // Two digits - one only on its own after a separator ("9:5"), so that the
  // last two digits typed without one are the minutes: "930" is 9:30
  minutes: `[0-5]\\d|(?<=${SEPARATOR})\\d(?!\\d)`,
  month: "1[0-2]|0?[1-9]",
  week: "5[0-3]|[1-4]\\d|0?[1-9]",
  year: "\\d{4}",
};

// A year of two digits - not followed by a digit, nor by the `:` or `.` of
// a time: in "24.9 12:05" the year is left out, "12" are the hours
const SHORT_YEAR = "\\d{2}(?![\\d:.])";

// A year left out - the date ends there, or a space parts it from the time:
// "24.9.2026" is no 20:26 on 24.9.
const NO_YEAR = "(?=\\s|$)";

// The tokens of the date - after the last of them the year may be left out
const DAY_AND_MONTH = new Set(["D", "DD", "M", "MM"]);
const DATE_TOKENS = new Set([...DAY_AND_MONTH, "W", "WW"]);

/**
 * The year two digits stand for: one of the 100 years from 80 years before
 * `referenceYear` on - in 2026 `46` - `99` are 1946 - 1999 and `00` - `45`
 * are 2000 - 2045, the default window of Unicode CLDR.
 */
export function expandTwoDigitYear(year: number, referenceYear: number) {
  const first = referenceYear - 80;
  const result = first - (((first % 100) + 100) % 100) + year;
  return result < first ? result + 100 : result;
}

/** A day period as a regular expression - with its spaces optional. */
const dayPeriodSource = (text: string) =>
  escapeRegExp(text.trim()).replace(/\s+/g, "\\s*");

const isSameDayPeriod = (typed: string, text: string) =>
  typed.replace(/\s+/g, "").toLowerCase() ===
  text.replace(/\s+/g, "").toLowerCase();

/**
 * Reads date parts from a text typed in the shape of a pattern - the inverse
 * of `formatPattern`, forgiving about what the user types: any separators
 * (`1-2-2026` for `DD.MM.YYYY`) or none (`01022026`, `930` for `HH:mm`),
 * one-digit numbers, the bracketed text left out (`39.2026` for
 * `[W]WW.YYYY`), and the minutes left out when no number follows them
 * (`14`, `5 pm` - the full hour). A year after the day, month or week may
 * be left out (`24.9.` - no `year` in the result) or typed with two digits
 * (`24.9.26` - see `expandTwoDigitYear` for `referenceYear`, by default the
 * current year). AM / PM is read in `dayPeriods` and as the English `am` /
 * `pm`. Each number has to fit its token (a month 1 - 12, minutes 0 - 59) -
 * whether the parts make a real date is up to the caller. `null` when the
 * text does not fit the pattern.
 */
export function parsePattern(
  text: string,
  pattern: string,
  dayPeriods: DayPeriods = DEFAULT_DAY_PERIODS,
  referenceYear = new Date().getFullYear(),
): Partial<DateParts> | null {
  const tokens = Array.from(pattern.matchAll(PATTERN_TOKEN));
  const parts: (keyof typeof TOKEN_PARTS)[] = [];
  let source = "";
  let lastIndex = 0;

  const addLiteral = (literal: string) => {
    // Separators are interchangeable and optional, bracketed text optional
    source += new RegExp(`^${SEPARATOR}+$`).test(literal)
      ? `${SEPARATOR}*`
      : `(?:${escapeRegExp(literal)})?${SEPARATOR}*`;
  };

  // The longer day periods first - "a. m." before "a"
  const meridiemSource = [
    ...[...dayPeriods].sort((a, b) => b.length - a.length).map(dayPeriodSource),
    "[ap]\\.?\\s*m?\\.?",
  ].join("|");

  tokens.forEach((match, index) => {
    const between = pattern.slice(lastIndex, match.index);
    if (between) addLiteral(between);
    lastIndex = match.index + match[0].length;

    if (match[1] !== undefined) {
      if (match[1]) addLiteral(match[1]);
      return;
    }

    const token = match[0];
    const part = TOKEN_PARTS[token];
    parts.push(token);

    if (part === "meridiem") {
      source += `(?:(${meridiemSource}))?`;
    } else if (part === "minutes") {
      // Left out, the minutes are 0 - unless numbers follow, which the
      // hours could be split into ("14 24.9.2026" is no 14:24 on 9.2026)
      const numberFollows = tokens
        .slice(index + 1)
        .some(([next, literal]) => literal === undefined && next !== "A");
      source += numberFollows
        ? `(${NUMBER_SOURCES.minutes})`
        : `(?:(${NUMBER_SOURCES.minutes}))?`;
    } else if (
      part === "year" &&
      tokens
        .slice(index + 1)
        .every(
          ([next, literal]) => literal !== undefined || !DATE_TOKENS.has(next),
        )
    ) {
      // The year ends the date - it may be left out or have two digits
      source += `(?:(${NUMBER_SOURCES.year}|${SHORT_YEAR})|${NO_YEAR})`;
    } else {
      source += `(${NUMBER_SOURCES[part === "hours12" ? "hours" : part]})`;
    }
  });

  const rest = pattern.slice(lastIndex);
  if (rest) addLiteral(rest);

  const found = new RegExp(`^\\s*${source}\\s*$`, "di").exec(text);
  if (!found) return null;

  // Without a year a day and a month typed together need two digits each -
  // "2409" and "24.9" are the 24th of September, "12" is no February 1st
  const isYearLeftOut = parts.some(
    (token, index) => token === "YYYY" && found[index + 1] === undefined,
  );
  const [first, second] = parts.flatMap((token, index) => {
    const span = found.indices?.[index + 1];
    return DAY_AND_MONTH.has(token) && span ? [span] : [];
  });
  if (
    isYearLeftOut &&
    first &&
    second &&
    first[1] === second[0] &&
    (first[1] - first[0] < 2 || second[1] - second[0] < 2)
  ) {
    return null;
  }

  const result: Partial<DateParts> = {};
  let hour12: number | undefined;
  let isPm: boolean | undefined;

  parts.forEach((token, index) => {
    const captured = found[index + 1];
    // Left out - the minutes, the year or AM / PM
    if (captured === undefined) return;

    const part = TOKEN_PARTS[token];

    if (part === "year" && captured.length === 2) {
      result.year = expandTwoDigitYear(Number(captured), referenceYear);
    } else if (part === "meridiem") {
      isPm = isSameDayPeriod(captured, dayPeriods[1])
        ? true
        : isSameDayPeriod(captured, dayPeriods[0])
          ? false
          : captured.charAt(0).toLowerCase() === "p";
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

/** `pattern` without its first of `tokens` and the separators next to it. */
function withoutToken(pattern: string, tokens: ReadonlySet<string>) {
  const found = Array.from(pattern.matchAll(PATTERN_TOKEN)).find(([token]) =>
    tokens.has(token),
  );
  if (!found) return pattern;

  const before = pattern
    .slice(0, found.index)
    .replace(new RegExp(`${SEPARATOR}+$`), "");
  const after = pattern.slice(found.index + found[0].length);

  return before
    ? before + after
    : after.replace(new RegExp(`^${SEPARATOR}+`), "");
}

/**
 * `pattern` without its year and the separators next to it. The week
 * picker labels its buttons with the week format of the locale that way:
 * `[W]WW.YYYY` - `[W]WW` (W39), `[KW] WW YYYY` - `[KW] WW` (KW 39).
 */
export const withoutYear = (pattern: string) =>
  withoutToken(pattern, new Set(["YYYY"]));

/**
 * `pattern` without its month and the separators next to it - how a day of
 * a range typed with the month of the other day is read: `DD.MM.YYYY` -
 * `DD.YYYY`, `MM/DD/YYYY` - `DD/YYYY`.
 */
export const withoutMonth = (pattern: string) =>
  withoutToken(pattern, new Set(["M", "MM"]));

/** Whether the day comes before the month in `pattern` - `DD.MM.YYYY`. */
export function isDayBeforeMonth(pattern: string) {
  const tokens = Array.from(
    pattern.matchAll(PATTERN_TOKEN),
    ([token]) => token,
  );
  return (
    tokens.findIndex((token) => token === "D" || token === "DD") <
    tokens.findIndex((token) => token === "M" || token === "MM")
  );
}

/**
 * `formatPattern` for a `Date`. A pattern with the week (`W`, `WW`) shows
 * the year the ISO week belongs to - 2024-12-30 is `W01.2025`.
 */
export function formatDate(
  date: Date,
  pattern: string,
  dayPeriods?: DayPeriods,
) {
  const isoWeek = getISOWeek(date);
  const showsWeek = Array.from(pattern.matchAll(PATTERN_TOKEN)).some(
    ([token]) => token === "W" || token === "WW",
  );

  return formatPattern(
    pattern,
    {
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      month: date.getMonth() + 1,
      week: isoWeek.week,
      year: showsWeek ? isoWeek.year : date.getFullYear(),
    },
    dayPeriods,
  );
}

export const capitalize = (text: string, localeCode?: string) =>
  text
    .charAt(0)
    .toLocaleUpperCase(
      localeCode === undefined ? undefined : toIntlLocale(localeCode),
    ) + text.slice(1);

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
    const format = new Intl.DateTimeFormat(toIntlLocale(localeCode), {
      month: width,
    });
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
    const format = new Intl.DateTimeFormat(toIntlLocale(localeCode), {
      weekday: width,
    });
    // 2021-02-07 is a Sunday, so index 0 = Sunday like Date#getDay()
    return Array.from({ length: 7 }, (_, day) =>
      capitalize(format.format(new Date(2021, 1, 7 + day)), localeCode),
    );
  });

  return [...names.slice(weekStartsOn), ...names.slice(0, weekStartsOn)];
}

/** AM and PM as the language writes them: "AM" / "PM", "dop." / "odp.". */
export function getDayPeriods(localeCode: string): DayPeriods {
  const [am, pm] = cachedNames(`dayPeriod:${localeCode}`, () => {
    const format = new Intl.DateTimeFormat(toIntlLocale(localeCode), {
      hour: "numeric",
      hourCycle: "h12",
    });
    return [1, 13].map(
      (hour, index) =>
        format
          .formatToParts(new Date(2021, 0, 1, hour))
          .find((part) => part.type === "dayPeriod")?.value ??
        DEFAULT_DAY_PERIODS[index],
    );
  });

  return [am, pm];
}

/** "Září 2026", "September 2026" */
export const formatMonthYear = (date: Date, localeCode: string) =>
  capitalize(
    new Intl.DateTimeFormat(toIntlLocale(localeCode), {
      month: "long",
      year: "numeric",
    }).format(date),
    localeCode,
  );
