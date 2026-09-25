import type { DataTableQuery } from "./query";

export type RowId = string | number;

export type ColumnFilter =
  "input" | "select" | "date" | "time" | "datetime" | "custom";

/** The edge a column sticks to while the table scrolls sideways. */
export type ColumnPin = "left" | "right";

/**
 * The built-in field of an editable cell: `text` (`Input`), `number`
 * (`Input type="number"`), `select` (`Select`), `date` (`DateTimePicker`) or
 * `checkbox` (`Checkbox`).
 */
export type ColumnEditor = "text" | "number" | "select" | "date" | "checkbox";

/**
 * What the summary row shows under a column: `sum`, `avg` (the mean),
 * `min` and `max` of the numbers (`min` / `max` also of dates - `Date`s or
 * ISO texts like `2026-09-24`), `count` of the rows - or a function of the
 * rows returning the content itself.
 */
export type ColumnSummary<T> =
  "sum" | "avg" | "min" | "max" | "count" | ((rows: T[]) => React.ReactNode);

/** Height of the rows - `normal` is the default look. */
export type DataTableDensity = "compact" | "normal" | "comfortable";

/** What the `renderEditor` of a column gets. */
export interface CellEditorProps<T> {
  /** Ends the editing without a change - the cell shows its value again. */
  cancel: () => void;
  /** The edited column. */
  column: Column<T>;
  /**
   * Validates the value (`validate` of the column) and saves it through
   * `onCellEdit` - `value` defaults to the last one given to `onChange`.
   */
  commit: (value?: unknown) => void;
  /** Message of a failed validation - show it at the field. */
  error?: string;
  /**
   * Accessible name for the field - the column label. Enter, Escape and Tab
   * pressed in the field are handled for you (commit, cancel, commit and
   * move on), unless the field uses them itself (`preventDefault()`), and so
   * is the focus leaving it (commit).
   */
  label: string;
  /** Call it with the new value while the user changes it. */
  onChange: (value: unknown) => void;
  /** The edited row. */
  row: T;
  /** The value being edited - the cell value at first. */
  value: unknown;
}

export interface Column<T> {
  /**
   * Renders the filter of a `filter: "custom"` column - call
   * `handleFilterChange(column.key, value)` with the new value.
   */
  customFilter?: (
    handleFilterChange: (key: string, value: string) => void,
    filterValue: string,
  ) => React.ReactNode;
  /** Lets the content overflow `maxWidth` instead of clipping it. */
  disableOverflow?: boolean;
  /**
   * The cells can be edited in place - all, or the rows the function
   * accepts. Enter, F2 or a double-click start editing (on touch screens a
   * tap on the focused cell), Enter saves, Escape cancels and Tab saves and
   * edits the next editable cell; a field left as it was saves nothing.
   * Needs `onCellEdit` on the table.
   */
  editable?: boolean | ((row: T) => boolean);
  /**
   * The built-in field of an `editable` column. Defaults by the value - of
   * another row for an empty cell: a checkbox for booleans, a number field
   * for numbers (it refuses text that is no number), a date picker for dates
   * (and `filter: "date"` columns), a select for columns with
   * `editorOptions` or a `select` filter, a text field otherwise. Set it for
   * a column whose cells may all be empty.
   */
  editor?: ColumnEditor;
  /** Options of the `select` editor - defaults to `filterSelectOptions`. */
  editorOptions?: { label: string; value: string | number }[];
  /**
   * The value of the column in the CSV export - defaults to what the cell
   * shows without a `render` (`getValue` / `row[key]`, dates and booleans by
   * the locale).
   */
  exportValue?: (row: T) => unknown;
  /** Filter field shown under the header label. */
  filter?: ColumnFilter;
  /**
   * `clientSide` only: decides whether a row matches the filter value -
   * replaces the default matching of the filter type.
   */
  filterFn?: (row: T, filterValue: string) => boolean;
  /** Options of a `filter: "select"` column. */
  filterSelectOptions?: { label: string; value: string | number }[];
  /**
   * The value of the cell for client-side sorting, filtering and searching -
   * and for display when there is no `render`: dates are shown by the date
   * format of the locale in the local time zone (a server rendering the table
   * in another zone than the browser shows other text - build a day from its
   * parts, `new Date(year, month - 1, day)`), booleans as its "Yes" / "No".
   * Defaults to `row[key]`.
   */
  getValue?: (row: T) => unknown;
  /** Unique key of the column - also the default field of the row shown. */
  key: string;
  /** Header text of the column. */
  label: string;
  /** Explanatory text shown in a popover behind an info icon next to the header label. */
  labelInfo?: string;
  /**
   * Full column name shown in the native tooltip and the column menu when
   * `label` is an abbreviation kept short to save horizontal space.
   */
  labelTitle?: string;
  /** In pixels - also the limit of resizing. */
  maxWidth?: number;
  /** In pixels - also the limit of resizing. */
  minWidth?: number;
  /**
   * Sticks the column to the left or right edge while the table scrolls
   * sideways - the user can pin and unpin columns in the column settings.
   */
  pinned?: ColumnPin;
  /** Content of the cell - defaults to the value as text. */
  render?: (row: T) => React.ReactNode;
  /**
   * Builds the field of an `editable` cell instead of the built-in `editor`
   * - e.g. an `Autocomplete`. See `CellEditorProps`.
   */
  renderEditor?: (props: CellEditorProps<T>) => React.ReactNode;
  /** Set to `false` to keep the user from resizing the column. */
  resizable?: boolean;
  /** Makes the header label a sort toggle. */
  sortable?: boolean;
  /**
   * Adds the column to the summary row under the table - computed from all
   * rows matching the filters of a `clientSide` table (the loaded rows with
   * server data, unless `summaryValues` has the column).
   */
  summary?: ColumnSummary<T>;
  /**
   * Checks an edited value before it is saved - return the message to show
   * when it is invalid, nothing when it is valid.
   */
  validate?: (value: unknown, row: T) => string | null | undefined;
  /** Initial visibility - the user can toggle columns in the column menu. */
  visible?: boolean;
  /**
   * Width in pixels - otherwise the content decides. The user can resize
   * the column; a double-click on its edge brings this width back.
   */
  width?: number;
}

