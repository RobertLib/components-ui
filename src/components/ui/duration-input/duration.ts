import { toIntlLocale } from "../../../i18n/ui/format";

/** How a duration is written - see `DurationInputProps.display`. */
export type DurationDisplay = "clock" | "units";

/** The unit of a whole number typed without one. */
export type DurationUnit = "hours" | "minutes";

/**
 * What a typed text says: whole minutes (`null` for an empty text), or why
 * it says none - it is no duration (`invalid`), or a negative one.
 */
export type ParsedDuration =
  { minutes: number | null } | { error: "invalid" | "negative" };

/** Writes and reads the durations of one locale - see `getDurationFormat`. */
export interface DurationFormat {
  /**
   * Whole minutes as the field shows them - "1:30" or "1 h 30 min"; the
   * clock also for the units of a locale `parse` cannot read back.
   */
  format: (minutes: number, display: DurationDisplay) => string;
  /** Whole minutes in words, for screen readers - "1 hour, 30 minutes". */
  formatLong: (minutes: number) => string;
  /**
   * The whole minutes a typed text stands for - see `DurationInputProps`
   * for what it reads. `defaultUnit` is the unit of a whole number alone.
   */
  parse: (text: string, defaultUnit: DurationUnit) => ParsedDuration;
}

// The units a typed duration can have - by rank, from the smallest
const SECOND = 0;
const MINUTE = 1;
const HOUR = 2;
// Minutes in one of each rank
const UNIT_MINUTES = [1 / 60, 1, 60];
const INTL_UNITS = ["second", "minute", "hour"] as const;

// Czech and English unit words in any locale - also the accusative of the
// Czech ("na hodinu"), which Intl does not write. Without diacritics, as a
// typed word is also compared without them.
const UNIT_WORDS: [rank: number, words: string][] = [
  [HOUR, "h hod hodina hodiny hodin hodinu hr hrs hour hours"],
  [MINUTE, "m min mins minuta minuty minut minutu minute minutes"],
  [SECOND, "s sec secs second seconds sek sekunda sekundy sekund sekundu"],
];
// The words between the parts - "1 hodina a 30 minut", "1 hour and 30 minutes"
const CONJUNCTIONS = ["a", "and"];

// Numbers whose unit words differ by the plural rules of most languages
const PLURAL_SAMPLES = [0, 1, 1.5, 2, 3, 5, 11, 21, 22, 25, 100, 101];

// Beyond it the seconds of a value are no longer exact integers -
// `Number.MAX_SAFE_INTEGER / 60`, written out: a module-level expression
// would stay in every app that imports the library
const MAX_MINUTES = 150_119_987_579_016.53;

const MINUS_SIGNS = /[\u2212\u2012\u2013\uFE63\uFF0D]/g;
// The full-width digits, colon, comma and full stop of East Asian input
const FULL_WIDTH = /[\uFF0C\uFF0E\uFF10-\uFF1A]/g;
// The direction marks around the numbers of a right-to-left language
const BIDI_MARKS = /[\u061C\u200E\u200F]/g;
const COMBINING_MARKS = /\p{M}/gu;

