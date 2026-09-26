import type { WeekDay } from "../../i18n/types";

/**
 * `month`, `week` and `day` - the grids; `agenda` - a list of the events of
 * a period, grouped by day (see `agendaPeriod`).
 */
export type CalendarView = "month" | "week" | "day" | "agenda";

/**
 * What the agenda view lists: the `month`, the `week` (of the locale) or the
 * `day` of the current date, or a number of days starting with it.
 */
export type CalendarAgendaPeriod = "day" | "week" | "month" | number;

/**
 * Colors of an event tile: `primary` (default), `red`, `green`, `blue`,
 * `yellow`, `purple`, `gray` and `lightgreen`.
 */
export type CalendarEventColor =
  | "primary"
  | "red"
  | "green"
  | "blue"
  | "yellow"
  | "purple"
  | "gray"
  | "lightgreen";

/**
 * A rule an event repeats by - a subset of the iCalendar `RRULE`. The event
 * itself is the first occurrence; the others take its clock time (also over
 * a daylight saving change) and its length. Days a month or a year does not
 * have (the 31st, February 29) are skipped, not moved. The clock is the one
 * of the browser's time zone - the calendar knows no other: a series planned
 * at 9:00 in Prague is 3:00 in New York, and stays 3:00 there also in the
 * weeks the two change to summer time on different days, when it is 8:00 in
 * Prague. Expand series of other time zones on the server if they must keep
 * their own clock.
 */
export interface CalendarRecurrence {
  /** Repeats every day, week, month or year - times `interval`. */
  freq: "daily" | "weekly" | "monthly" | "yearly";
  /** Every how many days, weeks, months or years. Default 1. */
  interval?: number;
  /**
   * How many times the event takes place, the event itself included - the
   * occurrences `exdates` leave out count too.
   */
  count?: number;
  /**
   * The last day or moment an occurrence may start - inclusive. A date
   * without a time (a local midnight, or a UTC one like
   * `new Date("2026-12-31")`) includes the whole day. A UTC midnight at the
   * clock time of the event is that moment instead - the start of its last
   * occurrence, the way iCalendar gives `UNTIL` (a 19:00 event in New York
   * starts at a UTC midnight). A local midnight
   * (`new Date(2026, 11, 31)`) always means the whole day.
   */
  until?: Date;
  /**
   * Days of the week. `weekly`: the days of each week (default: the day of
   * the event); `monthly` / `yearly`: every such day of the month / year, or
   * with `nth` one of them - `{ day: 1, nth: 1 }` is the first Monday,
   * `{ day: 5, nth: -1 }` the last Friday; `daily`: only these days.
   */
  byWeekday?: (WeekDay | { day: WeekDay; nth: number })[];
  /**
   * Days of the month, `1` - `31` or `-1` (the last) - `-31`, for `monthly`
   * and `yearly` (default: the day of the event); `daily`: only these days.
   */
  byMonthDay?: number[];
  /**
   * Months, `1` - `12`. `yearly`: the months of each year (default: the
   * month of the event); the other rules: only these months.
   */
  byMonth?: number[];
  /**
   * Picks from the days each period gives - `1` the first, `-1` the last:
   * `{ freq: "monthly", byWeekday: [1, 2, 3, 4, 5], bySetPos: [-1] }` is the
   * last working day of each month.
   */
  bySetPos?: number[];
  /**
   * The day weeks start on for `weekly` rules with an `interval` over 1 -
   * which days are one week. Default 1 (Monday), as in iCalendar.
   */
  weekStart?: WeekDay;
}

export interface CalendarEvent {
  /**
   * An event of whole days - shown in the header of the week and day views
   * and in the month view, on every day it spans. `end` is exclusive: a
   * one-day event of September 24 runs from September 24 00:00 to
   * September 25 00:00. Give local midnights (`new Date(2026, 8, 24)`).
   * Dates parsed from `YYYY-MM-DD` strings (`new Date("2026-09-24")`) are
   * UTC midnights - when both `start` and `end` are, the event takes their
   * UTC calendar days, so it does not show on a day too many away from UTC.
   */
  allDay?: boolean;
  /**
   * One of `CalendarEventColor` - unknown values fall back to `primary`.
   * Without it the event takes the `color` of its resource.
   */
  color?: CalendarEventColor | (string & {});
  /** End of the event - exclusive. */
  end: Date;
  /**
   * Starts of occurrences left out of `recurrence` - the `occurrenceStart`
   * of a deleted occurrence. For an all-day event any time of the day.
   */
  exdates?: Date[];
  /**
   * Unique id of the event. The calendar gives each occurrence of a
   * recurring event an id of its own (`"<id>@<ISO start>"`).
   */
  id: string;
  /**
   * Set on an occurrence of a recurring event: when it takes place by the
   * rule - the value to put in `exdates`. An event of the app with it and
   * `recurringEventId` (an edited occurrence) replaces that occurrence.
   */
  occurrenceStart?: Date;
  /**
   * Repeats the event - a `CalendarRecurrence` or an iCalendar `RRULE`
   * (`"FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10"`, with or without `RRULE:`) of the
   * parts FREQ (DAILY to YEARLY), INTERVAL, COUNT, UNTIL, BYDAY (also
   * `1MO`, `-1FR`), BYMONTHDAY, BYMONTH, BYSETPOS and WKST. The calendar
   * shows the occurrences of the visible range; a rule it cannot read shows
   * the event once.
   */
  recurrence?: CalendarRecurrence | string;
  /**
   * Set on an occurrence of a recurring event: the `id` of the event it
   * repeats - tells a click, drop or resize of one occurrence from one of
   * the whole series.
   */
  recurringEventId?: string;
  /**
   * The `id` of the resource the event belongs to - its column in the day
   * and week views with `resources`. Events of no resource are left out of
   * those columns.
   */
  resourceId?: string;
  /** Start of the event. */
  start: Date;
  /**
   * Text of the tile. Together with the time it also names the tile for
   * screen readers.
   */
  title: string;
  /**
   * Rich title rendered as HTML instead of `title`. It is reduced to inline
   * formatting - `b`, `strong`, `i`, `em`, `u`, `s`, `small`, `mark`,
   * `sub`, `sup`, `span`, `br` and links - so it can run no scripts; keep
   * `title` as its plain text. Elements other than links keep only
   * text-styling classes (colors, font, decoration, padding, …), so a title
   * cannot position anything over the page. It is sanitized in the browser
   * - a server renders the plain `title`.
   */
  htmlTitle?: string;
  /** Time shown after the title in the month view tooltip, e.g. `"9:00 – 10:30"`. */
  timeText?: string;
  /**
   * Text shown on hover instead of the event's own text - e.g. what the
   * color of the tile stands for. Left out when the tile needs no
   * explanation.
   */
  tooltip?: string;
  /** Any data of the app - available in the callbacks. */
  [key: string]: unknown;
}

