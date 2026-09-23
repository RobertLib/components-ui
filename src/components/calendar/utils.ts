import type { CalendarEvent } from "./types";
import { atHour, minutesIntoDay } from "./date-utils";
import { addDays, isSameDay, startOfDay } from "../../utils/date";

/**
 * Whether an event shows on `day`: it starts on it or runs into it. An event
 * ending at the midnight that starts `day` belongs to the day before.
 */
export function isOnDay(event: { end: Date; start: Date }, day: Date) {
  const dayStart = startOfDay(day);

  return (
    isSameDay(event.start, day) ||
    (event.start < addDays(dayStart, 1) && event.end > dayStart)
  );
}

/**
 * Whether a timed event goes on past the midnight ending its first day - it
 * then shows on each of its days, and the grid of one day cannot drag it.
 */
export const spansMidnight = (event: CalendarEvent) =>
  event.end > atHour(event.start, 24);

/**
 * Makes a clickable tile operable from the keyboard - it takes the focus,
 * and Enter or Space open it like a click.
 */
export const clickableTileProps = (onActivate: () => void) => ({
  onKeyDown: (event: React.KeyboardEvent) => {
    // Not the keys of the event actions inside the tile
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onActivate();
  },
  role: "button" as const,
  tabIndex: 0,
});

export interface OverlapInfo {
  /** Index of this event within overlapping group (0 = first/bottom, 1 = second, etc.) */
  index: number;
  /** Total number of events in the overlapping group */
  totalInGroup: number;
}

/**
 * Checks if two events overlap in time
 */
export function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Calculates overlap positioning for events that share time slots.
 * First event in each group takes full width, subsequent events are layered on top
 * with increasing left offset (each taking progressively less width).
 * Returns a map of event ID to overlap info (index in group and total count).
 */
export function calculateOverlapPositions(
  events: CalendarEvent[],
): Map<string, OverlapInfo> {
  const result = new Map<string, OverlapInfo>();

  if (events.length === 0) return result;

  // Sort events by start time, then by end time (longer events first)
  const sortedEvents = [...events].sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime();
    if (startDiff !== 0) return startDiff;
    return b.end.getTime() - a.end.getTime(); // Longer events first
  });

  // Find all overlapping groups
  const groups: CalendarEvent[][] = [];
  const processed = new Set<string>();

  for (const event of sortedEvents) {
    if (processed.has(event.id)) continue;

    // Find all events that overlap with this event (directly or transitively)
    const group: CalendarEvent[] = [];
    const toProcess = [event];

    while (toProcess.length > 0) {
      const current = toProcess.pop()!;
      if (processed.has(current.id)) continue;

      processed.add(current.id);
      group.push(current);

      // Find all events that overlap with current
      for (const other of sortedEvents) {
        if (!processed.has(other.id) && eventsOverlap(current, other)) {
          toProcess.push(other);
        }
      }
    }

    if (group.length > 0) {
      groups.push(group);
    }
  }

  // Assign index within each group (sorted by start time, longer events first for same start)
  for (const group of groups) {
    // Sort group by start time, then by duration (longer first)
    group.sort((a, b) => {
      const startDiff = a.start.getTime() - b.start.getTime();
      if (startDiff !== 0) return startDiff;
      return b.end.getTime() - a.end.getTime();
    });

    const totalInGroup = group.length;
    group.forEach((event, index) => {
      result.set(event.id, { index, totalInGroup });
    });
  }

  return result;
}

/**
 * The part of an event from `start` to `end` inside the hours shown for
 * `day`, in minutes since its midnight - `null` when no part of it is. An
 * event ending at the next midnight ends at 24:00.
 */
export function getVisibleMinutes(
  start: Date,
  end: Date,
  day: Date,
  startHour: number,
  endHour: number,
): { from: number; to: number } | null {
  const from = minutesIntoDay(day, start);
  const to = minutesIntoDay(day, end);

  if (from >= endHour * 60 || to <= startHour * 60) return null;

  return {
    from: Math.max(from, startHour * 60),
    to: Math.min(to, endHour * 60),
  };
}

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

export const getColorStyles = (color?: string) => {
  const colorKey = color && color in bgStyles ? color : "primary";

  return [bgStyles[colorKey], textStyles[colorKey], borderStyles[colorKey]];
};
