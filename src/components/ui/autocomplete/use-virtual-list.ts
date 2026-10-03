import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Rows rendered before the list is measured
const INITIAL_ROWS = 30;

// Heights (px) of the rows until rows of their kind are measured - an
// option of one line (`py-1` and a line of text), a group heading
const ESTIMATED_ROW_HEIGHT = 32;
const ESTIMATED_HEADING_HEIGHT = 28;

/** A row of the list - an option, or the heading of a group of options. */
export interface VirtualListRow {
  /** Whether the row is a heading - measured apart from the options. */
  heading: boolean;
  /** Stays with the row while other rows come and go (a search). */
  key: string;
}

interface VirtualListOptions {
  /** Renders only the rows in view - otherwise all of them. */
  enabled: boolean;
  /**
   * Rows that stay rendered out of view - the highlighted option, which
   * `aria-activedescendant` points to.
   */
  keepRows: number[];
  /** The list - the element around the rows, in the scrolling panel. */
  listElement: HTMLElement | null;
  /** All rows of the list, in their order. */
  rows: VirtualListRow[];
}

/** The first row whose end is past `position` (binary search). */
function findRow(offsets: Float64Array, position: number) {
  let low = 0;
  let high = Math.max(offsets.length - 2, 0);

  while (low < high) {
    const middle = (low + high) >> 1;
    if (offsets[middle + 1] <= position) low = middle + 1;
    else high = middle;
  }

  return low;
}

/**
 * Scrolls the panel around `list` so that the part of the list from `top`
 * to `bottom` is in view - its end first, where it does not fit.
 */
function scrollIntoPanel(list: HTMLElement, top: number, bottom: number) {
  const container = list.parentElement;
  if (!container) return;

  const start = top + list.offsetTop;
  const end = bottom + list.offsetTop;
  const viewHeight = container.clientHeight;

  if (end > container.scrollTop + viewHeight) {
    container.scrollTop = Math.max(end - viewHeight, 0);
  }
  if (start < container.scrollTop && end - start <= viewHeight) {
    container.scrollTop = start;
  }
}

/**
 * Row virtualization of the list of an Autocomplete: which rows to render
 * for the part of the scrolling panel in view (and some above and below,
 * so that the arrow keys find them ready), and where every row starts - the
 * room of the rows left out. Rendered rows are measured, so options of
 * other heights (`renderOption`) are placed right; the rows not rendered
 * yet are estimated from them.
 */
