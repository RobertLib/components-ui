import type { Column, DataTableDensity } from "./types";

/**
 * The keys of the expand, selection and actions columns among the layouts
 * and the measured widths of the columns - apart from the keys of the
 * columns, one of which may well be `actions` too.
 */
export const LEADING_KEYS: Readonly<
  Record<"actions" | "expand" | "selection", string>
> = {
  actions: "\u0000actions",
  expand: "\u0000expand",
  selection: "\u0000selection",
};

/** Narrowest a column can be resized to without a `minWidth` of its own. */
export const MIN_COLUMN_WIDTH = 50;

/** Widest a column can be resized to without a `maxWidth` of its own. */
export const MAX_COLUMN_WIDTH = 2000;

/** A width within the limits of a column, in whole pixels. */
export const clampWidth = (width: number, min: number, max: number) =>
  Math.round(Math.min(max, Math.max(min, width)));

/** Vertical padding and text size of the body cells by the row density. */
export const DENSITY_CLASSES: Record<DataTableDensity, string> = {
  comfortable: "py-2.5 text-sm",
  compact: "py-0.5 text-xs",
  normal: "py-1 text-sm",
};

/** Height of a row by the density until rows are measured (virtualization). */
export const ESTIMATED_ROW_HEIGHTS: Record<DataTableDensity, number> = {
  comfortable: 41,
  compact: 21,
  normal: 29,
};

/**
 * Where the cells of a column go: the sticky offsets of a pinned column
 * (also of the selection, expand and actions columns), its width, and
 * whether its cells draw the shadow of the pinned edge.
 */
/**
 * The CSS variable holding the width of a column being resized by dragging
 * - set on the table, so that a move of the pointer renders nothing.
 */
export const DRAG_WIDTH_VARIABLE = "--data-table-drag-width";

export interface CellLayout {
  /** The column is being resized by dragging - its width follows the drag. */
  dragged?: boolean;
  /**
   * The width of a dragged column in `left` or `right` - the offset follows
   * the drag.
   */
  dragOffset?: number;
  /** Sticky `left` offset in pixels - the column is pinned to the left. */
  left?: number;
  /**
   * The widest a pinned column may be resized to - the pinned columns must
   * leave half of the view to the others, or they would scroll along.
   */
  maxResizeWidth?: number;
  /** Sticky `right` offset in pixels - the column is pinned to the right. */
  right?: number;
  /**
   * The last column pinned to the left (`"left"`) or the first one pinned
   * to the right (`"right"`) while the table is scrolled away from that
   * edge - its cells cast a shadow over the scrolled columns.
   */
  shadow?: "left" | "right";
  /** Width in pixels - resized by the user, or the column's `width`. */
  width?: number;
}

/** The layout of a column that is neither pinned nor sized. */
export const DEFAULT_CELL_LAYOUT: CellLayout = {};

/** Whether a layout sticks the cells to an edge. */
export const isSticky = (layout: CellLayout) =>
  layout.left !== undefined || layout.right !== undefined;

/**
 * The inline style of a cell: its sticky offset, and its width - a header
 * cell takes the width of a sized column exactly, the other cells take it
 * as their maximum, so that their content cannot widen the column.
 */
export function getCellStyle<T>(
  column: Column<T> | null,
  layout: CellLayout,
  isHeader: boolean,
): React.CSSProperties {
  // An offset past a dragged column moves with its width
  const offset = (value: number | undefined) =>
    value === undefined
      ? "auto"
      : layout.dragOffset === undefined
        ? `${value}px`
        : `calc(${value - layout.dragOffset}px + var(${DRAG_WIDTH_VARIABLE}))`;
  const style: React.CSSProperties = {
    left: offset(layout.left),
    right: offset(layout.right),
  };

  if (layout.width !== undefined) {
    const width = layout.dragged
      ? `var(${DRAG_WIDTH_VARIABLE}, ${layout.width}px)`
      : `${layout.width}px`;
    style.maxWidth = width;
    if (isHeader) {
      style.minWidth = width;
      style.width = width;
    }
  } else if (column) {
    if (column.minWidth !== undefined) style.minWidth = `${column.minWidth}px`;
    if (column.maxWidth !== undefined) style.maxWidth = `${column.maxWidth}px`;
  }

  return style;
}

/**
 * Whether the content of a column's cells is clipped at its width - a
 * sized column, or one with a `maxWidth`, unless `disableOverflow`.
 */
export const isClipped = <T>(column: Column<T>, layout: CellLayout) =>
  (layout.width !== undefined || !!column.maxWidth) && !column.disableOverflow;
