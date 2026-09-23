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
  /** Number of slots in a column. */
  slots: number;
}

/**
 * The keyboard focus of the time grid of the week and day views. The grid
 * is one tab stop - the focused slot; the arrow keys move between the slots
 * (up, down) and the days (left, right), Home / End to the first and last
 * slot of the day, Enter or Space pick the slot.
 */
export default function useSlotFocus({
  days,
  gridRef,
  initialDay,
  onActivate,
  slots,
}: UseSlotFocusOptions) {
  const [focused, setFocused] = useState({ day: initialDay, slot: 0 });
  // Moved by a key - the slot takes the focus once it is rendered as such
  const moveFocusRef = useRef(false);

  // Fewer hours or days than before - the focus stays inside the grid
  const day = Math.min(Math.max(focused.day, 0), days - 1);
  const slot = Math.min(Math.max(focused.slot, 0), slots - 1);

  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;

    gridRef.current
      ?.querySelector<HTMLElement>(`[data-slot="${day}-${slot}"]`)
      ?.focus();
  }, [day, gridRef, slot]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Only the slots - not the events over them
    if (!(event.target as HTMLElement).dataset.slot) return;

    let next = { day, slot };

    switch (event.key) {
      case "ArrowUp":
        next = { day, slot: Math.max(slot - 1, 0) };
        break;
      case "ArrowDown":
        next = { day, slot: Math.min(slot + 1, slots - 1) };
        break;
      case "ArrowLeft":
        next = { day: Math.max(day - 1, 0), slot };
        break;
      case "ArrowRight":
        next = { day: Math.min(day + 1, days - 1), slot };
        break;
      case "Home":
        next = { day, slot: 0 };
        break;
      case "End":
        next = { day, slot: slots - 1 };
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onActivate(day, slot);
        return;
      default:
        return;
    }

    event.preventDefault();
    // At the edge of the grid the focus stays where it is
    if (next.day === day && next.slot === slot) return;

    moveFocusRef.current = true;
    setFocused(next);
  };

  return {
    handleKeyDown,
    /** Whether the slot is the tab stop of the grid. */
    isFocused: (slotDay: number, slotIndex: number) =>
      slotDay === day && slotIndex === slot,
  };
}
