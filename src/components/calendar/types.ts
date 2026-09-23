export type CalendarView = "month" | "week" | "day";

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

export interface CalendarEvent {
  /** Shown in the day header of the day view and on every day it spans in the month view. */
  allDay?: boolean;
  /** One of `CalendarEventColor` - unknown values fall back to `primary`. */
  color?: CalendarEventColor | (string & {});
  /** End of the event. */
  end: Date;
  /** Unique id of the event. */
  id: string;
  /** Start of the event. */
  start: Date;
  /** Text of the tile. */
  title: string;
  /**
   * Rich title rendered as HTML instead of `title`. It is reduced to inline
   * formatting - `b`, `strong`, `i`, `em`, `u`, `s`, `small`, `mark`,
   * `sub`, `sup`, `span`, `br` and links - so it can run no scripts; keep
   * `title` as its plain text. Elements other than links keep only
   * text-styling classes (colors, font, decoration, padding, …), so a title
   * cannot position anything over the page.
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

export interface EventTimeChange {
  event: CalendarEvent;
  newStart: Date;
  newEnd: Date;
}

export interface NewEventTimeRange {
  start: Date;
  end: Date;
}

export interface CalendarViewProps {
  currentDate: Date;
  /** Hour the week and day views end with (1 - 24). */
  dayEndHour: number;
  /** First hour of the week and day views (0 - 23). */
  dayStartHour: number;
  events: CalendarEvent[];
  /**
   * Return false to render an event as non-interactive - no pointer cursor and
   * `onEventClick` is not called. Defaults to clickable.
   */
  isEventClickable?: (event: CalendarEvent) => boolean;
  loading?: boolean;
  maxDate?: Date;
  minDate?: Date;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventDrop?: (change: EventTimeChange) => void;
  onEventResize?: (change: EventTimeChange) => void;
  onSlotDragEnd?: (range: NewEventTimeRange) => void;
  /**
   * Per-event controls rendered in the top-right corner of a tile, revealed on
   * hover. Clicks never reach the tile underneath, so an action here does not
   * also trigger `onEventClick`.
   */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
  stickyHeader?: boolean;
}
