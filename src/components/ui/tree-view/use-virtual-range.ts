import { useCallback, useLayoutEffect, useRef, useState } from "react";

// Rows rendered before the tree is measured - also by the server
const INITIAL_ROWS = 30;

/** The rows to render - from `start` up to (without) `end`. */
export interface VirtualRange {
  end: number;
  start: number;
}

interface VirtualRangeOptions {
  /** Number of rows. */
  count: number;
  /** Renders only the rows in view - otherwise the range is not tracked. */
  enabled: boolean;
  /** Rows rendered above and below the view. */
  overscan: number;
  /** Height of every row, in pixels. */
  rowHeight: number;
}

/** The padding of `element` above its rows - they start below it. */
const paddingTop = (element: HTMLElement) =>
  parseFloat(getComputedStyle(element).paddingTop) || 0;

/**
 * The rows of a scroll container of rows of one height that are in view,
 * with `overscan` rows above and below - for a virtualized tree, which is
 * its own scroll container. Put `containerRef` on it.
 */
export default function useVirtualRange({
  count,
  enabled,
  overscan,
  rowHeight,
}: VirtualRangeOptions) {
  const [range, setRange] = useState<VirtualRange>({
    end: INITIAL_ROWS,
    start: 0,
  });
  const containerElementRef = useRef<HTMLElement | null>(null);
  // For the scroll handler, which runs between renders
  const optionsRef = useRef({ count, enabled, overscan, rowHeight });

  useLayoutEffect(() => {
    optionsRef.current = { count, enabled, overscan, rowHeight };
  });

  const update = useCallback(() => {
    const element = containerElementRef.current;
    const { count, enabled, overscan, rowHeight } = optionsRef.current;
    if (!element || !enabled) return;

    // Not laid out (yet) - as many rows as before a measurement
    const view = element.clientHeight || INITIAL_ROWS * rowHeight;
    const top = Math.max(0, element.scrollTop - paddingTop(element));
    const start = Math.min(
      count,
      Math.max(0, Math.floor(top / rowHeight) - overscan),
    );
    const end = Math.min(count, Math.ceil((top + view) / rowHeight) + overscan);

    setRange((previous) =>
      previous.start === start && previous.end === end
        ? previous
        : { end, start },
    );
  }, []);

  const containerRef = useCallback(
    (element: HTMLElement | null) => {
      containerElementRef.current = element;
      if (!element) return;

      element.addEventListener("scroll", update, { passive: true });
      // A taller view shows more rows
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(update);
      observer?.observe(element);

      return () => {
        element.removeEventListener("scroll", update);
        observer?.disconnect();
        if (containerElementRef.current === element) {
          containerElementRef.current = null;
        }
      };
    },
    [update],
  );

  // When the rows change - not after every render, which the new range
  // itself causes
  useLayoutEffect(() => {
    if (enabled) update();
  }, [count, enabled, overscan, rowHeight, update]);

  /**
   * Scrolls the row at `index` into view, by the nearest edge - it is
   * rendered with the next range.
   */
  const scrollToIndex = useCallback(
    (index: number) => {
      const element = containerElementRef.current;
      if (!element) return;

      const { rowHeight } = optionsRef.current;
      const top = paddingTop(element) + index * rowHeight;
      const bottom = top + rowHeight;
      const view = element.clientHeight;

      if (top < element.scrollTop) {
        element.scrollTop = top;
      } else if (view > 0 && bottom > element.scrollTop + view) {
        element.scrollTop = bottom - view;
      }
      update();
    },
    [update],
  );

  const end = Math.min(range.end, count);
  return {
    containerRef,
    range: { end, start: Math.min(range.start, end) },
    scrollToIndex,
  };
}
