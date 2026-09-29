import type { CalendarEvent } from "./types";
import {
  addCalendarDays,
  atMinutes,
  daysBetween,
  isSameDay,
  minutesIntoDay,
} from "./date-utils";
import { getAllDayRange } from "./utils";
import type { PointerDragOffset } from "./pointer-drag";
import { startOfDay } from "../../utils/date";

/** A move, or a resize by the start or the end edge. */
export type DragType = "move" | "resize-start" | "resize-end";

/** Where an event is shown - a dragged one where a drop would put it. */
export interface EventDisplay {
  end: Date;
  resourceId?: string;
  start: Date;
}

/**
 * How far an event is moved - in whole steps across (`x`: columns, days,
 * slots of a timeline) and down (`y`: slots, weeks, resources). A positive
 * `x` goes on to the next column, also in a right-to-left page.
 */
export interface MoveSteps {
  x: number;
  y: number;
}

/**
 * How an event moves in a view - what the pointer and the arrow keys do to
 * it. Made at the press, or when the keys pick the event up.
 */
export interface MoveGeometry {
  /** The directions it moves in - `x` only along a row of days. */
  axis: "both" | "x" | "y";
  /**
   * The times (and the resource) the event gets `steps` away - those it has
   * for none. Never outside the enabled days and the hours shown.
   */
  compute: (steps: MoveSteps) => EventDisplay;
  /** The resize cursor shown along the whole drag. */
  cursor?: "ew-resize" | "ns-resize";
  /** The element the pointer is measured in - the slots or the days. */
  grid: HTMLElement | null;
  /** The change reports the resource - a view of resources. */
  hasResources: boolean;
  /** The view scrolls sideways at its edges - to columns out of view. */
  scrollSideways: boolean;
  /** The steps of the pointer `offset` pixels away from the press. */
  toSteps: (offset: PointerDragOffset) => MoveSteps;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Steps of `distance` pixels of `size` each - 0 without a size. */
const stepsOf = (distance: number, size: number) =>
  size > 0 ? Math.round(distance / size) : 0;

/** `minutes` after the midnight of `day`, with the seconds of `time`. */
export function atMinutesOf(time: Date, day: Date, minutes: number) {
  const result = atMinutes(day, minutes);
  result.setSeconds(time.getSeconds(), time.getMilliseconds());
  return result;
}

/** `date` moved by `days` calendar days - at the same clock time. */
export const shiftByDays = (date: Date, days: number) =>
  days === 0
    ? date
    : atMinutesOf(
        date,
        addCalendarDays(date, days),
        minutesIntoDay(startOfDay(date), date),
      );

/**
 * The times of `event` moved by `days` whole days. An all-day event keeps
 * its days - also one of UTC midnights (`getAllDayRange`), which stays one;
 * a timed event its clock time and its length in absolute time, also over
 * a daylight saving change.
 */
export function shiftEventByDays(
  event: CalendarEvent,
  days: number,
): { end: Date; start: Date } {
  if (days === 0) return { end: event.end, start: event.start };

  if (event.allDay) {
    const range = getAllDayRange(event);
    if (range.start !== event.start) {
      const shiftUTC = (date: Date) =>
        new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + days,
          ),
        );
      return { end: shiftUTC(event.end), start: shiftUTC(event.start) };
    }
    return {
      end: shiftByDays(event.end, days),
      start: shiftByDays(event.start, days),
    };
  }

  const start = shiftByDays(event.start, days);
  return {
    end: new Date(
      start.getTime() + event.end.getTime() - event.start.getTime(),
    ),
    start,
  };
}

/** A column of a time grid - an event moved sideways goes to another one. */
export interface GridColumn {
  /** The day of the column. */
  day: Date;
  /** No event may be dropped in it - a day out of `minDate` - `maxDate`. */
  disabled?: boolean;
  /** The resource of the column. */
  resourceId?: string;
}

