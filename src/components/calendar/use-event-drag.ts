import type { CalendarEvent, EventTimeChange } from "./types";
import { atHour, clampDate, daysBetween } from "./date-utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, startOfDay } from "../../utils/date";

/** Pixels the pointer may move before a press on an event becomes a drag. */
const DRAG_THRESHOLD = 5;

export type DragType = "move" | "resize-top" | "resize-bottom";

export interface DragState {
  event: CalendarEvent;
  type: DragType;
  initialY: number;
  initialX: number;
  initialStart: Date;
  initialEnd: Date;
  currentStart: Date;
  currentEnd: Date;
  /** Day offset from initial position (for cross-column dragging) */
  dayOffset: number;
}

interface UseEventDragOptions {
  /**
   * Height of one slot in pixels (e.g., 64px for 30min slots in week view, 128px for 1hr in day view)
   */
  slotHeight: number;
  /**
   * Duration of one slot in minutes (e.g., 30 for week view, 60 for day view)
   */
  slotDurationMinutes: number;
  /**
   * Minimum event duration in minutes
   */
  minEventDurationMinutes?: number;
  /**
   * Start hour of the calendar (e.g., 7 for 7:00)
   */
  startHour: number;
  /**
   * End hour of the calendar (e.g., 22 for 22:00)
   */
  endHour: number;
  /**
   * Width of one day column in pixels (for cross-column dragging)
   */
  dayColumnWidth?: number;
  /**
   * First and last day an event may be moved to - the enabled days of the
   * visible week. Without it events stay on their day.
   */
  dropDays?: { first: Date; last: Date };
  /**
   * Callback when event is dropped (moved)
   */
  onEventDrop?: (change: EventTimeChange) => void;
  /**
   * Callback when event is resized
   */
  onEventResize?: (change: EventTimeChange) => void;
}

