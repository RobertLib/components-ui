import { useRef } from "react";

/**
 * Tells a real move of the pointer from the mouse events of content
 * scrolling beneath a resting one: once the arrow keys scrolled a list, the
 * option scrolled under the pointer gets a mouse enter (Chrome) - some
 * browsers even send a move - and would take the highlight the keys moved.
 * The returned check is `true` for an event at another position than the
 * one it was last given.
 */
export default function usePointerMoved() {
  // The pointer position of the last event checked
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  return (event: React.MouseEvent) => {
    const { clientX: x, clientY: y } = event;
    const last = pointerRef.current;
    if (last && last.x === x && last.y === y) return false;

    pointerRef.current = { x, y };
    return true;
  };
}
