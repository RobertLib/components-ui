import type { NewEventTimeRange } from "./types";
import { atHour, clampDate } from "./date-utils";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SlotDragState {
  /** The date of the slot where drag started */
  startDate: Date;
  /** Current end date based on pointer position */
  currentEndDate: Date;
  /** Initial Y position when drag started */
  initialY: number;
}

interface UseSlotDragOptions {
  /**
   * Height of one slot in pixels
   */
  slotHeight: number;
  /**
   * Duration of one slot in minutes
   */
  slotDurationMinutes: number;
  /**
   * End hour of the calendar
   */
  endHour: number;
  /**
   * Callback when slot drag ends
   */
  onSlotDragEnd?: (range: NewEventTimeRange) => void;
}

export default function useSlotDrag({
  slotHeight,
  slotDurationMinutes,
  endHour,
  onSlotDragEnd,
}: UseSlotDragOptions) {
  const [dragState, setDragState] = useState<SlotDragState | null>(null);
  const isDraggingRef = useRef(false);

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
   * Starts a slot drag operation - with the mouse or a pen. A finger on the
   * slots scrolls the view, its tap is a click.
   */
  const handleSlotDragStart = useCallback(
    (e: React.PointerEvent, slotDate: Date) => {
      // The primary button only - a right click opens the context menu
      if (!onSlotDragEnd || e.button !== 0 || !e.isPrimary) return;
      if (e.pointerType === "touch") return;

      e.preventDefault();
      isDraggingRef.current = false;
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // A pointer that is gone already
      }

      // The range ends by the end hour at the latest - a press on the row
      // of the end hour starts the last slot before it
      const dayEnd = atHour(slotDate, endHour);
      const lastStart = new Date(dayEnd);
      lastStart.setMinutes(lastStart.getMinutes() - slotDurationMinutes);
      const startDate = slotDate > lastStart ? lastStart : slotDate;

      // Default end is one slot after start
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + slotDurationMinutes);

      setDragState({
        startDate,
        currentEndDate: endDate > dayEnd ? dayEnd : endDate,
        initialY: e.clientY,
      });
    },
    [endHour, onSlotDragEnd, slotDurationMinutes],
  );

  /**
   * Handles pointer move during slot drag
   */
  const handleSlotDragMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState) return;

      const deltaY = e.clientY - dragState.initialY;

      // Mark as dragging if there's significant movement
      if (Math.abs(deltaY) > 5) {
        isDraggingRef.current = true;
      }

      const deltaMinutes = pixelsToMinutes(deltaY);

      // Calculate new end time
      let newEnd = new Date(dragState.startDate);
      newEnd.setMinutes(
        newEnd.getMinutes() + slotDurationMinutes + deltaMinutes,
      );
      // At least one slot, at most to the end hour of the slot's day - an
      // end hour of 24 is the midnight ending it. The end hour wins: the
      // range never runs past the hours shown.
      const dayEnd = atHour(dragState.startDate, endHour);
      const minEnd = new Date(dragState.startDate);
      minEnd.setMinutes(minEnd.getMinutes() + slotDurationMinutes);
      newEnd = clampDate(
        snapToSlot(newEnd),
        minEnd > dayEnd ? dayEnd : minEnd,
        dayEnd,
      );

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentEndDate: newEnd,
            }
          : null,
      );
    },
    [dragState, endHour, pixelsToMinutes, slotDurationMinutes, snapToSlot],
  );

  /**
   * Ends the slot drag operation
   */
  const handleSlotDragEnd = useCallback(
    (cancelled = false) => {
      if (!dragState) return;

      // Only call callback if actually dragged
      if (isDraggingRef.current && !cancelled) {
        onSlotDragEnd?.({
          start: dragState.startDate,
          end: dragState.currentEndDate,
        });
      }

      if (isDraggingRef.current) {
        // The flag stays set for the click that follows the release - the
        // slot's click handler resets it, or this task ending does
        setTimeout(() => {
          isDraggingRef.current = false;
        });
      }

      setDragState(null);
    },
    [dragState, onSlotDragEnd],
  );

  /**
   * Returns whether a drag just completed (to prevent click)
   */
  const wasSlotDragged = useCallback((): boolean => {
    return isDraggingRef.current;
  }, []);

  /**
   * Resets the drag flag
   */
  const resetSlotDragged = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Global pointer handlers while dragging
  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (e: PointerEvent) => handleSlotDragMove(e);
    const onPointerUp = () => handleSlotDragEnd();
    const onPointerCancel = () => handleSlotDragEnd(true);

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [dragState, handleSlotDragMove, handleSlotDragEnd]);

  return {
    slotDragState: dragState,
    handleSlotDragStart,
    isSlotDragging: dragState !== null,
    wasSlotDragged,
    resetSlotDragged,
  };
}
