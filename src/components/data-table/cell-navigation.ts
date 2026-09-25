import type { Column, RowId } from "./types";

/** A cell of the body, by its row and column. */
export interface CellPosition {
  columnKey: string;
  rowId: RowId;
}

/**
 * Where a key moves the focus among the editable cells: to the next one
 * left, right, up or down, to the first or last one of the row (Home /
 * End) or of the table (Ctrl + Home / End).
 */
export type CellMove =
  "down" | "first" | "last" | "left" | "right" | "rowEnd" | "rowStart" | "up";

/** The move of a key pressed in an editable cell - `null` for other keys. */
export function getCellMove(event: React.KeyboardEvent): CellMove | null {
  if (event.altKey || event.shiftKey) return null;
  const toTable = event.ctrlKey || event.metaKey;

  switch (event.key) {
    case "ArrowDown":
      return toTable ? null : "down";
    case "ArrowLeft":
      return toTable ? null : "left";
    case "ArrowRight":
      return toTable ? null : "right";
    case "ArrowUp":
      return toTable ? null : "up";
    case "End":
      return toTable ? "last" : "rowEnd";
    case "Home":
      return toTable ? "first" : "rowStart";
    default:
      return null;
  }
}

/**
 * The editable cell a move goes to from the cell at `rowIndex` /
 * `columnIndex` - the editable cells are one tab stop, the arrow keys move
 * between them (the grid pattern). Up and down stay in the column, skipping
 * rows whose cell there cannot be edited. `null` when there is none that
 * way - the focus stays.
 */
export function findMoveTarget<T extends { id: RowId }>(
  rows: T[],
  columns: Column<T>[],
  isEditable: (column: Column<T>, row: T) => boolean,
  rowIndex: number,
  columnIndex: number,
  move: CellMove,
): CellPosition | null {
  const at = (row: T, column: Column<T>) =>
    isEditable(column, row) ? { columnKey: column.key, rowId: row.id } : null;

  /** The first editable cell of a row from `start` in `step`'s direction. */
  const inRow = (row: T, start: number, step: -1 | 1) => {
    for (
      let index = start;
      index >= 0 && index < columns.length;
      index += step
    ) {
      const cell = at(row, columns[index]);
      if (cell) return cell;
    }
    return null;
  };

  /** The first row from `start` in `step`'s direction with a cell found. */
  const inRows = (
    start: number,
    step: -1 | 1,
    find: (row: T) => CellPosition | null,
  ) => {
    for (let index = start; index >= 0 && index < rows.length; index += step) {
      const cell = find(rows[index]);
      if (cell) return cell;
    }
    return null;
  };

  const row = rows[rowIndex];
  const column = columns[columnIndex];

  switch (move) {
    case "left":
      return inRow(row, columnIndex - 1, -1);
    case "right":
      return inRow(row, columnIndex + 1, 1);
    case "rowStart":
      return inRow(row, 0, 1);
    case "rowEnd":
      return inRow(row, columns.length - 1, -1);
    case "up":
      return inRows(rowIndex - 1, -1, (candidate) => at(candidate, column));
    case "down":
      return inRows(rowIndex + 1, 1, (candidate) => at(candidate, column));
    case "first":
      return inRows(0, 1, (candidate) => inRow(candidate, 0, 1));
    case "last":
      return inRows(rows.length - 1, -1, (candidate) =>
        inRow(candidate, columns.length - 1, -1),
      );
  }
}
