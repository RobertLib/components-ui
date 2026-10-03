import { copyDate } from "../../utils/time-zone";
import type { NewEventTimeRange } from "./types";
import { atMinutes, minutesIntoDay } from "./date-utils";
import {
  isBusinessTime,
  type BusinessSchedule,
  type MinuteRange,
} from "./business-hours";
import { isDragPress, startPointerDrag } from "./pointer-drag";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

/** The clock hours a normalized selection must stay inside. */
export interface TimeRangeLimits extends MinuteRange {
  /** Working hours when selection is restricted to them. */
  businessHours?: BusinessSchedule | null;
}

/**
 * The dates of a range of slots - with its resource. A range whose rows a
 * daylight saving change skips all (2:00 - 3:00 when the clocks jump to
 * 3:00) starts at the end of the gap and keeps its length. With `limits`,
 * returns `null` if that normalized range leaves the allowed clock hours.
 */
export function toTimeRange(range: SlotRange): NewEventTimeRange;
export function toTimeRange(
  range: SlotRange,
  limits: TimeRangeLimits,
): NewEventTimeRange | null;
export function toTimeRange(
  { day, from, resourceId, to }: SlotRange,
  limits?: TimeRangeLimits,
): NewEventTimeRange | null {
  const start = atMinutes(day, from);
  const clockEnd = atMinutes(day, to);
  const end =
    clockEnd > start
      ? clockEnd
      : copyDate(start, start.getTime() + (to - from) * 60_000);

  if (limits) {
    const actualFrom = minutesIntoDay(day, start);
    const actualTo = minutesIntoDay(day, end);
    if (
      end <= start ||
      actualFrom < limits.from ||
      actualTo > limits.to ||
      (limits.businessHours &&
        !isBusinessTime(limits.businessHours, day, actualFrom, actualTo))
    ) {
      return null;
    }
  }

  return {
    end,
    start,
    ...(resourceId !== undefined && { resourceId }),
  };
}

interface UseSlotDragOptions {
  /** The days, resources, hours and availability the selection belongs to. */
  geometryKey: string;
  /** Height of one slot in pixels. */
  slotHeight: number;
  /** Length of one slot in minutes. */
  slotDurationMinutes: number;
  /** Shown and working hours the normalized range must stay inside. */
  timeRangeLimits: TimeRangeLimits;
  /** The element holding the slots. */
  gridRef: React.RefObject<HTMLElement | null>;
  /** The scroll container of the view - scrolled along a drag at its edges. */
  scrollRef?: React.RefObject<HTMLElement | null>;
  /** A range was dragged over the slots - no drag without it. */
  onSlotDragEnd?: (range: NewEventTimeRange) => void;
  /**
   * The minutes a range from the slot at `anchor` may take - the working
   * hours around it (`restrictToBusinessHours`). Without it, the hours
   * shown.
   */
  getBounds?: (day: Date, anchor: number) => { from: number; to: number };
  /**
   * The axis the slots follow each other on - `x` in the timeline, which
   * runs to the left in a right-to-left page.
   */
  axis?: "x" | "y";
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
  const sessionRef = useRef<{
    geometryKey: string;
    stop: () => void;
  } | null>(null);

  // A release must never commit a selection from obsolete days or limits.
  // Update the callback before cancelling, and before pointer events can run.
  useLayoutEffect(() => {
    optionsRef.current = options;
    const session = sessionRef.current;
    if (
      session &&
      (session.geometryKey !== options.geometryKey || !options.onSlotDragEnd)
    ) {
      session.stop();
    }
  });

  // Activity can hide the view while preserving its state. Clear both the
  // listeners and the selected range so showing it starts with no session.
  useEffect(() => () => sessionRef.current?.stop(), []);

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
      axis = "y",
      getBounds,
      gridRef,
      onSlotDragEnd,
      scrollRef,
      slotDurationMinutes: slot,
      slotHeight,
      timeRangeLimits,
    } = optionsRef.current;
    if (!onSlotDragEnd || e.pointerType === "touch" || !isDragPress(e)) {
      return;
    }

    // The range ends by the end hour at the latest - a press on the row of
    // the end hour starts the last slot before it
    const grid = gridRef.current;
    const rtl = !!grid && getComputedStyle(grid).direction === "rtl";
    const anchor = Math.min(minutes, timeRangeLimits.to - slot);
    const bounds = getBounds?.(day, anchor) ?? {
      from: timeRangeLimits.from,
      to: timeRangeLimits.to,
    };
    let range: SlotRange = { day, from: anchor, resourceId, to: anchor + slot };
    if (!toTimeRange(range, timeRangeLimits)) return;

    // No text is selected along the drag
    e.preventDefault();
    sessionRef.current?.stop();
    setSlotDragState(range);

    const finish = () => {
      sessionRef.current = null;
      setSlotDragState(null);
    };

    const stopDrag = startPointerDrag(e, {
      axis,
      grid,
      scroller: scrollRef?.current,
      scrollSideways: axis === "x",
      onMove: ({ x, y }) => {
        const distance = axis === "x" ? (rtl ? -x : x) : y;
        // The slot under the pointer - within the hours shown, or the
        // working hours around the first one
        const lowest =
          anchor - Math.floor(Math.max(0, anchor - bounds.from) / slot) * slot;
        const highest =
          anchor +
          Math.floor(Math.max(0, bounds.to - anchor - slot) / slot) * slot;
        let other = Math.min(
          Math.max(anchor + Math.round(distance / slotHeight) * slot, lowest),
          highest,
        );
        const rangeTo = (edge: number): SlotRange => ({
          day,
          from: Math.min(anchor, edge),
          resourceId,
          to: Math.max(anchor, edge) + slot,
        });
        // Normalizing skipped rows may extend the actual time past a
        // boundary. Stop at the last whole-slot selection that still fits.
        while (
          other !== anchor &&
          !toTimeRange(rangeTo(other), timeRangeLimits)
        ) {
          other += other < anchor ? slot : -slot;
        }
        const { from, to } = rangeTo(other);
        if (from === range.from && to === range.to) return;

        range = { day, from, resourceId, to };
        setSlotDragState(range);
      },
      onDrop: () => {
        finish();
        const times = toTimeRange(range, optionsRef.current.timeRangeLimits);
        if (times) optionsRef.current.onSlotDragEnd?.(times);
        return true;
      },
      onCancel: finish,
    });
    sessionRef.current = {
      geometryKey: optionsRef.current.geometryKey,
      stop: () => {
        stopDrag();
        finish();
      },
    };
  };

  return { handleSlotDragStart, slotDragState };
}