interface GridGeometryOptions {
  /** The column of the event. */
  column: number;
  /**
   * The columns of the grid, left to right - the days of the week, the
   * resources of the day, or the resources of each day of the week.
   */
  columns: GridColumn[];
  /** Hour the grid ends with (24 is the midnight). */
  endHour: number;
  event: CalendarEvent;
  /** The element holding the columns. */
  grid: HTMLElement | null;
  /** The shortest length a resize leaves, in minutes. */
  minDuration: number;
  /** The page is laid out right to left - the columns too. */
  rtl: boolean;
  /** Length of a slot in minutes. */
  slotDuration: number;
  /** Height of a slot in pixels. */
  slotHeight: number;
  /** First hour of the grid. */
  startHour: number;
  type: DragType;
}

/**
 * How an event moves in the time grid of the week and day views: down by
 * whole slots, sideways by whole columns - to their day and resource. The
 * distance is snapped to whole slots, not the edges - an event at 9:10 moves
 * to 9:40 and keeps its minutes. It is measured on the clock the rows show:
 * over a daylight saving change four rows down from 1:00 is 3:00. A moved
 * event keeps its length in absolute time, and a resize never leaves it
 * shorter than the minimum - a time the clocks skip is not taken for a
 * length.
 */
export function createGridGeometry({
  column,
  columns,
  endHour,
  event,
  grid,
  minDuration,
  rtl,
  slotDuration,
  slotHeight,
  startHour,
  type,
}: GridGeometryOptions): MoveGeometry {
  const eventDay = startOfDay(event.start);
  const from = minutesIntoDay(eventDay, event.start);
  const to = minutesIntoDay(eventDay, event.end);
  const top = startHour * 60;
  const bottom = endHour * 60;
  // Events are dropped in the enabled columns only - the days of
  // `minDate` - `maxDate`, which follow each other
  const enabled = columns.flatMap((item, index) =>
    item.disabled ? [] : [index],
  );
  const minColumn = enabled[0] ?? column;
  const maxColumn = enabled[enabled.length - 1] ?? column;
  // An event of a column the drop is not allowed in stays in it - it does
  // not jump into the nearest allowed one
  const sideways =
    type === "move" && columns.length > 1 && enabled.includes(column);
  const columnWidth = sideways && grid ? grid.offsetWidth / columns.length : 0;
  const resourceId = columns[column]?.resourceId;
  const unchanged: EventDisplay = {
    end: event.end,
    resourceId,
    start: event.start,
  };

  const compute = ({ x, y }: MoveSteps): EventDisplay => {
    const distance = y * slotDuration;

    if (type === "move") {
      const target = sideways
        ? clamp(column + x, minColumn, maxColumn)
        : column;
      // The day of the column - an event that can be dragged is on its own
      // day only, so it moves there also over a day the time zone skips
      const day = target === column ? eventDay : columns[target].day;
      const targetResource = columns[target]?.resourceId;
      // Only the distance is limited, never the event cut: a drag does not
      // take the event out of the hours shown, but a part already out of
      // them (6:00 - 8:00 from 7:00 on) stays out, and the event keeps its
      // length
      const delta = clamp(
        distance,
        Math.min(0, top - from),
        Math.max(0, bottom - to),
      );
      if (
        isSameDay(day, eventDay) &&
        delta === 0 &&
        targetResource === resourceId
      ) {
        return unchanged;
      }

      // The start goes by the rows, the end keeps the length of the event
      // - in a daylight saving gap a row is no time at all, in a repeated
      // hour it is twice as long
      const start = atMinutesOf(event.start, day, from + delta);
      return {
        end: new Date(
          start.getTime() + event.end.getTime() - event.start.getTime(),
        ),
        resourceId: targetResource,
        start,
      };
    }

    if (distance === 0) return unchanged;

    if (type === "resize-start") {
      // The edge moves from where it is drawn - the top of the grid for an
      // event starting before the hours shown
      let edge = clamp(from, top, bottom) + distance;
      // Dragged past the top of the grid, a start out of view stays
      if (edge <= top) edge = Math.min(from, top);
      // Not shorter than the minimum - an event shorter already only grows
      edge = Math.min(edge, Math.max(from, to - minDuration));
      if (edge === from) return unchanged;

      // The same in absolute time - a start in a daylight saving gap goes
      // to its end, maybe the end of the event
      const start = atMinutesOf(event.start, eventDay, edge);
      const latest = Math.max(
        event.start.getTime(),
        event.end.getTime() - minDuration * 60_000,
      );
      return {
        end: event.end,
        resourceId,
        start: start.getTime() > latest ? new Date(latest) : start,
      };
    }

    let edge = clamp(to, top, bottom) + distance;
    // Dragged past the bottom of the grid, an end out of view stays
    if (edge >= bottom) edge = Math.max(to, bottom);
    edge = Math.max(edge, Math.min(to, from + minDuration));
    if (edge === to) return unchanged;

    // The same in absolute time - in the hour the clocks go back to, the
    // clock time after a start in its second run is first the earlier one
    const end = atMinutesOf(event.end, eventDay, edge);
    const earliest = Math.min(
      event.end.getTime(),
      event.start.getTime() + minDuration * 60_000,
    );
    return {
      end: end.getTime() < earliest ? new Date(earliest) : end,
      resourceId,
      start: event.start,
    };
  };

  return {
    axis: sideways ? "both" : "y",
    compute,
    cursor: type === "move" ? undefined : "ns-resize",
    grid,
    // A grid of resources reports the resource of every change
    hasResources: resourceId !== undefined,
    // To the columns scrolled out of view - a phone shows only a few
    scrollSideways: sideways,
    toSteps: (offset) => ({
      x: stepsOf(offset.x, columnWidth) * (rtl ? -1 : 1),
      y: stepsOf(offset.y, slotHeight),
    }),
  };
}

