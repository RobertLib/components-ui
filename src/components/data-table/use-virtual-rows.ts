import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RowId } from "./types";

// Rows rendered before the table is measured - also by the server
const INITIAL_ROWS = 30;

// Height of an expanded detail until one is measured
const ESTIMATED_SUB_ROW_HEIGHT = 120;

// The key of the detail row of a row in the measured heights
const SUB_ROW = "\u0000sub";

/** The `data-measure-key` of a row, or of its detail row. */
export const getMeasureKey = (id: RowId, isSubRow: boolean) =>
  isSubRow ? String(id) + SUB_ROW : String(id);

/** A part of the rendered body: a row, or the room of the rows left out. */
export type VirtualSegment =
  | { index: number; type: "row" }
  | { height: number; key: string; type: "spacer" };

interface VirtualRowsOptions<T> {
  /** The tbody - where the rows start in the scrolled content. */
  bodyRef: React.RefObject<HTMLElement | null>;
  /** Rows to show. */
  data: T[];
  /** Renders only the rows in view - otherwise all of them. */
  enabled: boolean;
  /** Height of a row until rows are measured - by the density. */
  estimatedHeight: number;
  /** Ids of the rows whose detail row is shown. */
  expandedRows: ReadonlySet<RowId>;
  /** The table has detail rows (`renderSubRow`). */
  hasSubRows: boolean;
  /**
   * Indexes of rows that stay rendered out of view - the one with the focus,
   * the one being edited.
   */
  keepIndexes: number[];
  /**
   * Changes when the rows may have other heights (another density, other
   * column widths) - the heights measured before are dropped.
   */
  layoutKey: string;
  /** The element that scrolls the table. */
  scrollRef: React.RefObject<HTMLElement | null>;
}

/** The first index whose offset is past `position` (binary search). */
function findIndex(offsets: Float64Array, position: number) {
  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const middle = (low + high) >> 1;
    if (offsets[middle + 1] <= position) low = middle + 1;
    else high = middle;
  }

  return low;
}

/** Heights of rendered rows, by `data-measure-key`. */
function readHeights(elements: Iterable<Element>) {
  const heights: [string, number][] = [];

  for (const element of elements) {
    const key = (element as HTMLElement).dataset.measureKey;
    // A row on its way out of the page measures 0
    if (key === undefined || !element.isConnected) continue;
    heights.push([key, element.getBoundingClientRect().height]);
  }

  return heights;
}

/** Where each row starts in the body, and the height of the row itself. */
interface RowsLayout {
  /** Where each row starts - its detail row follows it - and where they end. */
  offsets: Float64Array;
  /** The height of each row without its detail row. */
  rowHeights: Float64Array;
  /** Table rows (rows and details) before each row. */
  tableRows: Int32Array;
}

/**
 * How far the top of the view - below the sticky rows of the header, the
 * scroll padding of the container - is below the top of the body.
 */
function getViewTop(body: Element, container: HTMLElement) {
  const padding = parseFloat(getComputedStyle(container).scrollPaddingTop) || 0;
  return (
    container.getBoundingClientRect().top +
    padding -
    body.getBoundingClientRect().top
  );
}

/**
 * The first row - or detail row - that starts at `top` in the body or
 * below it, and how far below: the one cut by the top changes its height
 * out of view. Read from a layout the rows were rendered by, so it holds
 * also when they have been laid out anew since.
 */
function findAnchor({ offsets, rowHeights }: RowsLayout, top: number) {
  const count = offsets.length - 1;
  if (count === 0) return null;

  let index = findIndex(offsets, Math.max(0, top));
  let isSubRow = false;
  const subRowStart = offsets[index] + rowHeights[index];
  if (offsets[index] < top) {
    if (subRowStart >= top && offsets[index + 1] > subRowStart) {
      isSubRow = true;
    } else if (index + 1 < count) {
      index += 1;
    }
  }
  const start = offsets[index] + (isSubRow ? rowHeights[index] : 0);

  return { index, isSubRow, top: start - top };
}

/**
 * The heights of the rows of `data` - the same map when it has no others.
 * Rows gone (a filter, another page of a server) must not pile up, nor
 * weigh in the height the rows not measured yet are estimated at.
 */
function pruneHeights<T extends { id: RowId }>(
  heights: ReadonlyMap<string, number>,
  data: T[],
) {
  const ids = new Set(data.map((row) => String(row.id)));
  const next = new Map(
    [...heights].filter(([key]) =>
      ids.has(key.endsWith(SUB_ROW) ? key.slice(0, -SUB_ROW.length) : key),
    ),
  );
  return next.size === heights.size ? heights : next;
}

/**
 * Row virtualization of the table body: which rows to render for the part
 * of the scrolled container in view (plus some above and below, so that
 * scrolling and Tab find them ready), and the room of the rows left out.
 * Rendered rows are measured - rows of different heights and expanded
 * details included - and the room of the others is estimated from them.
 */
