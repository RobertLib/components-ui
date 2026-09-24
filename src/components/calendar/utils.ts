import type { CalendarEvent, CalendarResource } from "./types";
import type { Locale } from "../../i18n/types";
import { addCalendarDays, atHour, minutesIntoDay } from "./date-utils";
import { dateOf, isSameDay, startOfDay, usesHour12 } from "../../utils/date";
import { formatMessage, toIntlLocale } from "../../i18n/format";

// What `new Date("2026-09-24")` gives
const isUTCMidnight = (date: Date) => date.getTime() % 86_400_000 === 0;

const isLocalMidnight = (date: Date) =>
  startOfDay(date).getTime() === date.getTime();

/**
 * The days of an all-day event. Dates parsed from `YYYY-MM-DD` strings are
 * UTC midnights - the evening before (in the Americas) or a morning hour of
 * the day (in Europe) on the local clock. When both the start and the end
 * are UTC midnights and one of them is not a local midnight (in London only
 * in summer time), they count as their UTC calendar days, turned into local
 * midnights; other dates are taken as they are.
 */
export function getAllDayRange(event: { end: Date; start: Date }): {
  end: Date;
  start: Date;
} {
  if (
    !isUTCMidnight(event.start) ||
    !isUTCMidnight(event.end) ||
    (isLocalMidnight(event.start) && isLocalMidnight(event.end))
  ) {
    return { end: event.end, start: event.start };
  }

  const toLocalDay = (date: Date) =>
    dateOf(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return { end: toLocalDay(event.end), start: toLocalDay(event.start) };
}

/**
 * Whether an event shows on `day`: it starts on it or runs into it. An event
 * ending at the midnight that starts `day` belongs to the day before. An
 * all-day event goes by its days - see `getAllDayRange`.
 */
export function isOnDay(
  event: { allDay?: boolean; end: Date; start: Date },
  day: Date,
) {
  const { end, start } = event.allDay ? getAllDayRange(event) : event;
  const dayStart = startOfDay(day);

  return (
    isSameDay(start, day) ||
    (start < addCalendarDays(dayStart, 1) && end > dayStart)
  );
}

/**
 * Whether a timed event goes on past the midnight ending its first day - it
 * then shows on each of its days, and the grid of one day cannot drag it.
 */
export const spansMidnight = (event: CalendarEvent) =>
  event.end > atHour(event.start, 24);

/**
 * The order the views list events in - the tiles of a month day, the Tab
 * order: all-day events first, then by start, the longer of events starting
 * together first.
 */
export const sortEvents = (events: CalendarEvent[]) =>
  [...events].sort(
    (a, b) =>
      Number(!!b.allDay) - Number(!!a.allDay) ||
      a.start.getTime() - b.start.getTime() ||
      b.end.getTime() - a.end.getTime(),
  );

/**
 * Makes the button of a tile operable from the keyboard - it takes the
 * focus, and Enter or Space open it like a click.
 */
export const clickableTileProps = (onActivate: () => void) => ({
  onKeyDown: (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onActivate();
  },
  role: "button" as const,
  tabIndex: 0,
});

/**
 * Height of the shortest tile in the week and day views, in pixels - a line
 * of text, and room to grab the tile between its resize handles.
 */
export const MIN_TILE_HEIGHT = 24;

export interface EventLayout {
  /** Column of the event in its cluster of overlapping events, 0 = leftmost. */
  column: number;
  /** Number of columns of the cluster - a column is `1 / columns` wide. */
  columns: number;
  /**
   * Columns the tile takes: 1, or more where the columns to its right stay
   * free for its whole time.
   */
  span: number;
}

/**
 * Lays out the events of one day column side by side. Events overlapping
 * each other - directly or through others - form a cluster; each goes into
 * the first column of its cluster that is free at its start, and widens into
 * the columns to its right that stay free for its whole time. `from` / `to`
 * are the minutes the tiles are drawn at - the clock time, also over a
 * daylight saving change, with the minimum height of a tile. Events touching
 * at an end do not overlap.
 */
export function layoutEvents(
  items: { from: number; id: string; to: number }[],
): Map<string, EventLayout> {
  const result = new Map<string, EventLayout>();

  const sorted = [...items].sort((a, b) => a.from - b.from || b.to - a.to);
  let cluster: { column: number; from: number; id: string; to: number }[] = [];
  // The end of the last event in each column of the cluster
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    const columns = columnEnds.length;

    for (const item of cluster) {
      let span = 1;
      while (
        item.column + span < columns &&
        !cluster.some(
          (other) =>
            other.column === item.column + span &&
            other.from < item.to &&
            other.to > item.from,
        )
      ) {
        span++;
      }
      result.set(item.id, { column: item.column, columns, span });
    }

    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.from >= clusterEnd) closeCluster();

    let column = columnEnds.findIndex((end) => end <= item.from);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = item.to;

    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, item.to);
  }
  closeCluster();

  return result;
}