/** A day an event can be moved to - of the month, or a column of days. */
export interface DayCell {
  /** The day - its start. */
  day: Date;
  /** No event may be dropped on it - a day out of `minDate` - `maxDate`. */
  disabled?: boolean;
  /** The resource of the column. */
  resourceId?: string;
}

interface DayGeometryOptions {
  /**
   * The cells in the order they are laid out, row by row - `null` for a
   * day the time zone skips.
   */
  cells: (DayCell | null)[];
  /** The number of cells in a row. */
  columns: number;
  event: CalendarEvent;
  /** The element holding the cells - in rows of `columns`. */
  grid: HTMLElement | null;
  /** A change reports the resource of the cell. */
  hasResources: boolean;
  /** The cell of the tile moved. */
  index: number;
  /** The page is laid out right to left - the cells too. */
  rtl: boolean;
}

/**
 * How an event moves by whole days - over the days of the month, or the
 * columns of the all-day row of the week and day views (to their resource
 * too). It keeps its clock time and length; an all-day event stays one.
 * Only onto the enabled days.
 */
export function createDayGeometry({
  cells,
  columns,
  event,
  grid,
  hasResources,
  index,
  rtl,
}: DayGeometryOptions): MoveGeometry {
  const rows = Math.ceil(cells.length / columns);
  const enabled = cells.flatMap((cell, cellIndex) =>
    cell && !cell.disabled ? [cellIndex] : [],
  );
  const origin = cells[index];
  const resourceId = hasResources ? origin?.resourceId : event.resourceId;
  const unchanged: EventDisplay = {
    end: event.end,
    resourceId,
    start: event.start,
  };
  const movable = !!origin && !origin.disabled;
  const cellWidth = grid && movable ? grid.offsetWidth / columns : 0;
  const cellHeight = grid && movable && rows > 1 ? grid.offsetHeight / rows : 0;

  const compute = ({ x, y }: MoveSteps): EventDisplay => {
    if (!origin || origin.disabled || enabled.length === 0) return unchanged;

    const target = clamp(
      index + y * columns + x,
      enabled[0],
      enabled[enabled.length - 1],
    );
    const cell = cells[target];
    if (!cell || cell.disabled) return unchanged;

    const days = daysBetween(origin.day, cell.day);
    const targetResource = hasResources ? cell.resourceId : resourceId;
    if (days === 0 && targetResource === resourceId) return unchanged;

    return { ...shiftEventByDays(event, days), resourceId: targetResource };
  };

  return {
    axis: rows > 1 ? "both" : "x",
    compute,
    grid,
    hasResources,
    scrollSideways: rows === 1,
    toSteps: (offset) => ({
      x: stepsOf(offset.x, cellWidth) * (rtl ? -1 : 1),
      y: stepsOf(offset.y, cellHeight),
    }),
  };
}