export default function useEventDrag({
  slotHeight,
  slotDurationMinutes,
  minEventDurationMinutes = 15,
  startHour,
  endHour,
  dayColumnWidth = 0,
  dropDays,
  onEventDrop,
  onEventResize,
}: UseEventDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wasDraggedRef = useRef<boolean>(false);

  /**
   * Snaps minutes to the nearest slot boundary
   */
  const snapToSlot = useCallback(
    (date: Date): Date => {
      const result = new Date(date);
      const minutes = result.getMinutes();
      const snappedMinutes =
        Math.round(minutes / slotDurationMinutes) * slotDurationMinutes;
      result.setMinutes(snappedMinutes, 0, 0);
      return result;
    },
    [slotDurationMinutes],
  );

  /**
   * Converts Y offset in pixels to minutes
   */
  const pixelsToMinutes = useCallback(
    (pixels: number): number => {
      return (pixels / slotHeight) * slotDurationMinutes;
    },
    [slotHeight, slotDurationMinutes],
  );

  /**
   * Starts a drag operation - on a press with the mouse, a pen or a finger
   */
  const handleDragStart = useCallback(
    (e: React.PointerEvent, event: CalendarEvent, type: DragType) => {
      // The primary button only - a right click opens the context menu
      if (e.button !== 0 || !e.isPrimary) return;
      e.stopPropagation();

      wasDraggedRef.current = false;
      // The moves and the release come to the pressed element even when
      // the pointer leaves it - so does the click that follows
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // A pointer that is gone already
      }

      setDragState({
        event,
        type,
        initialY: e.clientY,
        initialX: e.clientX,
        initialStart: new Date(event.start),
        initialEnd: new Date(event.end),
        currentStart: new Date(event.start),
        currentEnd: new Date(event.end),
        dayOffset: 0,
      });
    },
    [],
  );

  /**
   * Handles pointer move during drag
   */
  const handleDragMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState) return;

      const deltaY = e.clientY - dragState.initialY;
      const deltaX = e.clientX - dragState.initialX;

      // The pointer jittering during a click moves nothing
      if (!wasDraggedRef.current) {
        if (
          Math.abs(deltaY) <= DRAG_THRESHOLD &&
          Math.abs(deltaX) <= DRAG_THRESHOLD
        ) {
          return;
        }
        wasDraggedRef.current = true;
      }

      const { initialEnd, initialStart } = dragState;
      const deltaMinutes = pixelsToMinutes(deltaY);
      const minDuration = minEventDurationMinutes * 60 * 1000;

      // Day offset for cross-column dragging, onto the days allowed
      let dayOffset = 0;
      if (dragState.type === "move" && dayColumnWidth > 0 && dropDays) {
        const eventDay = startOfDay(initialStart);
        dayOffset = Math.min(
          Math.max(
            Math.round(deltaX / dayColumnWidth),
            daysBetween(eventDay, dropDays.first),
          ),
          daysBetween(eventDay, dropDays.last),
        );
      }

      // The hours of the event's (target) day - an end hour of 24 is the
      // midnight ending it, not 24:00 of the next day
      const day = addDays(initialStart, dayOffset);
      const dayStart = atHour(day, startHour);
      const dayEnd = atHour(day, endHour);

      let newStart = new Date(initialStart);
      let newEnd = new Date(initialEnd);

      if (dragState.type === "move") {
        const duration = initialEnd.getTime() - initialStart.getTime();
        const shiftedStart = addDays(initialStart, dayOffset);
        const shiftedEnd = shiftedStart.getTime() + duration;

        // Snap the distance, not the start - an event at 9:10 moves by whole
        // slots and keeps its minutes
        const snappedDelta =
          Math.round(deltaMinutes / slotDurationMinutes) *
          slotDurationMinutes *
          60_000;

        // Only the distance is limited, never the event cut: a drag does not
        // take the event out of the hours shown, but a part already out of
        // them (6:00 - 8:00 from 7:00 on) stays out, and the event keeps its
        // length
        const delta = Math.min(
          Math.max(
            snappedDelta,
            Math.min(0, dayStart.getTime() - shiftedStart.getTime()),
          ),
          Math.max(0, dayEnd.getTime() - shiftedEnd),
        );

        newStart = new Date(shiftedStart.getTime() + delta);
        newEnd = new Date(shiftedEnd + delta);
      } else if (dragState.type === "resize-top") {
        // The edge moves from where it is drawn - the top of the grid for an
        // event starting before the hours shown
        const edge = clampDate(initialStart, dayStart, dayEnd);
        edge.setMinutes(edge.getMinutes() + deltaMinutes);
        const snapped = snapToSlot(edge);

        // Dragged past the top of the grid, a start out of view stays
        newStart =
          snapped > dayStart
            ? snapped
            : initialStart < dayStart
              ? new Date(initialStart)
              : dayStart;

        // Ensure minimum duration
        const maxStart = new Date(initialEnd.getTime() - minDuration);
        if (newStart > maxStart) {
          newStart = maxStart;
        }
      } else if (dragState.type === "resize-bottom") {
        const edge = clampDate(initialEnd, dayStart, dayEnd);
        edge.setMinutes(edge.getMinutes() + deltaMinutes);
        const snapped = snapToSlot(edge);

        // Dragged past the bottom of the grid, an end out of view stays
        newEnd =
          snapped < dayEnd
            ? snapped
            : initialEnd > dayEnd
              ? new Date(initialEnd)
              : dayEnd;

        // Ensure minimum duration
        const minEnd = new Date(initialStart.getTime() + minDuration);
        if (newEnd < minEnd) {
          newEnd = minEnd;
        }
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentStart: newStart,
              currentEnd: newEnd,
              dayOffset,
            }
          : null,
      );
    },
    [
      dragState,
      dayColumnWidth,
      dropDays,
      endHour,
      pixelsToMinutes,
      slotDurationMinutes,
      snapToSlot,
      startHour,
      minEventDurationMinutes,
    ],
  );

  /**
   * Ends the drag operation. A press without a drag is left to the click
   * that follows it.
   */
  const handleDragEnd = useCallback(
    (cancelled = false) => {
      if (!dragState) return;

      const hasChanged =
        dragState.currentStart.getTime() !== dragState.initialStart.getTime() ||
        dragState.currentEnd.getTime() !== dragState.initialEnd.getTime();

      if (wasDraggedRef.current && hasChanged && !cancelled) {
        const change: EventTimeChange = {
          event: dragState.event,
          newStart: dragState.currentStart,
          newEnd: dragState.currentEnd,
        };

        if (dragState.type === "move") {
          onEventDrop?.(change);
        } else {
          onEventResize?.(change);
        }
      }

      if (wasDraggedRef.current) {
        // The flag swallows the click that ends the drag - it comes right
        // after the release, if at all, so it does not outlive this task
        setTimeout(() => {
          wasDraggedRef.current = false;
        });
      }

      setDragState(null);
    },
    [dragState, onEventDrop, onEventResize],
  );

  // Global pointer handlers while dragging
  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (e: PointerEvent) => handleDragMove(e);
    const onPointerUp = () => handleDragEnd();
    // The browser took the touch over, e.g. for a zoom - the drag is off
    const onPointerCancel = () => handleDragEnd(true);

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [dragState, handleDragMove, handleDragEnd]);

  /**
   * Set global cursor during resize operations
   */
  useEffect(() => {
    if (
      dragState &&
      (dragState.type === "resize-top" || dragState.type === "resize-bottom")
    ) {
      // Add a style tag to override all cursor styles
      const style = document.createElement("style");
      style.id = "calendar-resize-cursor";
      style.textContent = "* { cursor: ns-resize !important; }";
      document.head.appendChild(style);
      return () => {
        style.remove();
      };
    }
  }, [dragState]);

  /**
   * Gets current display times for an event (uses drag state if being dragged)
   */
  const getEventDisplayTimes = useCallback(
    (event: CalendarEvent): { start: Date; end: Date } => {
      if (dragState && dragState.event.id === event.id) {
        return {
          start: dragState.currentStart,
          end: dragState.currentEnd,
        };
      }
      return {
        start: event.start,
        end: event.end,
      };
    },
    [dragState],
  );

  /**
   * Checks if an event is currently being dragged
   */
  const isDragging = useCallback(
    (eventId: string): boolean => {
      return dragState?.event.id === eventId;
    },
    [dragState],
  );

  /**
   * Returns whether a drag operation just completed (to prevent click events)
   */
  const wasDragged = useCallback((): boolean => {
    return wasDraggedRef.current;
  }, []);

  /**
   * Resets the wasDragged flag (call after handling click prevention)
   */
  const resetWasDragged = useCallback(() => {
    wasDraggedRef.current = false;
  }, []);

  return {
    dragState,
    containerRef,
    handleDragStart,
    getEventDisplayTimes,
    isDragging,
    isAnyDragging: dragState !== null,
    wasDragged,
    resetWasDragged,
  };
}