/**
 * Something events are planned for - a room, a person, a vehicle. With
 * `resources` the day and week views show a column for each.
 */
export interface CalendarResource {
  /**
   * Color of its events without a `color` of their own, and of the mark in
   * its column header - one of `CalendarEventColor`.
   */
  color?: CalendarEventColor | (string & {});
  /** Unique id - the `resourceId` of its events. */
  id: string;
  /** Name in the column header - also for screen readers. */
  title: string;
  /** Any data of the app. */
  [key: string]: unknown;
}

export interface EventTimeChange {
  /** The event as it was before the drag. */
  event: CalendarEvent;
  /** The new start of the event. */
  newStart: Date;
  /** The new end of the event. */
  newEnd: Date;
  /**
   * The resource of the column the event was dropped in - the one it was in
   * for a resize. Only with `resources`.
   */
  newResourceId?: string;
}

export interface NewEventTimeRange {
  /** Start of the range - the start of its first slot. */
  start: Date;
  /** End of the range - the end of its last slot. */
  end: Date;
  /** The resource of the column the range was picked in - only with `resources`. */
  resourceId?: string;
}

export interface CalendarViewProps {
  /** What the agenda view lists. */
  agendaPeriod: CalendarAgendaPeriod;
  /** The day the view shows (week and month views: the period around it). */
  currentDate: Date;
  /** Hour the week and day views end with (1 - 24). */
  dayEndHour: number;
  /** First hour of the week and day views (0 - 23). */
  dayStartHour: number;
  /**
   * The events, ordered by `sortEvents` - all-day ones first. Recurring
   * events are replaced by their occurrences in `visibleRange`.
   */
  events: CalendarEvent[];
  /** The color of an event - its own, or that of its resource. */
  getEventColor: (event: CalendarEvent) => string | undefined;
  /** The accessible name of an event tile (`createEventLabeler`). */
  getEventLabel: (event: CalendarEvent) => string;
  /**
   * Return false to render an event as non-interactive - no pointer cursor and
   * `onEventClick` is not called. Defaults to clickable.
   */
  isEventClickable?: (event: CalendarEvent) => boolean;
  /** Shows a spinner over the view. */
  loading?: boolean;
  /** Days after it are disabled. */
  maxDate?: Date;
  /** Days before it are disabled. */
  minDate?: Date;
  /**
   * A day (month and agenda views) or a time slot (week and day views) was
   * picked - with the resource of its column.
   */
  onDateClick?: (date: Date, resourceId?: string) => void;
  /** An event tile was clicked. */
  onEventClick?: (event: CalendarEvent) => void;
  /**
   * Moves the calendar to another date - Page Up / Down of the month view;
   * not to a period out of `minDate` - `maxDate`. Returns whether it moved.
   */
  onNavigate?: (date: Date) => boolean;
  /** An event was dragged to another time or day. */
  onEventDrop?: (change: EventTimeChange) => void;
  /** An event was resized by its top or bottom edge. */
  onEventResize?: (change: EventTimeChange) => void;
  /** A range of time slots was picked, e.g. to create an event. */
  onSlotDragEnd?: (range: NewEventTimeRange) => void;
  /**
   * Per-event controls rendered in the top-right corner of a tile, revealed on
   * hover. Presses and clicks never reach the tile underneath, so an action
   * here neither starts a drag nor triggers `onEventClick`.
   */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  /** Icon rendered before the title of a tile. */
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
  /** The columns of the day and week views - none when empty. */
  resources?: CalendarResource[];
  /** Keeps the weekday header visible while the view scrolls. */
  stickyHeader?: boolean;
  /** The days the view paints - `getVisibleRange`. */
  visibleRange: { end: Date; start: Date };
}