/** The days of a timeline and its hours - the time across it. */
export interface TimelineAxis {
  /** The days shown, in order - local midnights. */
  days: { day: Date; disabled?: boolean }[];
  /** Hour each day ends with (24 is the midnight). */
  endHour: number;
  /** Length of a slot in minutes. */
  slotDuration: number;
  /** Hour each day starts with. */
  startHour: number;
}

/** Minutes of the hours shown of a day of the timeline. */
const minutesPerDay = (axis: TimelineAxis) =>
  (axis.endHour - axis.startHour) * 60;

/**
 * Where `date` is on the timeline - minutes of the hours shown from its
 * start. A time out of the hours shown (the night, a hidden day) is at the
 * end of the day before it or the start of the day after.
 */
export function timelinePosition(axis: TimelineAxis, date: Date) {
  const perDay = minutesPerDay(axis);
  for (let index = 0; index < axis.days.length; index++) {
    const { day } = axis.days[index];
    if (date < day) return index * perDay;
    if (date < addCalendarDays(day, 1)) {
      const minutes = clamp(
        minutesIntoDay(day, date) - axis.startHour * 60,
        0,
        perDay,
      );
      return index * perDay + minutes;
    }
  }
  return axis.days.length * perDay;
}

/**
 * The date at `position` minutes of the timeline - of the hours shown, with
 * the seconds of `time`. With `asEnd`, a position between two days is the
 * end of the first, not the start of the next.
 */
export function timelineDate(
  axis: TimelineAxis,
  position: number,
  time: Date,
  asEnd = false,
) {
  const perDay = minutesPerDay(axis);
  let index = Math.floor(position / perDay);
  let minutes = position - index * perDay;
  if ((asEnd && minutes === 0 && index > 0) || index >= axis.days.length) {
    index -= 1;
    minutes = perDay;
  }
  index = clamp(index, 0, axis.days.length - 1);
  return atMinutesOf(time, axis.days[index].day, axis.startHour * 60 + minutes);
}

interface TimelineGeometryOptions {
  axis: TimelineAxis;
  event: CalendarEvent;
  /** The element holding the rows - the pointer is measured in it. */
  grid: HTMLElement | null;
  /** The shortest length a resize leaves, in minutes. */
  minDuration: number;
  /**
   * Where the pointer pressed the tile, in pixels from the top of `grid` -
   * the row under the pointer is found from it.
   */
  pressY?: number;
  /** The row of the tile. */
  row: number;
  /** The resources of the rows - `undefined` for a timeline without them. */
  rows: (string | undefined)[];
  /** The page is laid out right to left - so is the timeline. */
  rtl: boolean;
  /** Width of a slot in pixels. */
  slotWidth: number;
  type: DragType;
}

/** The row of `grid` at `y` pixels from its top - by its `data-row`. */
function rowAt(grid: HTMLElement | null, y: number): number | null {
  if (!grid) return null;
  const rows = Array.from(
    grid.querySelectorAll<HTMLElement>(":scope > [data-row]"),
  );
  for (const [index, row] of rows.entries()) {
    if (y < row.offsetTop + row.offsetHeight || index === rows.length - 1) {
      return Number(row.dataset.row);
    }
  }
  return null;
}

/**
 * How an event moves in the resource timeline: across by whole slots of
 * the hours shown - on to the next day after the last one - and down to the
 * rows of other resources; a resize moves one edge by whole slots. A timed
 * event keeps its length in absolute time; an all-day one moves by whole
 * days (the width of a day) and stays one. Only onto the enabled days.
 */