/**
 * The part of an event from `start` to `end` inside the hours shown for
 * `day`, in minutes since its midnight - `null` when no part of it is. An
 * event ending at the next midnight ends at 24:00; one without a length
 * shows where it starts.
 */
export function getVisibleMinutes(
  start: Date,
  end: Date,
  day: Date,
  startHour: number,
  endHour: number,
): { from: number; to: number } | null {
  const from = minutesIntoDay(day, start);
  const to = Math.max(minutesIntoDay(day, end), from);

  if (
    from >= endHour * 60 ||
    to < startHour * 60 ||
    // Over when the hours shown begin
    (to === startHour * 60 && from < to)
  ) {
    return null;
  }

  return {
    from: Math.max(from, startHour * 60),
    to: Math.min(to, endHour * 60),
  };
}

/**
 * The full day, e.g. "Thursday, September 24, 2026". A locale code `Intl`
 * does not understand ("en_GB") falls back, like in the pickers.
 */
export const createDayFormat = (locale: Locale) =>
  new Intl.DateTimeFormat(toIntlLocale(locale.code), { dateStyle: "full" });

/**
 * A time - or the times of a range - on the clock of the locale, e.g.
 * "9:00 AM" or "9:00 – 10:00 AM".
 */
export const createTimeFormat = (locale: Locale) =>
  new Intl.DateTimeFormat(toIntlLocale(locale.code), {
    hourCycle: usesHour12(locale.formats.time) ? "h12" : "h23",
    timeStyle: "short",
  });

/**
 * The full day and a time - or the times of a range - on the clock of the
 * locale, like the time column shows it.
 */
export const createDateTimeFormat = (locale: Locale, timeZone?: string) =>
  new Intl.DateTimeFormat(toIntlLocale(locale.code), {
    dateStyle: "full",
    // The locale's time format decides - `h:mm A` is the 12-hour clock
    hourCycle: usesHour12(locale.formats.time) ? "h12" : "h23",
    timeStyle: "short",
    timeZone,
  });

/**
 * Names the slot rows for screen readers - the day and the clock time
 * `minutes` after its midnight, as the time column shows it. Also a time a
 * daylight saving change skips: the rows of the gap (2:00, 2:30 when the
 * clocks jump to 3:00) keep their own names, not all that of its end.
 */
export function createSlotLabeler(locale: Locale) {
  // The clock time itself - in UTC every time of the day exists
  const format = createDateTimeFormat(locale, "UTC");

  return (day: Date, minutes: number) => {
    const date = new Date(0);
    date.setUTCFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    date.setUTCMinutes(minutes);
    return format.format(date);
  };
}

const formatRange = (format: Intl.DateTimeFormat, start: Date, end: Date) =>
  end > start ? format.formatRange(start, end) : format.format(start);

/**
 * A text of the column of a resource - `{resource}, {time}` of the locale,
 * e.g. "Room A, Thursday, September 24, 2026, 9:00 AM".
 */
export const withResource = (
  locale: Locale,
  resource: string | undefined,
  time: string,
) =>
  resource === undefined
    ? time
    : formatMessage(locale.messages.calendar.resourceTime, { resource, time });

/**
 * The day and the times from `start` to `end` for screen readers, e.g.
 * "Thursday, September 24, 2026, 9:00 – 10:00 AM".
 */
export const formatTimeRange = (start: Date, end: Date, locale: Locale) =>
  formatRange(createDateTimeFormat(locale), start, end);