export default function useVirtualRows<T extends { id: RowId }>({
  bodyRef,
  data,
  enabled,
  estimatedHeight,
  expandedRows,
  hasSubRows,
  keepIndexes,
  layoutKey,
  scrollRef,
}: VirtualRowsOptions<T>) {
  const count = data.length;
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [range, setRange] = useState({ end: INITIAL_ROWS, start: 0 });

  // One observer for the rendered rows, created where there is one
  const [observer] = useState(() =>
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          const measured = readHeights(entries.map((entry) => entry.target));
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

  // The heights of rows measured under another density, or with a column
  // resized, are no guide any more - the rendered rows are measured again
  // right away (the observer reports only those whose size changed), the
  // others estimated from them. The details keep theirs, their content is
  // no row of cells.
  const measuredLayoutRef = useRef(layoutKey);

  useLayoutEffect(() => {
    if (measuredLayoutRef.current === layoutKey) return;
    measuredLayoutRef.current = layoutKey;
    const body = bodyRef.current;
    if (!enabled || !body) return;

    const rendered = readHeights(
      body.querySelectorAll(":scope > [data-measure-key]"),
    );
    setHeights(
      (previous) =>
        new Map([
          ...[...previous].filter(([key]) => key.endsWith(SUB_ROW)),
          ...rendered,
        ]),
    );
  }, [bodyRef, enabled, layoutKey]);

  // Only the rows there are
  const [measuredData, setMeasuredData] = useState(data);
  if (heights.size > 0 && measuredData !== data) {
    setMeasuredData(data);
    setHeights((previous) => pruneHeights(previous, data));
  }

  /** Put on each rendered row - it is measured while it is in the page. */
  const measureRef = useCallback(
    (element: HTMLElement | null) => {
      if (!element || !observer) return;
      observer.observe(element);
      return () => observer.unobserve(element);
    },
    [observer],
  );

  // Where each row starts in the body - measured heights, estimated ones
  // for the rows not rendered yet - and how many table rows (a row and its
  // detail) come before it
  const layout = useMemo((): RowsLayout | null => {
    if (!enabled) return null;

    let measuredTotal = 0;
    let measuredCount = 0;
    let subTotal = 0;
    let subCount = 0;
    for (const [key, height] of heights) {
      if (key.endsWith(SUB_ROW)) {
        subTotal += height;
        subCount += 1;
      } else {
        measuredTotal += height;
        measuredCount += 1;
      }
    }

    // The rows not measured yet are like the measured ones
    const rowEstimate = measuredCount
      ? measuredTotal / measuredCount
      : estimatedHeight;
    const subRowEstimate = subCount
      ? subTotal / subCount
      : ESTIMATED_SUB_ROW_HEIGHT;

    const offsets = new Float64Array(count + 1);
    const rowHeights = new Float64Array(count);
    const tableRows = new Int32Array(count + 1);

    for (let index = 0; index < count; index++) {
      const { id } = data[index];
      const key = String(id);
      const isExpanded = hasSubRows && expandedRows.has(id);

      rowHeights[index] = heights.get(key) ?? rowEstimate;
      offsets[index + 1] =
        offsets[index] +
        rowHeights[index] +
        (isExpanded ? (heights.get(key + SUB_ROW) ?? subRowEstimate) : 0);
      tableRows[index + 1] = tableRows[index] + (isExpanded ? 2 : 1);
    }

    return { offsets, rowHeights, tableRows };
  }, [
    count,
    data,
    enabled,
    estimatedHeight,
    expandedRows,
    hasSubRows,
    heights,
  ]);

  // The latest layout for the scroll handler, which runs between renders,
  // and the rows it was worked out for
  const layoutRef = useRef<{
    data: T[];
    expandedRows: ReadonlySet<RowId>;
    layout: RowsLayout | null;
  } | null>(null);

  // Rows above the view that take another room than they did - measured
  // for the first time, measured again with another density or column
  // widths - must not move the rows in view: the first row (or detail)
  // starting in the view stays where it is. Before the rows in view are
  // worked out.
  useLayoutEffect(() => {
    const previous = layoutRef.current;
    layoutRef.current = { data, expandedRows, layout };

    const body = bodyRef.current;
    const container = scrollRef.current;
    if (
      !previous?.layout ||
      !layout ||
      previous.layout === layout ||
      // Other rows - another filter or sorting shows them from the top -
      // or a detail opened or closed, which moves the rows under it
      previous.data !== data ||
      previous.expandedRows !== expandedRows ||
      !body ||
      !container
    ) {
      return;
    }

    // The rows are laid out anew by now - where the view was is read from
    // the layout they had, by the top of the view in the body
    const viewTop = getViewTop(body, container);
    const anchor = findAnchor(previous.layout, viewTop);
    if (!anchor) return;

    const { index, isSubRow } = anchor;
    const start =
      layout.offsets[index] + (isSubRow ? layout.rowHeights[index] : 0);
    const shift = start - anchor.top - viewTop;
    if (Math.abs(shift) < 0.01) return;

    container.scrollTop += shift;
    // Told at once - the scroll event comes a frame later, and the table
    // puts a scroll it has not heard of back when the focus returns into
    // its toolbar (from the density menu)
    container.dispatchEvent(new Event("scroll"));
  });

  // The rows in view of the container, with a margin of half a view above
  // and below - read from the layout. Rows that still cover the view with
  // half the margin to spare are kept (unless they are far more than it
  // needs, after the view shrank): a pixel of movement - the browser
  // anchoring the scroll to a row that is swapped for a spacer - must not
  // swap them back and forth, nor must every row scrolled past render.
  const updateRange = useCallback(() => {
    const container = scrollRef.current;
    const body = bodyRef.current;
    const offsets = layoutRef.current?.layout?.offsets;
    if (!container || !body || !offsets) return;

    const viewHeight =
      container.clientHeight || INITIAL_ROWS * (offsets[1] - offsets[0] || 30);
    // How far the top of the view is below the top of the body
    const top =
      container.getBoundingClientRect().top - body.getBoundingClientRect().top;
    const margin = Math.max(viewHeight / 2, 200);
    const total = offsets.length - 1;

    setRange((previous) => {
      const end = Math.min(previous.end, total);
      const start = Math.min(previous.start, end);
      if (
        start < end &&
        offsets[start] <= Math.max(0, top - margin / 2) &&
        offsets[end] >=
          Math.min(offsets[total], top + viewHeight + margin / 2) &&
        offsets[end] - offsets[start] <= viewHeight + 4 * margin
      ) {
        return previous;
      }

      let nextStart = Math.min(findIndex(offsets, top - margin), total);
      let nextEnd = Math.min(
        findIndex(offsets, top + viewHeight + margin) + 1,
        total,
      );

      // Past the end of the rows - there are fewer of them than a moment
      // ago (a filter), and the browser takes the view back to the last ones
      if (nextStart >= nextEnd && total > 0) {
        const rowHeight = offsets[total] / total || 1;
        nextStart = Math.max(
          0,
          total - Math.ceil((viewHeight + margin) / rowHeight),
        );
        nextEnd = total;
      }

      return previous.start === nextStart && previous.end === nextEnd
        ? previous
        : { end: nextEnd, start: nextStart };
    });
  }, [bodyRef, scrollRef]);

  // When the rows or their heights change - not after every render, which
  // the new range itself causes
  useLayoutEffect(() => {
    if (enabled) updateRange();
  }, [enabled, layout, updateRange]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!enabled || !container) return;

    container.addEventListener("scroll", updateRange, { passive: true });
    // A bigger view shows more rows - full screen, a resized window - and
    // the body moves when the rows above it change (a filter row appears)
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateRange);
    resizeObserver?.observe(container);
    const table = bodyRef.current?.parentElement;
    if (table) resizeObserver?.observe(table);

    return () => {
      container.removeEventListener("scroll", updateRange);
      resizeObserver?.disconnect();
    };
  }, [bodyRef, enabled, scrollRef, updateRange]);

  // By value - a new array of the same rows renders nothing new
  const keepKey = keepIndexes.join(",");

  // What to render: all rows, or the rows in view (and the kept ones) with
  // spacers holding the room of the others
  const segments = useMemo((): VirtualSegment[] => {
    if (!layout) {
      return data.map((_, index) => ({ index, type: "row" }));
    }

    const { offsets } = layout;
    const end = Math.min(range.end, count);
    const start = Math.min(range.start, end);
    const indexes: number[] = [];

    const kept = [...new Set(keepKey ? keepKey.split(",").map(Number) : [])]
      .filter((index) => index >= 0 && index < count)
      .sort((a, b) => a - b);

    for (const index of kept) if (index < start) indexes.push(index);
    for (let index = start; index < end; index++) indexes.push(index);
    for (const index of kept) if (index >= end) indexes.push(index);

    const result: VirtualSegment[] = [];
    let next = 0;

    for (const index of indexes) {
      if (index > next) {
        result.push({
          height: offsets[index] - offsets[next],
          key: `spacer-${next}`,
          type: "spacer",
        });
      }
      result.push({ index, type: "row" });
      next = index + 1;
    }

    if (next < count) {
      result.push({
        height: offsets[count] - offsets[next],
        key: `spacer-${next}`,
        type: "spacer",
      });
    }

    return result;
  }, [count, data, keepKey, layout, range.end, range.start]);

  return {
    measureRef: enabled ? measureRef : undefined,
    segments,
    /**
     * Table rows (rows and details) before the row at `index` - for its
     * `aria-rowindex`. `undefined` without virtualization.
     */
    tableRowsBefore: (index: number) => layout?.tableRows[index],
    /** Table rows (rows and details) of the body when virtualized. */
    tableRowCount: layout ? layout.tableRows[count] : undefined,
  };
}
