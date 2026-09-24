import type { CalendarEvent, EventTimeChange } from "./types";
import { atMinutes, isSameDay, minutesIntoDay } from "./date-utils";
import {
  isDragPress,
  startPointerDrag,
  type PointerDragOffset,
} from "./pointer-drag";
import { useEffect, useRef, useState } from "react";
import { startOfDay } from "../../utils/date";

export type DragType = "move" | "resize-top" | "resize-bottom";

/** A dragged event and the times a drop would give it. */
export interface DragState {
  /** The dragged event. */
  event: CalendarEvent;
  /** A move, or a resize by the top or the bottom edge. */
  type: DragType;
  /** The start the event would get. */
  start: Date;
  /** The end the event would get. */
  end: Date;
  /** The resource the event would get - that of the column it is over. */
  resourceId?: string;
}

/** A column of the grid - an event moved sideways goes to another one. */
export interface DragColumn {
  /** The day of the column. */
  day: Date;
  /** No event may be dropped in it - a day out of `minDate` - `maxDate`. */
  disabled?: boolean;
  /** The resource of the column. */
  resourceId?: string;
}

/** Where an event is shown - a dragged one where a drop would put it. */
export interface EventDisplay {
  end: Date;
  resourceId?: string;
  start: Date;
}

interface UseEventDragOptions {
  /**
   * Height of one slot in pixels (64 for the half hours of the week view,
   * 128 for the hours of the day view).
   */
  slotHeight: number;
  /** Length of one slot in minutes (30 in the week view, 60 in the day view). */
  slotDurationMinutes: number;
  /** The shortest length a resize leaves an event with, in minutes. */
  minEventDurationMinutes?: number;
  /** First hour of the grid (e.g. 7 for 7:00). */
  startHour: number;
  /** Hour the grid ends with (e.g. 22 for 22:00 - 24 is the midnight). */
  endHour: number;
  /**
   * The columns of the grid, left to right - the days of the week, the
   * resources of the day, or the resources of each day of the week. A move
   * sideways takes an event to another enabled one - its day and resource.
   * Without them events stay in their column.
   */
  columns?: DragColumn[];
  /** The element holding the day columns. */
  gridRef: React.RefObject<HTMLElement | null>;
  /** The scroll container of the view - scrolled along a drag at its edges. */
  scrollRef?: React.RefObject<HTMLElement | null>;
  /** An event was moved. */
  onEventDrop?: (change: EventTimeChange) => void;
  /** An event was resized. */
  onEventResize?: (change: EventTimeChange) => void;
}