const NUMBER = /(\d+(?:[.,]\d+)?|[.,]\d+)\s*/y;
const CLOCK = /^(\d*)\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?$/;
// A number alone - with a fraction it is hours ("1,5"), whole it is in the
// default unit
const BARE_NUMBER = /^(?:\d+|\d*[.,]\d+)$/;
// Weeks, days (of 24 hours) and the time, each number with an optional
// fraction - years and months have no fixed length, so they are not read
const ISO_DURATION =
  /^([+-])?P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?=[\d.,])(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i;
const ISO_PART_MINUTES = [7 * 24 * 60, 24 * 60, 60, 1, 1 / 60];

const toNumber = (digits: string) => Number(digits.replace(",", "."));

/** Lower case without diacritics - "Hodin" and "hodín" are "hodin". */
const fold = (text: string) =>
  text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();

/**
 * The minutes an ISO 8601 duration stands for - "PT1H30M", "PT90M",
 * "P1DT2H" (a day of 24 hours), "PT1.5H" - or `null` for a text that is
 * none, or one with years or months, which have no fixed length. Not
 * rounded; negative for "-PT30M".
 */
export function parseIsoDuration(text: string): number | null {
  const match = ISO_DURATION.exec(text.trim());
  if (!match) return null;

  const [, sign, ...parts] = match;
  if (parts.every((part) => part === undefined)) return null;

  const minutes = parts.reduce(
    (sum, part, index) =>
      part === undefined ? sum : sum + toNumber(part) * ISO_PART_MINUTES[index],
    0,
  );
  return sign === "-" ? -minutes : minutes;
}

/**
 * Whole minutes as an ISO 8601 duration in hours and minutes - "PT1H30M",
 * "PT25H", "PT45M"; "PT0S" for none, as `Temporal.Duration` writes it.
 */
export function toIsoDuration(minutes: number) {
  const whole = Math.abs(Math.round(minutes));
  if (whole === 0) return "PT0S";

  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes < 0 ? "-" : ""}PT${hours ? `${hours}H` : ""}${rest ? `${rest}M` : ""}`;
}

/**
 * The letters of a unit or a conjunction as the typed text is compared -
 * in lower case, with their combining marks ("मि") - and the abbreviation
 * mark after them: the full stop of "Std.", the geresh of the Hebrew
 * "דק׳". `null` for a text of other characters.
 */
function toWord(text: string) {
  const match = /^([\p{L}\p{M}]+)(\p{Po})?$/u.exec(
    text.normalize("NFC").toLowerCase().trim(),
  );
  return match && { mark: match[2], word: match[1] };
}

/**
 * The unit words, abbreviation marks and conjunctions of the locale -
 * those Intl writes, so that the field reads what it shows ("1 Std., 30
 * Min." in German).
 */
function readLocaleWords(locale: string) {
  // The unit of each word, and of each word without its diacritics - `null`
  // where those of two units are the same then: the Malayalam hour "മ" is
  // also the minute "മി" without its vowel sign
  const units = new Map<string, number>();
  const foldedUnits = new Map<string, number | null>();
  const addUnit = (word: string, rank: number) => {
    // A word of another unit stays with it
    if (!units.has(word)) units.set(word, rank);
    const folded = fold(word);
    const known = foldedUnits.get(folded);
    if (known === undefined) foldedUnits.set(folded, rank);
    else if (known !== rank) foldedUnits.set(folded, null);
  };
  for (const [rank, words] of UNIT_WORDS) {
    for (const word of words.split(" ")) addUnit(word, rank);
  }
  const conjunctions = new Set(CONJUNCTIONS);
  const marks = new Set(["."]);

  INTL_UNITS.forEach((unit, rank) => {
    for (const unitDisplay of ["long", "short", "narrow"] as const) {
      const format = new Intl.NumberFormat(locale, {
        style: "unit",
        unit,
        unitDisplay,
      });
      for (const sample of PLURAL_SAMPLES) {
        for (const part of format.formatToParts(sample)) {
          const read = part.type === "unit" ? toWord(part.value) : null;
          if (!read) continue;
          addUnit(read.word, rank);
          // Not those between the parts
          if (read.mark && !",;".includes(read.mark)) marks.add(read.mark);
        }
      }
    }
  });

  for (const type of ["conjunction", "unit"] as const) {
    const parts = new Intl.ListFormat(locale, {
      style: "long",
      type,
    }).formatToParts(["1", "2"]);
    for (const part of parts) {
      const read =
        part.type === "literal"
          ? toWord(part.value.replace(/[\s,;]/g, ""))
          : null;
      if (read) conjunctions.add(read.word).add(fold(read.word));
    }
  }

  return { conjunctions, foldedUnits, marks, units };
}

/**
 * The digits and the decimal separator of the locale's own numbering system
 * (Arabic "١٫٥") - with the Latin ones they stand for. Empty for a locale
 * writing Latin digits.
 */
function readNativeDigits(locale: string) {
  const native = new Map<string, string>();
  const format = new Intl.NumberFormat(locale);
  const { numberingSystem } = format.resolvedOptions();
  if (numberingSystem === "latn") return native;

  for (let digit = 0; digit <= 9; digit++) {
    native.set(format.format(digit), String(digit));
  }
  const decimal = format
    .formatToParts(1.5)
    .find((part) => part.type === "decimal")?.value;
  if (decimal) native.set(decimal, ".");
  return native;
}

/**
 * The minutes of parts with units - "1 h 30 min", "1h30", "90m", "1.5 h",
 * "1 hodina a 30 minut" - from the largest unit to the smallest, each once.
 * A number without a unit after another part is in the next smaller unit
 * ("1h30" is 1 h 30 min). `null` for a text that is none.
 */
function readUnits(
  text: string,
  unitOf: (word: string) => number | undefined,
  separator: RegExp,
  wordPattern: RegExp,
): number | null {
  let index = 0;
  let minutes = 0;
  // Above the hours - any unit can come first
  let previous = HOUR + 1;

  while (index < text.length) {
    if (previous <= HOUR) {
      separator.lastIndex = index;
      separator.exec(text);
      index = separator.lastIndex;
    }

    NUMBER.lastIndex = index;
    const number = NUMBER.exec(text);
    if (!number) return null;
    index = NUMBER.lastIndex;

    wordPattern.lastIndex = index;
    const word = wordPattern.exec(text);
    let rank: number | undefined;
    if (word) {
      rank = unitOf(word[1]);
      index = wordPattern.lastIndex;
    } else if (previous <= HOUR) {
      rank = previous - 1;
    }
    if (rank === undefined || rank < SECOND || rank >= previous) return null;

    minutes += toNumber(number[1]) * UNIT_MINUTES[rank];
    previous = rank;
  }

  return previous <= HOUR ? minutes : null;
}

function createDurationFormat(locale: string): DurationFormat {
  const integer = new Intl.NumberFormat(locale, { useGrouping: false });
  const twoDigits = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  // Without grouping - the shown text is read back as it is
  const unitFormat = (unit: "hour" | "minute", unitDisplay: "long" | "short") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay,
      useGrouping: false,
    });
  const short = {
    hour: unitFormat("hour", "short"),
    minute: unitFormat("minute", "short"),
    // "1 h 30 min" - joined as a measure, without a comma
    list: new Intl.ListFormat(locale, { style: "narrow", type: "unit" }),
  };
  const long = {
    hour: unitFormat("hour", "long"),
    minute: unitFormat("minute", "long"),
    // "1 hour, 30 minutes", "1 hodina a 30 minut"
    list: new Intl.ListFormat(locale, { style: "long", type: "unit" }),
  };

  const native = readNativeDigits(locale);
  const { conjunctions, foldedUnits, marks, units } = readLocaleWords(locale);
  const separator = new RegExp(
    String.raw`(?:[\s,;+&]|(?:${Array.from(conjunctions).join("|")})(?![\p{L}\p{M}]))*`,
    "uy",
  );
  // A word - letters with their combining marks - and an abbreviation mark
  // of the locale after it, escaped for a character class
  const markClass = Array.from(marks, (mark) =>
    mark.replace(/[\\\][^-]/g, "\\$&"),
  ).join("");
  const wordPattern = new RegExp(
    String.raw`([\p{L}\p{M}]+)[${markClass}]?\s*`,
    "uy",
  );
  /** The unit of a word as typed - else of it without diacritics. */
  const unitOf = (word: string) =>
    units.get(word) ?? foldedUnits.get(fold(word)) ?? undefined;

  /** The parts of whole minutes - the sign apart, as the units carry none. */
  const split = (minutes: number) => {
    const whole = Math.abs(Math.round(minutes));
    const hours = Math.floor(whole / 60);
    return { hours, rest: whole - hours * 60, sign: minutes < 0 ? "-" : "" };
  };

  /** Hours and minutes with units - no zero part, but "0 min" for none. */
  const inUnits = (minutes: number, formats: typeof short) => {
    const { hours, rest, sign } = split(minutes);
    const parts: string[] = [];
    if (hours) parts.push(formats.hour.format(hours));
    if (rest || !hours) parts.push(formats.minute.format(rest));
    return sign + formats.list.format(parts);
  };

  /** The minutes of a text without a sign - `null` for no duration. */
  const read = (text: string, defaultUnit: DurationUnit) => {
    if (text.startsWith("p")) return parseIsoDuration(text);

    const clock = CLOCK.exec(text);
    if (clock) {
      const [, hours, minutes, seconds = "0"] = clock;
      return Number(minutes) < 60 && Number(seconds) < 60
        ? Number(hours || 0) * 60 + Number(minutes) + Number(seconds) / 60
        : null;
    }

    if (BARE_NUMBER.test(text)) {
      const isHours = defaultUnit === "hours" || !/^\d+$/.test(text);
      return toNumber(text) * (isHours ? 60 : 1);
    }

    return readUnits(text, unitOf, separator, wordPattern);
  };

  const parse: DurationFormat["parse"] = (text, defaultUnit) => {
    // Lower case, with the diacritics - a word is compared as it is typed
    // first
    let normalized = Array.from(text, (char) => native.get(char) ?? char)
      .join("")
      .normalize("NFC")
      .toLowerCase()
      .replace(FULL_WIDTH, (char) =>
        String.fromCharCode(char.charCodeAt(0) - 0xfee0),
      )
      .replace(MINUS_SIGNS, "-")
      .replace(BIDI_MARKS, "")
      .trim();
    if (!normalized) return { minutes: null };

    const sign = normalized[0];
    if (sign === "-" || sign === "+") {
      normalized = normalized.slice(1).trimStart();
    }

    const minutes = read(normalized, defaultUnit);
    if (minutes === null || !(minutes <= MAX_MINUTES)) {
      return { error: "invalid" };
    }
    // Fractions of a minute round to whole minutes - a negative zero is
    // none
    const rounded = Math.round(minutes);
    if (sign === "-" && rounded > 0) return { error: "negative" };
    return { minutes: rounded };
  };

  // A few locales write units the field cannot read back - before the
  // number (Swahili "saa 1"), or a number in words (Hebrew "שעתיים", two
  // hours): their fields write the clock instead. Tried once per locale,
  // with the hours and minutes of the plural forms of most languages.
  const readsUnits = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 21, 22, 25, 100, 101,
  ].every((hours) =>
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 21, 22, 25, 59].every((rest) => {
      const minutes = hours * 60 + rest;
      const parsed = parse(inUnits(minutes, short), "minutes");
      return "minutes" in parsed && parsed.minutes === minutes;
    }),
  );

  return {
    format: (minutes, display) => {
      if (display === "units" && readsUnits) return inUnits(minutes, short);
      const { hours, rest, sign } = split(minutes);
      return `${sign}${integer.format(hours)}:${twoDigits.format(rest)}`;
    },
    formatLong: (minutes) => inUnits(minutes, long),
    parse,
  };
}

const formats = new Map<string, DurationFormat>();

/**
 * Writes and reads durations in the locale `localeCode` - created once per
 * locale.
 */
export function getDurationFormat(localeCode: string) {
  const locale = toIntlLocale(localeCode);
  let format = formats.get(locale);

  if (!format) {
    format = createDurationFormat(locale);
    formats.set(locale, format);
  }

  return format;
}