export function createTimelineGeometry({
  axis,
  event,
  grid,
  minDuration,
  pressY,
  row,
  rows,
  rtl,
  slotWidth,
  type,
}: TimelineGeometryOptions): MoveGeometry {
  const perDay = minutesPerDay(axis);
  const resourceId = rows[row];
  const unchanged: EventDisplay = {
    end: event.end,
    resourceId,
    start: event.start,
  };
  const enabled = axis.days.flatMap((day, index) =>
    day.disabled ? [] : [index],
  );
  // The enabled days follow each other - the part of the timeline they take
  const first = (enabled[0] ?? 0) * perDay;
  const last = ((enabled[enabled.length - 1] ?? -1) + 1) * perDay;
  const from = timelinePosition(axis, event.start);
  const to = timelinePosition(axis, event.end);
  const dayOf = (position: number) =>
    clamp(Math.floor(position / perDay), 0, axis.days.length - 1);
  const onEnabledDay = !axis.days[dayOf(from)]?.disabled;
  const movesRows = type === "move" && rows.length > 1;
  // The start is on a day shown, in its hours
  const startDay = axis.days.find(({ day }) => isSameDay(day, event.start));
  const startMinutes = startDay && minutesIntoDay(startDay.day, event.start);
  const startsInView =
    startMinutes !== undefined &&
    startMinutes >= axis.startHour * 60 &&
    startMinutes < axis.endHour * 60;

  const compute = ({ x, y }: MoveSteps): EventDisplay => {
    if (!onEnabledDay || enabled.length === 0) return unchanged;

    const target = movesRows ? clamp(row + y, 0, rows.length - 1) : row;
    const targetResource = rows[target];
    const distance = x * axis.slotDuration;

    if (type === "move") {
      if (event.allDay) {
        // By whole days - `x` counts days here
        const day = clamp(
          dayOf(from) + x,
          enabled[0],
          enabled[enabled.length - 1],
        );
        const days = daysBetween(
          axis.days[dayOf(from)].day,
          axis.days[day].day,
        );
        if (days === 0 && targetResource === resourceId) return unchanged;
        return { ...shiftEventByDays(event, days), resourceId: targetResource };
      }

      // A start in the hours shown moves along them - on to the next day;
      // one out of them by the clock of its day, not onto the edge
      const start =
        distance === 0
          ? event.start
          : startsInView
            ? timelineDate(
                axis,
                clamp(
                  from + distance,
                  first,
                  Math.max(first, last - axis.slotDuration),
                ),
                event.start,
              )
            : atMinutesOf(
                event.start,
                startOfDay(event.start),
                minutesIntoDay(startOfDay(event.start), event.start) + distance,
              );
      if (
        start.getTime() === event.start.getTime() &&
        targetResource === resourceId
      ) {
        return unchanged;
      }
      return {
        end: new Date(
          start.getTime() + event.end.getTime() - event.start.getTime(),
        ),
        resourceId: targetResource,
        start,
      };
    }

    if (distance === 0 || event.allDay) return unchanged;

    if (type === "resize-start") {
      const edge = clamp(
        from + distance,
        first,
        Math.max(first, to - minDuration),
      );
      if (edge === from) return unchanged;
      return {
        end: event.end,
        resourceId,
        start: timelineDate(axis, edge, event.start),
      };
    }

    const edge = clamp(to + distance, Math.min(last, from + minDuration), last);
    if (edge === to) return unchanged;
    return {
      end: timelineDate(axis, edge, event.end, true),
      resourceId,
      start: event.start,
    };
  };

  const dayWidth = (perDay / axis.slotDuration) * slotWidth;
  const stepWidth = event.allDay && type === "move" ? dayWidth : slotWidth;

  return {
    axis: movesRows ? "both" : "x",
    compute,
    cursor: type === "move" ? undefined : "ew-resize",
    grid,
    hasResources: resourceId !== undefined,
    scrollSideways: true,
    toSteps: (offset) => {
      const target =
        movesRows && pressY !== undefined
          ? rowAt(grid, pressY + offset.y)
          : null;
      return {
        x: stepsOf(offset.x, stepWidth) * (rtl ? -1 : 1),
        y: target === null ? 0 : target - row,
      };
    },
  };
}