export default function useVirtualList({
  enabled,
  keepRows,
  listElement,
  rows,
}: VirtualListOptions) {
  const count = rows.length;
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [range, setRange] = useState({ end: INITIAL_ROWS, start: 0 });

  // One observer for the rendered rows, where there is one (not in jsdom,
  // nor on the server)
  const [observer] = useState(() =>
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          const measured: [string, number][] = [];
          for (const { target } of entries) {
            const key = (target as HTMLElement).dataset.rowKey;
            // A row on its way out of the page measures 0
            if (key === undefined || !target.isConnected) continue;
            measured.push([key, target.getBoundingClientRect().height]);
          }
          if (measured.length === 0) return;

          setHeights((previous) => {
            if (
              measured.every(([key, height]) => previous.get(key) === height)
            ) {
              return previous;
            }
            const next = new Map(previous);
            for (const [key, height] of measured) next.set(key, height);
            return next;
          });
        }),
  );

  useEffect(() => () => observer?.disconnect(), [observer]);

  /** Put on each rendered row (with `data-row-key`) - it is measured. */
  const measureRef = useCallback(
    (element: HTMLElement | null) => {
      if (!element || !observer) return;
      observer.observe(element);
      return () => observer.unobserve(element);
    },
    [observer],
  );

  // Where each row starts - measured heights, estimated ones for the rows
  // not rendered yet - and where they end
  const offsets = useMemo(() => {
    if (!enabled) return null;

    let rowTotal = 0;
    let rowCount = 0;
    let headingTotal = 0;
    let headingCount = 0;
    for (const row of rows) {
      const height = heights.get(row.key);
      if (height === undefined) continue;
      if (row.heading) {
        headingTotal += height;
        headingCount += 1;
      } else {
        rowTotal += height;
        rowCount += 1;
      }
    }
    const rowEstimate = rowCount ? rowTotal / rowCount : ESTIMATED_ROW_HEIGHT;
    const headingEstimate = headingCount
      ? headingTotal / headingCount
      : ESTIMATED_HEADING_HEIGHT;

    const result = new Float64Array(rows.length + 1);
    rows.forEach((row, index) => {
      result[index + 1] =
        result[index] +
        (heights.get(row.key) ?? (row.heading ? headingEstimate : rowEstimate));
    });
    return result;
  }, [enabled, heights, rows]);

  // The latest offsets and list for the scroll handler, which runs between
  // renders - and for scrolling the panel, which is no value of a render
  const offsetsRef = useRef(offsets);
  const listRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    offsetsRef.current = offsets;
    listRef.current = listElement;
  });

  // The rows in view of the panel, with a margin of half a view above and
  // below. Rows that still cover the view with half the margin to spare are
  // kept - a pixel of scrolling must not render other rows.
  const updateRange = useCallback(() => {
    const layout = offsetsRef.current;
    const container = listElement?.parentElement;
    if (!layout || !listElement || !container) return;

    const total = layout.length - 1;
    const viewHeight =
      container.clientHeight || INITIAL_ROWS * ESTIMATED_ROW_HEIGHT;
    const top = container.scrollTop - listElement.offsetTop;
    const margin = Math.max(viewHeight / 2, 100);

    setRange((previous) => {
      const end = Math.min(previous.end, total);
      const start = Math.min(previous.start, end);
      if (
        start < end &&
        layout[start] <= Math.max(0, top - margin / 2) &&
        layout[end] >= Math.min(layout[total], top + viewHeight + margin / 2) &&
        layout[end] - layout[start] <= viewHeight + 4 * margin
      ) {
        return previous;
      }

      const nextStart = total ? findRow(layout, Math.max(0, top - margin)) : 0;
      const nextEnd = total
        ? Math.min(findRow(layout, top + viewHeight + margin) + 1, total)
        : 0;

      return previous.start === nextStart && previous.end === nextEnd
        ? previous
        : { end: nextEnd, start: nextStart };
    });
  }, [listElement]);

  // When the rows or their heights change - not after every render, which
  // the new range itself causes
  useLayoutEffect(() => {
    if (enabled) updateRange();
  }, [enabled, offsets, updateRange]);

  useEffect(() => {
    const container = listElement?.parentElement;
    if (!enabled || !container) return;

    container.addEventListener("scroll", updateRange, { passive: true });
    // A taller panel shows more rows - the room below the field grew
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateRange);
    resizeObserver?.observe(container);

    return () => {
      container.removeEventListener("scroll", updateRange);
      resizeObserver?.disconnect();
    };
  }, [enabled, listElement, updateRange]);

  // By value - a new array of the same rows renders nothing new
  const keepKey = keepRows.join(",");

  // The rows to render, in their order - all of them without
  // virtualization
  const renderedRows = useMemo(() => {
    if (!enabled) return null;

    const end = Math.min(range.end, count);
    const start = Math.min(range.start, end);
    const indexes = new Set<number>();
    for (let index = start; index < end; index++) indexes.add(index);
    for (const kept of keepKey ? keepKey.split(",").map(Number) : []) {
      if (kept >= 0 && kept < count) indexes.add(kept);
    }
    return [...indexes].sort((a, b) => a - b);
  }, [count, enabled, keepKey, range.end, range.start]);

  /**
   * Scrolls the panel so that the rows `from` to `to` (inclusive) are in
   * view - `to` first, where they do not fit. For a row that is not
   * rendered yet; a rendered one is brought into view by the browser.
   */
  const scrollToRows = (from: number, to: number) => {
    const layout = offsetsRef.current;
    const list = listRef.current;
    if (!layout || !list) return;

    scrollIntoPanel(list, layout[from], layout[to + 1]);
    // The rows there are rendered at once - the scroll event comes later
    updateRange();
  };

  return {
    measureRef: enabled ? measureRef : undefined,
    /** Where each row starts, and where they end - `null` without it. */
    offsets,
    /** The rows to render, in their order - `null` for all of them. */
    renderedRows,
    scrollToRows,
  };
}