export interface GroupActionSelection<T> {
  /**
   * Every row matching the current filters is selected, not just the loaded
   * ones - but `excludedRows` - with server data act on the filters
   * (`query`) rather than on `rows` then.
   */
  allFiltered: boolean;
  /**
   * Number of selected rows - all rows matching the filters but
   * `excludedRows` when `allFiltered`.
   */
  count: number;
  /**
   * `allFiltered`: the matching rows the user unchecked afterwards - they
   * are not selected. Empty otherwise.
   */
  excludedRows: T[];
  /**
   * The query the rows were selected under - its `filters` and `search` let
   * a server find all the rows of an `allFiltered` selection.
   */
  query: DataTableQuery;
  /**
   * The selected rows that are loaded - with `allFiltered` all matching rows
   * of a `clientSide` table, the rows of the page with server data (without
   * `excludedRows` either way).
   */
  rows: T[];
}

export interface GroupAction<T> {
  /** Text of the button. */
  label: string;
  /**
   * Called with the selected rows. Return `false` (or a promise of `false`)
   * to keep the selection when `autoResetSelectedRows` is on - any other
   * value resets it, so `(rows) => enqueueSnackbar(…)` works as it reads.
   * While a returned promise is pending, the button shows a spinner and the
   * group actions cannot be pressed; a rejection keeps the selection - tell
   * the user about it yourself.
   */
  onClick: (selectedRows: T[], selection: GroupActionSelection<T>) => unknown;
}

export interface FilteredSelectionConfig {
  /**
   * "{count} matching rows are selected." - all matching rows but some the
   * user unchecked afterwards. `{count}` is shown in bold.
   */
  allExceptSelectionLabel?: string;
  /** "All {count} rows are selected." - `{count}` is shown in bold. */
  allSelectionLabel?: string;
  /** "Clear selection" */
  clearSelectionLabel?: string;
  /** "{count} rows on this page are selected." */
  pageSelectionLabel?: string;
  /**
   * Identifies the set of rows "select all" refers to - the selection is
   * dropped when it changes. Defaults to the filters and search of the query.
   */
  scopeKey?: string;
  /** "Select all {count} rows" */
  selectAllLabel?: string;
  /** Number of rows matching the filters. Defaults to the `total` prop. */
  total?: number;
}