/** What a drag works with - fixed at the press. */
interface DragGeometry {
  /** The column of the event. */
  column: number;
  /** Width of a column in pixels, 0 when the event stays in its column. */
  columnWidth: number;
  /** The columns of the grid. */
  columns: DragColumn[];
  /** The end of the event before the drag. */
  end: Date;
  /** Hour the grid ends with. */
  endHour: number;
  /** Midnight starting the event's day. */
  eventDay: Date;
  /** The start in clock minutes since `eventDay`. */
  from: number;
  /** The last column a move may go to. */
  maxColumn: number;
  /** The first column a move may go to. */
  minColumn: number;
  /** The shortest length a resize leaves, in minutes. */
  minEventDurationMinutes: number;
  /** Length of a slot in minutes. */
  slotDurationMinutes: number;
  /** Height of a slot in pixels. */
  slotHeight: number;
  /** The start of the event before the drag. */
  start: Date;
  /** First hour of the grid. */
  startHour: number;
  /** The end in clock minutes since `eventDay`. */
  to: number;
  /** A move, or a resize by the top or the bottom edge. */
  type: DragType;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** `minutes` after the midnight of `day`, with the seconds of `time`. */
function atMinutesOf(time: Date, day: Date, minutes: number) {
  const result = atMinutes(day, minutes);
  result.setSeconds(time.getSeconds(), time.getMilliseconds());
  return result;
}

/**
 * The times of the dragged event with the pointer `offset` from the press.
 * The distance is snapped to whole slots, not the edges - an event at 9:10
 * moves to 9:40 and keeps its minutes, and a jitter of a few pixels changes
 * nothing. It is measured on the clock the rows show: over a daylight saving
 * change four rows down from 1:00 is 3:00. A moved event keeps its length
 * in absolute time, and a resize never leaves it shorter than the minimum -
 * a time the clocks skip is not taken for a length. A move sideways goes
 * by whole columns - to their day and resource.
 */
function getDragTimes(
  drag: DragGeometry,
  offset: PointerDragOffset,
): EventDisplay {
  const resourceId = drag.columns[drag.column]?.resourceId;
  const unchanged = { end: drag.end, resourceId, start: drag.start };
  const distance =
    Math.round(offset.y / drag.slotHeight) * drag.slotDurationMinutes;
  const top = drag.startHour * 60;
  const bottom = drag.endHour * 60;

  if (drag.type === "move") {
    const column =
      drag.columnWidth > 0
        ? clamp(
            drag.column + Math.round(offset.x / drag.columnWidth),
            drag.minColumn,
            drag.maxColumn,
          )
        : drag.column;
    // The day of the column - an event that can be dragged is on its own
    // day only, so it moves there also over a day the time zone skips
    const day =
      column === drag.column ? drag.eventDay : drag.columns[column].day;
    const target = drag.columns[column]?.resourceId;
    // Only the distance is limited, never the event cut: a drag does not
    // take the event out of the hours shown, but a part already out of
    // them (6:00 - 8:00 from 7:00 on) stays out, and the event keeps its
    // length
    const delta = clamp(
      distance,
      Math.min(0, top - drag.from),
      Math.max(0, bottom - drag.to),
    );
    if (isSameDay(day, drag.eventDay) && delta === 0 && target === resourceId) {
      return unchanged;
    }

    // The start goes by the rows, the end keeps the length of the event -
    // in a daylight saving gap a row is no time at all, in a repeated hour
    // it is twice as long
    const start = atMinutesOf(drag.start, day, drag.from + delta);
    return {
      end: new Date(
        start.getTime() + drag.end.getTime() - drag.start.getTime(),
      ),
      resourceId: target,
      start,
    };
  }

  if (distance === 0) return unchanged;

  if (drag.type === "resize-top") {
    // The edge moves from where it is drawn - the top of the grid for an
    // event starting before the hours shown
    let from = clamp(drag.from, top, bottom) + distance;
    // Dragged past the top of the grid, a start out of view stays
    if (from <= top) from = Math.min(drag.from, top);
    // Not shorter than the minimum - an event shorter already only grows
    from = Math.min(
      from,
      Math.max(drag.from, drag.to - drag.minEventDurationMinutes),
    );
    if (from === drag.from) return unchanged;

    // The same in absolute time - a start in a daylight saving gap goes to
    // its end, maybe the end of the event
    const start = atMinutesOf(drag.start, drag.eventDay, from);
    const latest = Math.max(
      drag.start.getTime(),
      drag.end.getTime() - drag.minEventDurationMinutes * 60_000,
    );
    return {
      end: drag.end,
      resourceId,
      start: start.getTime() > latest ? new Date(latest) : start,
    };
  }

  let to = clamp(drag.to, top, bottom) + distance;
  // Dragged past the bottom of the grid, an end out of view stays
  if (to >= bottom) to = Math.max(drag.to, bottom);
  to = Math.max(
    to,
    Math.min(drag.to, drag.from + drag.minEventDurationMinutes),
  );
  if (to === drag.to) return unchanged;

  // The same in absolute time - in the hour the clocks go back to, the
  // clock time after a start in its second run is first the earlier one
  const end = atMinutesOf(drag.end, drag.eventDay, to);
  const earliest = Math.min(
    drag.end.getTime(),
    drag.start.getTime() + drag.minEventDurationMinutes * 60_000,
  );
  return {
    end: end.getTime() < earliest ? new Date(earliest) : end,
    resourceId,
    start: drag.start,
  };
}

/** Whether a drop at `times` changes nothing of the event. */
const isUnchanged = (drag: DragGeometry, times: EventDisplay) =>
  times.start.getTime() === drag.start.getTime() &&
  times.end.getTime() === drag.end.getTime() &&
  times.resourceId === drag.columns[drag.column]?.resourceId;

/** The resize cursor everywhere - also where the pointer leaves the tile. */
function addResizeCursor() {
  const style = document.createElement("style");
  style.id = "calendar-resize-cursor";
  style.textContent = "* { cursor: ns-resize !important; }";
  document.head.appendChild(style);
  return style;
}

/**
 * Moving and resizing the events of the week and day views by the pointer.
 * The view renders the dragged event at `getEventDisplayTimes` - the state
 * changes only when it gets to another slot, not with every pixel.
 */
export default function useEventDrag(options: UseEventDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  // A drag outlives the render it started in - it reads the latest options
  const optionsRef = useRef(options);
  // Ends the drag in progress without a drop
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => () => stopRef.current?.(), []);

