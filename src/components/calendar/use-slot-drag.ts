import type { NewEventTimeRange } from "./types";
import { atMinutes } from "./date-utils";
import { isDragPress, startPointerDrag } from "./pointer-drag";
import { useEffect, useRef, useState } from "react";

/** A range of time slots of one day - of one resource. */
export interface SlotRange {
  /** The day of the range. */
  day: Date;
  /**
   * Start of the range in minutes since the midnight starting `day` - on
   * the clock the rows show, also over a daylight saving change.
   */
  from: number;
  /** The resource of the column of the range. */
  resourceId?: string;
  /** End of the range in minutes since the midnight starting `day`. */
  to: number;
}

/**
 * The dates of a range of slots - with its resource. A range whose rows a
 * daylight saving change skips all (2:00 - 3:00 when the clocks jump to
 * 3:00) starts at the end of the gap and keeps its length - it never comes
 * out empty.
 */
export function toTimeRange({
  day,
  from,
  resourceId,
  to,
}: SlotRange): NewEventTimeRange {
  const start = atMinutes(day, from);
  const end = atMinutes(day, to);

  return {
    end: end > start ? end : new Date(start.getTime() + (to - from) * 60_000),
    start,
    ...(resourceId !== undefined && { resourceId }),
  };
}

interface UseSlotDragOptions {
  /** Height of one slot in pixels. */
  slotHeight: number;
  /** Length of one slot in minutes. */
  slotDurationMinutes: number;
  /** First hour of the grid. */
  startHour: number;
  /** Hour the grid ends with - a range never runs past it. */
  endHour: number;
  /** The element holding the slots. */
  gridRef: React.RefObject<HTMLElement | null>;
  /** The scroll container of the view - scrolled along a drag at its edges. */
  scrollRef?: React.RefObject<HTMLElement | null>;
  /** A range was dragged over the slots - no drag without it. */
  onSlotDragEnd?: (range: NewEventTimeRange) => void;
}

/**
 * Picking a range of empty slots by dragging over them - down or up from
 * the pressed slot, to the one under the pointer.
 */
export default function useSlotDrag(options: UseSlotDragOptions) {
  const [slotDragState, setSlotDragState] = useState<SlotRange | null>(null);
  // A drag outlives the render it started in - it reads the latest options
  const optionsRef = useRef(options);
  // Ends the drag in progress without a range
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => () => stopRef.current?.(), []);

  /**
   * Starts a range at the slot `minutes` after the midnight of `day` - in
   * the column of the resource `resourceId` - with the mouse or a pen. A
   * finger on the slots scrolls the view, its tap is a click.
   */
  const handleSlotDragStart = (
    e: React.PointerEvent,
    day: Date,
    minutes: number,
    resourceId?: string,
  ) => {
    const {
      endHour,
      gridRef,
      onSlotDragEnd,
      scrollRef,
      slotDurationMinutes: slot,
      slotHeight,
      startHour,
    } = optionsRef.current;
    if (!onSlotDragEnd || e.pointerType === "touch" || !isDragPress(e)) {
      return;
    }

    // No text is selected along the drag
    e.preventDefault();
    stopRef.current?.();

    // The range ends by the end hour at the latest - a press on the row of
    // the end hour starts the last slot before it
    const anchor = Math.min(minutes, endHour * 60 - slot);
    let range: SlotRange = { day, from: anchor, resourceId, to: anchor + slot };
    setSlotDragState(range);

    const finish = () => {
      stopRef.current = null;
      setSlotDragState(null);
    };

    stopRef.current = startPointerDrag(e, {
      axis: "y",
      grid: gridRef.current,
      scroller: scrollRef?.current,
      onMove: ({ y }) => {
        // The slot under the pointer - within the hours shown
        const other = Math.min(
          Math.max(anchor + Math.round(y / slotHeight) * slot, startHour * 60),
          endHour * 60 - slot,
        );
        const from = Math.min(anchor, other);
        const to = Math.max(anchor, other) + slot;
        if (from === range.from && to === range.to) return;

        range = { day, from, resourceId, to };
        setSlotDragState(range);
      },
      onDrop: () => {
        finish();
        optionsRef.current.onSlotDragEnd?.(toTimeRange(range));
        return true;
      },
      onCancel: finish,
    });
  };

  return { handleSlotDragStart, slotDragState };
}