/**
 * Names event tiles for screen readers - by their title and when they take
 * place: the day and the times, or the days of an all-day event, with the
 * resource of the event among `resources`. Its formatters are made once, so
 * a calendar makes one labeler for all its tiles.
 */
export function createEventLabeler(
  locale: Locale,
  resources?: CalendarResource[],
) {
  const { messages } = locale;
  const resourceTitles = new Map(
    resources?.map((resource) => [resource.id, resource.title]),
  );
  let dayFormat: Intl.DateTimeFormat | undefined;
  let timeFormat: Intl.DateTimeFormat | undefined;

  return (event: CalendarEvent) => {
    let time: string;

    if (event.allDay) {
      dayFormat ??= createDayFormat(locale);
      // The days the views show it on. The end is exclusive - an event
      // ending at midnight is over the day before.
      const { end, start } = getAllDayRange(event);
      const lastDay = new Date(Math.max(start.getTime(), end.getTime() - 1));
      time = `${formatRange(dayFormat, startOfDay(start), startOfDay(lastDay))}, ${messages.calendar.allDay}`;
    } else {
      timeFormat ??= createDateTimeFormat(locale);
      time = formatRange(timeFormat, event.start, event.end);
    }

    return formatMessage(messages.calendar.eventLabel, {
      time: withResource(
        locale,
        event.resourceId === undefined
          ? undefined
          : resourceTitles.get(event.resourceId),
        time,
      ),
      title: event.title,
    });
  };
}

/** The accessible name of one event tile - see `createEventLabeler`. */
export const formatEventLabel = (event: CalendarEvent, locale: Locale) =>
  createEventLabeler(locale)(event);

/**
 * Text for a tile's native `title` tooltip. When the event carries an explicit
 * `tooltip` it is shown on its own - the event's own text is already visible
 * on the tile. Week and day tiles are absolutely positioned, so they cannot
 * be wrapped in the `Tooltip` component the way the month tiles are.
 */
export function getEventTooltipText(event: CalendarEvent): string {
  return event.tooltip ?? event.title;
}

const bgStyles: Record<string, string> = {
  red: "bg-red-100 dark:bg-red-900",
  green: "bg-green-100 dark:bg-green-900",
  blue: "bg-blue-100 dark:bg-blue-900",
  yellow: "bg-yellow-100 dark:bg-yellow-900",
  primary: "bg-primary-100 dark:bg-primary-900",
  purple: "bg-purple-100 dark:bg-purple-900",
  gray: "bg-neutral-200 dark:bg-neutral-700",
  lightgreen: "bg-lime-100 dark:bg-lime-900",
};

const textStyles: Record<string, string> = {
  red: "text-red-800 dark:text-red-200",
  green: "text-green-800 dark:text-green-200",
  blue: "text-blue-800 dark:text-blue-200",
  yellow: "text-yellow-800 dark:text-yellow-200",
  primary: "text-primary-800 dark:text-primary-200",
  purple: "text-purple-800 dark:text-purple-200",
  gray: "text-neutral-600 dark:text-neutral-300",
  lightgreen: "text-lime-800 dark:text-lime-200",
};

const borderStyles: Record<string, string> = {
  red: "border-red-500",
  green: "border-green-500",
  blue: "border-blue-500",
  yellow: "border-yellow-500",
  primary: "border-primary-500",
  purple: "border-purple-500",
  gray: "border-neutral-400",
  lightgreen: "border-lime-500",
};

/**
 * The color of an event - its own, or the one of its resource among
 * `resources`.
 */
export function createEventColorResolver(resources?: CalendarResource[]) {
  const colors = new Map<string, string>();
  for (const resource of resources ?? []) {
    if (resource.color) colors.set(resource.id, resource.color);
  }

  return (event: CalendarEvent): string | undefined =>
    event.color ??
    (event.resourceId === undefined ? undefined : colors.get(event.resourceId));
}

export const getColorStyles = (color?: string) => {
  const colorKey = color && color in bgStyles ? color : "primary";

  return [bgStyles[colorKey], textStyles[colorKey], borderStyles[colorKey]];
};