  /**
   * Starts a drag - on a press with the mouse, a pen or a finger - of an
   * event in the column with the index `columnIndex` (default the first).
   */
  const handleDragStart = (
    e: React.PointerEvent,
    event: CalendarEvent,
    type: DragType,
    columnIndex?: number,
  ) => {
    if (!isDragPress(e)) return;
    // A handle, not the tile under it
    e.stopPropagation();
    stopRef.current?.();

    const {
      columns = [],
      endHour,
      gridRef,
      minEventDurationMinutes = 15,
      scrollRef,
      slotDurationMinutes,
      slotHeight,
      startHour,
    } = optionsRef.current;
    const grid = gridRef.current;
    const column = columnIndex ?? 0;
    const eventDay = startOfDay(event.start);
    // Events are dropped in the enabled columns only - the days of
    // `minDate` - `maxDate`, which follow each other
    const enabled = columns.flatMap((item, index) =>
      item.disabled ? [] : [index],
    );
    const minColumn = enabled[0] ?? column;
    const maxColumn = enabled[enabled.length - 1] ?? column;

    const drag: DragGeometry = {
      column,
      // An event of a column the drop is not allowed in stays in it - it
      // does not jump into the nearest allowed one
      columnWidth:
        grid && columns.length > 1 && enabled.includes(column)
          ? grid.offsetWidth / columns.length
          : 0,
      columns,
      end: event.end,
      endHour,
      eventDay,
      from: minutesIntoDay(eventDay, event.start),
      maxColumn,
      minColumn,
      minEventDurationMinutes,
      slotDurationMinutes,
      slotHeight,
      start: event.start,
      startHour,
      to: minutesIntoDay(eventDay, event.end),
      type,
    };
    // A grid of resources reports the resource of every change
    const hasResources = columns[column]?.resourceId !== undefined;

    // The times a drop gives - live, not those of the last render
    let current: EventDisplay | null = null;
    // The event was shown at other times along the way - its release is no
    // click, also back where it started
    let moved = false;
    let cursorStyle: HTMLStyleElement | null = null;

    const finish = () => {
      stopRef.current = null;
      cursorStyle?.remove();
      setDragState(null);
    };

    const stopDrag = startPointerDrag(e, {
      grid,
      scroller: scrollRef?.current,
      // To the columns scrolled out of view - a phone shows only a few
      scrollSideways: type === "move" && drag.columnWidth > 0,
      onMove: (offset) => {
        const next = getDragTimes(drag, offset);
        if (
          current &&
          next.start.getTime() === current.start.getTime() &&
          next.end.getTime() === current.end.getTime() &&
          next.resourceId === current.resourceId
        ) {
          return;
        }

        if (!current && type !== "move") cursorStyle = addResizeCursor();
        current = next;
        if (!isUnchanged(drag, next)) moved = true;
        setDragState({ ...next, event, type });
      },
      onDrop: () => {
        finish();
        if (!current || isUnchanged(drag, current)) return moved;

        const change: EventTimeChange = {
          event,
          newEnd: current.end,
          newStart: current.start,
          ...(hasResources && { newResourceId: current.resourceId }),
        };
        const { onEventDrop, onEventResize } = optionsRef.current;
        if (type === "move") {
          onEventDrop?.(change);
        } else {
          onEventResize?.(change);
        }
        return true;
      },
      onCancel: finish,
    });

    stopRef.current = () => {
      stopDrag();
      cursorStyle?.remove();
    };
  };

  return {
    dragState,
    handleDragStart,
    /**
     * The times and the resource an event is shown at - a dragged one where
     * it is dragged to.
     */
    getEventDisplayTimes: (event: CalendarEvent): EventDisplay =>
      dragState?.event.id === event.id
        ? {
            end: dragState.end,
            resourceId: dragState.resourceId,
            start: dragState.start,
          }
        : { end: event.end, resourceId: event.resourceId, start: event.start },
    isAnyDragging: dragState !== null,
    /** Whether the event is being dragged. */
    isDragging: (eventId: string) => dragState?.event.id === eventId,
  };
}
