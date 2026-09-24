import { parseISODate, toISODate } from "../../utils/date";
import { toNumber } from "./query";
import type { Column, ColumnEditor, RowId } from "./types";

/**
 * The change of a cell, kept by its row id and column key - not by the row
 * object, which a refetch replaces while the change is on its way.
 */
export type CellEditState<T> =
  | {
      /** `onCellEdit` has not finished - the value shows with a spinner. */
      status: "pending";
      value: unknown;
    }
  | {
      /**
       * Saved - the value shows until the table gets rows other than
       * `row` (the app's update of `data`, a refetch).
       */
      row: T | undefined;
      status: "saved";
      value: unknown;
    }
  | {
      /**
       * Refused - the message shows, and so does the value the cell had
       * before while the row still has the refused one (an optimistic
       * update of the app), until the next save of the cell.
       */
      message: string;
      previous: unknown;
      refused: unknown;
      status: "failed";
    };

/**
 * How the editing of a cell ended: with the value to save, or `null` for a
 * field left as it was.
 */
export type CellChange = { value: unknown } | null;

/** The key of a cell in the changes of the table. */
export const getCellKey = (rowId: RowId, columnKey: string) =>
  `${String(rowId)}\u0000${columnKey}`;

/**
 * The value a cell shows: that of its change - `overridden` - or the row's
 * own, `current`.
 */
export function getShownValue<T>(
  state: CellEditState<T> | undefined,
  row: T,
  current: unknown,
): { overridden: boolean; value: unknown } {
  switch (state?.status) {
    case "pending":
      return { overridden: true, value: state.value };
    case "saved":
      return state.row === row
        ? { overridden: true, value: state.value }
        : { overridden: false, value: current };
    case "failed":
      return isSameValue(current, state.refused) &&
        !isSameValue(current, state.previous)
        ? { overridden: true, value: state.previous }
        : { overridden: false, value: current };
    default:
      return { overridden: false, value: current };
  }
}

/** Whether a cell of `row` can be edited in `column`. */
export const isEditableCell = <T>(column: Column<T>, row: T) =>
  typeof column.editable === "function"
    ? column.editable(row)
    : !!column.editable;

/** Whether an edited value is what the cell holds - dates by their time. */
export const isSameValue = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date
    ? a.getTime() === b.getTime()
    : Object.is(a, b) || ((a === null || a === undefined) && b === null);

/**
 * Calls `onCellEdit` - a throw becomes a rejection, so both end the same.
 * Kept out of the components, which the React Compiler compiles.
 */
export function runCellEdit<T>(
  onCellEdit: (
    row: T,
    columnKey: string,
    value: unknown,
  ) => void | Promise<void>,
  row: T,
  columnKey: string,
  value: unknown,
): Promise<void> {
  try {
    return Promise.resolve(onCellEdit(row, columnKey, value));
  } catch (error) {
    return Promise.reject(error);
  }
}

/** The message of a refused change - an `Error`'s own, or `fallback`. */
export const getEditErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : fallback;

/**
 * The built-in field of a column: its `editor`, or one fitting the value -
 * a checkbox for booleans, a number field for numbers, a date picker for
 * dates, a select for columns with options, a text field otherwise.
 */
export function getEditorKind<T>(
  column: Column<T>,
  value: unknown,
): ColumnEditor {
  if (column.editor) return column.editor;
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (value instanceof Date || column.filter === "date") return "date";
  if (column.editorOptions || column.filter === "select") return "select";
  return "text";
}

/** The options of a `select` editor. */
export const getEditorOptions = <T>(column: Column<T>) =>
  column.editorOptions ?? column.filterSelectOptions ?? [];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/** A value as the built-in field of its kind holds it. */
export function toDraft(kind: ColumnEditor, value: unknown): unknown {
  switch (kind) {
    case "checkbox":
      return Boolean(value);
    case "date":
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? "" : toISODate(value);
      }
      return typeof value === "string" && ISO_DATE.test(value)
        ? value.slice(0, 10)
        : "";
    case "number": {
      const number = toNumber(value);
      return number === null ? "" : String(number);
    }
    default:
      return value === null || value === undefined ? "" : String(value);
  }
}

/** No value - `null`, `undefined` or an empty text. */
export const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "";

/**
 * The day picked in a date field applied to the value of the cell: the
 * value itself while its day did not change; otherwise a `Date` or an ISO
 * text of the new day that keeps the time (and the zone of a text) of the
 * old value, or `YYYY-MM-DD` for a cell that had no value.
 */
function toDateValue(draft: string, initialValue: unknown): unknown {
  if (!draft) return isEmpty(initialValue) ? initialValue : null;
  if (draft === toDraft("date", initialValue)) return initialValue;

  if (initialValue instanceof Date) {
    const day = parseISODate(draft);
    if (!day) return initialValue;

    const value = new Date(initialValue);
    value.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    return value;
  }

  return typeof initialValue === "string" && ISO_DATE.test(initialValue)
    ? draft + initialValue.slice(10)
    : draft;
}

/**
 * The value of a built-in field as the column holds it: numbers as
 * numbers, the option values of a select as they are typed, dates as the
 * cell held them (see `toDateValue`). An empty field is `null`. A field
 * left as it was gives back the value of the cell as it is - `"1234.50"`
 * or a date-time are not rewritten by opening them.
 */
export function fromDraft<T>(
  kind: ColumnEditor,
  draft: unknown,
  initialValue: unknown,
  column: Column<T>,
): unknown {
  if (draft === toDraft(kind, initialValue)) return initialValue;

  switch (kind) {
    case "checkbox":
      return Boolean(draft);
    case "date":
      return toDateValue(String(draft), initialValue);
    case "number": {
      if (draft === "") return null;
      const number = Number(draft);
      return Number.isNaN(number) ? null : number;
    }
    case "select": {
      if (draft === "") return null;
      const option = getEditorOptions(column).find(
        (candidate) => String(candidate.value) === draft,
      );
      return option ? option.value : draft;
    }
    default:
      return draft;
  }
}
