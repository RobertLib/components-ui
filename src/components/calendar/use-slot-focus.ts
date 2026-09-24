import { useEffect, useRef, useState } from "react";

interface UseSlotFocusOptions {
  /** Number of day columns. */
  days: number;
  /** The element holding the slots. */
  gridRef: React.RefObject<HTMLElement | null>;
  /** The column that has the tab stop at first, e.g. the selected day. */
  initialDay: number;
  /** Called with a slot picked by Enter or Space. */
  onActivate: (day: number, slot: number) => void;
  /**
   * Called with the slots `first` - `last` of a day, selected by Shift +
   * arrow up / down and picked by Enter or Space. Without it Shift selects
   * nothing.
   */
  onSelectRange?: (day: number, first: number, last: number) => void;
  /** Number of slots in a column. */
  slots: number;
}

interface SlotPosition {
  /** Index of the day column. */
  day: number;
  /** Index of the slot in the column. */
  slot: number;
}

/** The slot of an element with `data-slot="<day>-<slot>"`. */
function slotOf(target: EventTarget | null): SlotPosition | null {
  const value = target instanceof HTMLElement ? target.dataset.slot : undefined;
  if (!value) return null;

  const [day, slot] = value.split("-").map(Number);
  return { day, slot };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * The keyboard focus of the time grid of the week and day views. The grid
 * is one tab stop - the focused slot; the arrow keys move between the slots
 * (up, down) and the days (left, right), Home / End to the first and last
 * slot of the day, Enter or Space pick the slot. With `onSelectRange`,
 * Shift + arrow up / down select slots from the focused one, Enter or Space
 * pick them and Escape drops them. The keys go on from the slot that has
 * the focus - also one a click focused.
 */
export default function useSlotFocus({
  days,
  gridRef,
  initialDay,
  onActivate,
  onSelectRange,
  slots,
}: UseSlotFocusOptions) {
  const [focused, setFocused] = useState({ day: initialDay, slot: 0 });
  // The slot a Shift + arrow selection started at
  const [anchor, setAnchor] = useState<SlotPosition | null>(null);
  // Moved by a key - the slot takes the focus once it is rendered as such
  const moveFocusRef = useRef(false);

  // Fewer hours or days than before - the focus stays inside the grid
  const day = clamp(focused.day, 0, days - 1);
  const slot = clamp(focused.slot, 0, slots - 1);

  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;

    gridRef.current
      ?.querySelector<HTMLElement>(`[data-slot="${day}-${slot}"]`)
      ?.focus();
  }, [day, gridRef, slot]);

  const handleFocus = (event: React.FocusEvent) => {
    const target = slotOf(event.target);
    if (!target || (target.day === day && target.slot === slot)) return;

    // Focused by a click or a screen reader - the tab stop moves there
    setFocused(target);
    setAnchor(null);
  };

  const handleBlur = (event: React.FocusEvent) => {
    // The selection goes with the focus leaving the grid
    if (
      anchor &&
      !(
        event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget)
      )
    ) {
      setAnchor(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Only the slots - not the events over them
    const current = slotOf(event.target);
    if (!current) return;

    let next = current;

    switch (event.key) {
      case "ArrowUp":
        next = { day: current.day, slot: Math.max(current.slot - 1, 0) };
        break;
      case "ArrowDown":
        next = {
          day: current.day,
          slot: Math.min(current.slot + 1, slots - 1),
        };
        break;
      case "ArrowLeft":
        next = { day: Math.max(current.day - 1, 0), slot: current.slot };
        break;
      case "ArrowRight":
        next = {
          day: Math.min(current.day + 1, days - 1),
          slot: current.slot,
        };
        break;
      case "Home":
        next = { day: current.day, slot: 0 };
        break;
      case "End":
        next = { day: current.day, slot: slots - 1 };
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (anchor && onSelectRange) {
          setAnchor(null);
          onSelectRange(
            current.day,
            Math.min(anchor.slot, current.slot),
            Math.max(anchor.slot, current.slot),
          );
        } else {
          onActivate(current.day, current.slot);
        }
        return;
      case "Escape":
        if (!anchor) return;
        // It drops the selection, not a Dialog around
        event.preventDefault();
        setAnchor(null);
        return;
      default:
        return;
    }

    event.preventDefault();

    const selects =
      !!onSelectRange &&
      event.shiftKey &&
      (event.key === "ArrowUp" || event.key === "ArrowDown");
    if (selects) {
      if (!anchor) setAnchor(current);
    } else if (anchor) {
      setAnchor(null);
    }

    // At the edge of the grid the focus stays where it is
    if (next.day === current.day && next.slot === current.slot) return;

    moveFocusRef.current = true;
    setFocused(next);
  };

  return {
    handleBlur,
    handleFocus,
    handleKeyDown,
    /** Whether the slot is the tab stop of the grid. */
    isFocused: (slotDay: number, slotIndex: number) =>
      slotDay === day && slotIndex === slot,
    /** The slots selected with Shift + arrow keys, from `first` to `last`. */
    selection: anchor
      ? {
          day: anchor.day,
          first: Math.min(anchor.slot, slot),
          last: Math.max(anchor.slot, slot),
        }
      : null,
  };
}
