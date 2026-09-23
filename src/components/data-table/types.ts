export type RowId = string | number;

export type ColumnFilter =
  "input" | "select" | "date" | "time" | "datetime" | "custom";

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
   * format of the locale, booleans as its "Yes" / "No". Defaults to
   * `row[key]`.
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
  /** In pixels. */
  maxWidth?: number;
  /** In pixels. */
  minWidth?: number;
  /** Content of the cell - defaults to the value as text. */
  render?: (row: T) => React.ReactNode;
  /** Makes the header label a sort toggle. */
  sortable?: boolean;
  /** Initial visibility - the user can toggle columns in the column menu. */
  visible?: boolean;
}

export interface GroupActionSelection<T> {
  /**
   * Every row matching the current filters is selected, not just the loaded
   * ones - act on the filters (`query`) rather than on `rows` then.
   */
  allFiltered: boolean;
  /** Number of selected rows - all rows matching the filters when `allFiltered`. */
  count: number;
  /** The selected rows that are loaded. */
  rows: T[];
}

export interface GroupAction<T> {
  /** Text of the button. */
  label: string;
  /**
   * Called with the selected rows. Return `false` to keep the selection when
   * `autoResetSelectedRows` is on. While a returned promise is pending, the
   * button shows a spinner and the group actions cannot be pressed; a
   * rejection keeps the selection - tell the user about it yourself.
   */
  onClick: (
    selectedRows: T[],
    selection: GroupActionSelection<T>,
  ) => boolean | void | Promise<boolean | void>;
}

export interface FilteredSelectionConfig {
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
