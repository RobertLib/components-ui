import { TableBody } from "./table-body";
import { TableFooter } from "./table-footer";
import { TableHead } from "./table-head";
import { TableHeader } from "./table-header";
import { TableSummary } from "./table-summary";
import { type PageInfo } from "../pagination";
import {
  useCallback,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "../button";
import { attachRef } from "../../../hooks/use-form-control";
import cn from "../../../utils/cn";
import columnRecord from "./column-record";
import { defaultRowId, getRowKey } from "./row-key";
import logger from "../../../utils/logger";
import useColumnManagement from "./use-column-management";
import usePendingValue from "./use-pending-value";
import useQueryColumns from "./use-query-columns";
import useRowSelection from "./use-row-selection";
import {
  clampWidth,
  DEFAULT_CELL_LAYOUT,
  DRAG_WIDTH_VARIABLE,
  LEADING_KEYS,
  type CellLayout,
} from "./cell-layout";
import { computeSummary } from "./summary";
import { createCsv, downloadCsv } from "./csv";
import {
  flattenColumns,
  groupRowsBy,
  sortByGroupColumns,
  countGroupRows,
  type NestedRowGroup,
  summarizeGroup,
  type BodyRowGroup,
} from "./grouping";
import {
  getCellKey,
  getEditErrorMessage,
  getShownValue,
  isEditableCell,
  isEmpty,
  isSameValue,
  runCellEdit,
  type CellChange,
  type CellEditState,
} from "./editing";
import {
  isEscapeKey,
  isTopmostOverlay,
  lockPageScroll,
  OverlayContext,
  useFocusTrap,
  useOverlayLayer,
} from "../overlay-stack";
import {
  createDataTableQuery,
  DEFAULT_PAGE_SIZE_OPTIONS,
  filterAndSortRows,
  getColumnValue,
  getQuerySort,
  hasFilterValue,
  isFilterColumn,
  isSameQuery,
  normalizeFilterValue,
  paginateRows,
  resetPagination,
  setFilter,
  toggleSort,
  type DataTableQuery,
  type DataTableSort,
} from "./query";
import {
  formatMessage,
  formatNumber,
  formatPlural,
  pluralForm,
} from "../../../i18n/ui/format";
import { useLocale } from "../../../providers/ui-context";
import type { PluralMessage } from "../../../i18n/ui/types";
import type {
  CellEditResult,
  Column,
  DataTableColumn,
  DataTableColumnState,
  DataTableDensity,
  DataTableGroupMetadata,
  DataTableSelectionMode,
  FilteredSelectionConfig,
  GroupAction,
  GroupActionSelection,
  RowId,
} from "./types";

export type {
  CellEditResult,
  CellEditorProps,
  Column,
  ColumnEditor,
  ColumnFilter,
  ColumnGroup,
  ColumnPin,
  ColumnSummary,
  DataTableColumn,
  DataTableColumnState,
  DataTableDensity,
  DataTableGroupMetadata,
  DataTableSelectionMode,
  FilteredSelectionConfig,
  GroupAction,
  GroupActionSelection,
  RowId,
} from "./types";

/** The ids of both lists are the same - in any order. */
function isSameIdSet(a: readonly RowId[], b: readonly RowId[]) {
  if (a === b) return true;
  const ids = new Set(a);
  const other = new Set(b);
  return ids.size === other.size && [...ids].every((id) => other.has(id));
}

/**
 * Only acted rows that stayed selected may be reset. Removing one from
 * the selection protects it if it is selected again while the action runs.
 */
function retainSelectedActionIds(
  actionIds: Set<RowId>,
  selectedIds: ReadonlySet<RowId>,
) {
  for (const id of actionIds) {
    if (!selectedIds.has(id)) actionIds.delete(id);
  }
}

const MAX_TOGGLED_ROWS = 1000;

// How many reports of all matching rows a late parent may still apply
const MAX_PENDING_REPORTS = 50;

// How long the refusal of a change stays in the live region - long enough
// to be announced
const ANNOUNCEMENT_DURATION = 5000;

/** The measured widths with new ones - the same object when none changed. */
function mergeWidths(
  widths: Record<string, number>,
  changes: Record<string, number>,
) {
  return Object.entries(changes).every(([key, width]) => widths[key] === width)
    ? widths
    : columnRecord({ ...widths, ...changes });
}

/** The changes of cells with the change of one cell replaced. */
function withCellState<T>(
  states: ReadonlyMap<string, CellEditState<T>>,
  key: string,
  state: CellEditState<T> | null,
) {
  const next = new Map(states);
  if (state) next.set(key, state);
  else next.delete(key);
  return next;
}

/**
 * The changes of cells that still show with new rows - the same map when
 * all do. A saved value shows until its row is replaced, a refusal until
 * the cell holds another value than the refused one or the one before it
 * (another user's change, a refetch); a row gone takes its changes along,
 * unless a save of it is still on its way.
 */
function pruneCellStates<T>(
  states: ReadonlyMap<string, CellEditState<T>>,
  data: T[],
  columns: Column<T>[],
  getRowId: (row: T) => RowId,
) {
  if (states.size === 0) return states;

  const rowsById = new Map(data.map((row) => [getRowKey(getRowId(row)), row]));
  const next = new Map(states);

  for (const [key, state] of states) {
    if (state.status === "pending") continue;

    const separator = key.indexOf("\u0000");
    const row = rowsById.get(key.slice(0, separator));
    const columnKey = key.slice(separator + 1);
    const column = columns.find((candidate) => candidate.key === columnKey);
    const isShown =
      !!row &&
      !!column &&
      (state.status === "saved"
        ? state.row === row
        : isSameValue(getColumnValue(row, column), state.refused) ||
          isSameValue(getColumnValue(row, column), state.previous));

    if (!isShown) next.delete(key);
  }

  return next.size === states.size ? states : next;
}

/**
 * The rows `onExport` gives - `null` when it fails, which is logged. Kept
 * out of the component, which the React Compiler compiles.
 */
async function loadExportRows<T>(
  onExport: (query: DataTableQuery) => T[] | Promise<T[]>,
  query: DataTableQuery,
) {
  try {
    return { rows: await onExport(query) };
  } catch (error) {
    logger.error("The CSV export failed", error);
    return { error };
  }
}

export interface DataTableProps<T> extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** Content of a sticky first column, e.g. edit / delete buttons. */
  actions?: (row: T) => React.ReactNode;
  /**
   * Name of the table - of the region around it (by default "Data table"),
   * of the `<table>` and of its pagination ("People pagination"). Several
   * tables of a page are told apart by it.
   */
  "aria-label"?: string;
  /**
   * Id of the element naming the table, e.g. a heading above it - instead
   * of `aria-label` for the region, the `<table>` and its pagination.
   */
  "aria-labelledby"?: string;
  /**
   * Drop rows that stayed selected while their group action ran (unless it
   * returns `false`). Rows selected or reselected meanwhile stay selected.
   */
  autoResetSelectedRows?: boolean;
  /**
   * The table filters, searches, sorts and pages `data` itself - pass all
   * rows. Otherwise `data` is the current page, loaded for `query`.
   */
  clientSide?: boolean;
  /**
   * Column definitions - see `Column`; an entry with `children` puts its
   * columns under a common header (`ColumnGroup`).
   */
  columns: DataTableColumn<T>[];
  /**
   * The column settings - controlled: their order, visibility, pinning and
   * widths as the user left them, e.g. stored on a server per user. Use
   * with `onColumnStateChange`; `tableId` then keeps only the row density.
   */
  columnState?: DataTableColumnState;
  /**
   * Field separator of the CSV export - by default `;` for languages
   * writing a decimal comma (so e.g. a Czech Excel opens the file in
   * columns) and `,` for the others.
   */
  csvSeparator?: string;
  /** Rows to show - the current page, or all rows with `clientSide`. */
  data: T[];
  /**
   * Initial column settings of an uncontrolled table - with `tableId` while
   * nothing is saved under it. "Reset columns" brings back the columns'
   * definitions.
   */
  defaultColumnState?: DataTableColumnState;
  /** Initial query of an uncontrolled table. */
  defaultQuery?: Partial<DataTableQuery>;
  /** Opens the global search field right away. */
  defaultSearchOpen?: boolean;
  /** Ids of the rows selected at first - uncontrolled, see `selectedIds`. */
  defaultSelectedIds?: RowId[];
  /**
   * Height of the rows. The user can switch it in the toolbar - the choice
   * is remembered under `tableId`.
   */
  density?: DataTableDensity;
  /** Set to `false` to leave the row density control out of the toolbar. */
  densityControl?: boolean;
  /**
   * Replaces the generic "no data" text shown when the table has no rows -
   * a text, or any content such as an `EmptyState` with a button.
   */
  emptyMessage?: React.ReactNode;
  /**
   * Adds a CSV export button to the toolbar. It exports every page of what
   * the user sees - the visible columns in their order, the values as the
   * cells show them: all rows matching the filters of a `clientSide` table,
   * the rows `onExport` returns with server data (the loaded ones without
   * it). Without `onExport`, inline edits and rejected changes follow the
   * displayed values too, unless a column provides its own `exportValue`.
   */
  enableCsvExport?: boolean;
  /**
   * Shows a search field searching all columns (`query.search`). Without it
   * a `search` in the query (from the URL, `defaultQuery`) is ignored by a
   * `clientSide` table, and "Clear filters" clears it for a server.
   */
  enableGlobalSearch?: boolean;
  /** Rows with a `renderSubRow` start expanded - also rows loaded later. */
  expandedByDefault?: boolean;
  /** Name of the file of the CSV export - `.csv` is added when missing. */
  exportFilename?: string;
  /**
   * Offers "select all N rows matching the filters" once a whole page is
   * selected - `true` for the defaults, or an object to adjust them.
   */
  filteredSelection?: boolean | FilteredSelectionConfig;
  /** Background of a row (any CSS color), e.g. to mark its state. */
  getRowBackgroundColor?: (row: T) => string | undefined;
  /** Extra classes of a row. */
  getRowClassName?: (row: T) => string | undefined;
  /**
   * The page a row opens - its first column shows its content as a link
   * there (`useRouter().Link`, so middle and Ctrl + click open a new tab),
   * and a click elsewhere on the row follows it too, the middle button in a
   * new tab. `undefined` for a row without one. Keep controls out of the
   * first column - a link cannot hold them.
   */
  getRowHref?: (row: T) => string | undefined;
  /** Stable identity of a row - defaults to its `id` field. */
  getRowId?: (row: T) => RowId;
  /** Rows the user can select. Select all and Shift selection skip others. */
  isRowSelectable?: (row: T) => boolean;
  /** Controlled ids of expanded detail rows; use with `onExpandedIdsChange`. */
  expandedIds?: RowId[];
  /** Initial expanded detail rows, instead of `expandedByDefault`. */
  defaultExpandedIds?: RowId[];
  /** Called when the user expands or collapses a detail row. */
  onExpandedIdsChange?: (ids: RowId[]) => void;
  /** Buttons acting on the selected rows - adds a checkbox column. */
  groupActions?: GroupAction<T>[];
  /** Column key or keys to group by, from outermost to innermost. Groups support virtualization; server data groups the loaded page. */
  groupBy?: string | readonly string[];
  /** Server counts and summaries keyed by `getDataTableGroupKey` of the group's value path. */
  groupMetadata?: Record<string, DataTableGroupMetadata>;
  /** Controlled keys of collapsed groups. */
  collapsedGroupKeys?: readonly string[];
  /** Initial collapsed group keys. */
  defaultCollapsedGroupKeys?: readonly string[];
  /** Collapsed group keys requested after a toggle. */
  onCollapsedGroupKeysChange?: (keys: string[]) => void;
  /**
   * The rows are loading: without rows the table shows placeholder rows
   * with a spinner over them, rows already there are dimmed until new ones
   * come. The pagination waits meanwhile; the toolbar and the filters stay
   * usable.
   */
  loading?: boolean;
  /**
   * Maximum height of the scrollable table (any CSS length) - the header row
   * sticks to its top, the summary row to its bottom. Another page, sorting,
   * filter or search shows the rows from the top. Default
   * `calc(100vh - 212px)`.
   */
  maxHeight?: string;
  /**
   * Shift + click on a sortable header (Shift + Enter on its button) adds
   * the column to the sorting - rows equal in the first sorted column are
   * sorted by the next one (`query.sort`). A plain click sorts by the
   * column alone. Defaults to `clientSide` - a server has to read
   * `query.sort` to sort by several columns.
   */
  multiSort?: boolean;
  /**
   * Called with the new value of an `editable` cell - not for a field left
   * as it was, also when a refetch changed the cell meanwhile. While a
   * returned promise is pending, the cell shows the new value with a
   * spinner; when it rejects, the cell shows its old value again with the
   * message of the rejection (of an `Error`, or a generic one), announced
   * once - until the cell is saved again or `data` no longer has the
   * refused value or the one before it (another value, or no such row).
   * Update `data` with the saved value. Return `{ value: savedValue }` to
   * confirm the server's value explicitly; it takes precedence when the
   * save finishes, until the next replacement of its row in `data`. This
   * is needed when normalization returns the original value, which a poll
   * still holding old data looks like too. Without a result, changed data
   * wins and unchanged data keeps the draft. Another page, sorting or
   * filter ends the editing.
   */
  onCellEdit?: (
    row: T,
    columnKey: string,
    value: unknown,
  ) => void | CellEditResult | Promise<void | CellEditResult>;
  /**
   * Called with the new column settings whenever the user reorders, hides,
   * pins or resizes a column or resets them - also of an uncontrolled table,
   * e.g. to store them on a server.
   */
  onColumnStateChange?: (state: DataTableColumnState) => void;
  /**
   * Server data: all rows of `query` - every page - for the CSV export. It
   * turns the export on too. The export button shows a spinner while the
   * rows load; a rejection shows a localized alert and calls `onExportError`.
   */
  onExport?: (query: DataTableQuery) => T[] | Promise<T[]>;
  /** An export failed; the table also shows a localized error message. */
  onExportError?: (error: unknown) => void;
  /** Called with the new query whenever the user pages, sorts, filters or searches. */
  onQueryChange?: (query: DataTableQuery) => void;
  /**
   * Called for a click on a row - not on a control in it (a button, a
   * checkbox, a link, an editable cell) nor at the end of selecting its
   * text. Rows without a `getRowHref` link are one Tab stop: the arrow keys
   * move between them, Enter on one calls it with the keyboard event. For
   * linked rows it is called before the link is followed -
   * `event.preventDefault()` stays on the page.
   */
  onRowClick?: (
    row: T,
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  /**
   * Called with the ids of the selected rows whenever the user changes the
   * selection - and what it is: all rows matching the filters
   * (`filteredSelection`) or some, the loaded selected rows, the count.
   */
  onSelectedIdsChange?: (
    ids: RowId[],
    selection: GroupActionSelection<T>,
  ) => void;
  /**
   * Cursor pagination (GraphQL / Relay): the `pageInfo` of the connection.
   * Leave out for offset pagination, which needs `total`.
   */
  pageInfo?: PageInfo;
  /** Choices of the "rows per page" select. */
  pageSizeOptions?: number[];
  /**
   * Set to `false` to hide the footer with the pagination - a `clientSide`
   * table then shows all its rows.
   */
  pagination?: boolean;
  /** Controlled query - see `useDataTableQuery`. */
  query?: DataTableQuery;
  /** Expandable detail of a row, shown under it. */
  renderSubRow?: (row: T) => React.ReactNode;
  /**
   * The user can resize the columns by the edge of their header - by
   * dragging (also by touch) or from the keyboard; a pinned column as far as
   * the pinned columns leave half of the view to the others. Set to `false`
   * for none, or `resizable: false` on a column.
   */
  resizableColumns?: boolean;
  /**
   * Ids of the selected rows - controlled, with `onSelectedIdsChange`. They
   * stay as given - also for rows of other pages or filtered out, which an
   * uncontrolled selection drops: clear them yourself when the rows change
   * (e.g. in `onQueryChange`). With "select all N rows" of
   * `filteredSelection` the table reports the loaded matching rows and
   * `allFiltered`; another `selectedIds` ends it.
   */
  selectedIds?: RowId[];
  /**
   * How many rows the checkbox column lets the user select - `single`
   * unchecks the other row, Shift + click on a checkbox of `multiple`
   * selects the rows from the one clicked before. Defaults to `multiple`
   * with `groupActions` or a selection prop (`selectedIds`,
   * `defaultSelectedIds`, `onSelectedIdsChange`), to `none` otherwise.
   */
  selectionMode?: DataTableSelectionMode;
  /**
   * Server data: the values of the summary row by column key, e.g. the
   * totals of all rows matching the query - they win over the `summary` of
   * the columns. Numbers are written as the language writes them.
   */
  summaryValues?: Record<string, React.ReactNode>;
  /**
   * Remembers the column order, visibility, pinning and widths and the row
   * density in `localStorage` under this id - the row density alone with a
   * controlled `columnState`. Include the user id when several people share
   * a browser.
   */
  tableId?: string;
  /** Content left of the table controls, e.g. filters or a "New" button. */
  toolbar?: React.ReactNode;
  /** Number of rows matching the query (offset pagination). */
  total?: number;
  /**
   * Renders only the rows in view of the scrolling table (see `maxHeight`)
   * - for thousands of rows, e.g. a `clientSide` table with
   * `pagination={false}`. Rows may differ in height (expanded details);
   * they are measured.
   */
  virtualized?: boolean;
}

/**
 * A data grid with sorting by one or several columns, column filters (texts,
 * options, ranges), global search, pagination, row selection with group
 * actions, row links, expandable and grouped rows, column groups,
 * reordering, hiding, pinning and resizing, row density, inline editing, a
 * summary row, CSV export and row virtualization. Works with any data
 * source: the table reports a `DataTableQuery` and shows the rows it is
 * given. The attributes and the `ref` go to the region around it. A selected
 * row has `data-selected`, a row with a detail (`renderSubRow`) and a group
 * of rows `data-state="open"` or `"closed"` - for styling.
 */
export default function DataTable<T>({
  actions,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  autoResetSelectedRows = false,
  className,
  clientSide = false,
  columns: columnEntries,
  columnState,
  csvSeparator,
  data,
  defaultExpandedIds,
  defaultColumnState,
  defaultQuery,
  defaultSearchOpen = false,
  defaultSelectedIds,
  density: defaultDensity = "normal",
  densityControl = true,
  emptyMessage,
  enableCsvExport = false,
  enableGlobalSearch = false,
  expandedByDefault = false,
  expandedIds: controlledExpandedIds,
  exportFilename = "export.csv",
  filteredSelection,
  getRowBackgroundColor,
  getRowClassName,
  getRowHref,
  getRowId = defaultRowId,
  isRowSelectable,
  groupActions,
  groupBy,
  groupMetadata,
  collapsedGroupKeys,
  defaultCollapsedGroupKeys = [],
  onCollapsedGroupKeysChange,
  loading,
  maxHeight = "calc(100vh - 212px)",
  multiSort = clientSide,
  onCellEdit,
  onColumnStateChange,
  onExport,
  onExportError,
  onExpandedIdsChange,
  onQueryChange,
  onRowClick,
  onSelectedIdsChange,
  pageInfo,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  pagination = true,
  query: controlledQuery,
  ref,
  renderSubRow,
  resizableColumns = true,
  selectedIds: controlledSelectedIds,
  selectionMode: selectionModeProp,
  summaryValues,
  tableId,
  toolbar,
  total,
  virtualized: virtualizedProp = false,
  ...props
}: DataTableProps<T>) {
  const locale = useLocale();
  const messages = locale.messages.ui;

  const rootRef = useRef<HTMLDivElement | null>(null);
  // The root element - also for the `ref` prop
  const rootRefCallback = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element;
      const detachRef = attachRef(ref, element);
      return () => {
        rootRef.current = null;
        detachRef();
      };
    },
    [ref],
  );

  const [internalQuery, setInternalQuery] = useState(() =>
    createDataTableQuery(defaultQuery),
  );
  const query = controlledQuery ?? internalQuery;

  // Debounced filters and search commit later - they must build on the query
  // of that moment, not on the one they were typed in. A controlled query may
  // come back later (a router updating the URL asynchronously) - until then
  // changes build on the pending one.
  const latestQuery = usePendingValue(query, isSameQuery);

  const updateQuery = (update: (current: DataTableQuery) => DataTableQuery) => {
    const current = latestQuery.get();
    const next = update(current);
    // e.g. a search typed and erased again - keep the page
    if (next === current) return;

    latestQuery.set(next);
    if (!controlledQuery) setInternalQuery(next);
    onQueryChange?.(next);
  };

  // The columns of the groups take their places - the table works with the
  // columns, the header adds a row for the groups
  const {
    columns,
    groupOf,
    groups: columnGroups,
  } = useMemo(() => flattenColumns(columnEntries), [columnEntries]);

  const {
    columnOrder,
    columnVisibility,
    columnWidths: userWidths,
    density: savedDensity,
    handleDragOver,
    handleDragStart,
    handleDrop,
    handlePinColumn,
    hasCustomSettings,
    moveColumn,
    pinnedColumns,
    resetColumnLayout,
    setColumnVisibility,
    setColumnWidth,
    setDensity,
    sortedVisibleColumns,
    visibleColumns,
  } = useColumnManagement(columns, tableId, {
    columnState,
    defaultColumnState,
    groupOf,
    onColumnStateChange,
  });

  // The user's choice - unless the control to make it is gone
  const density = (densityControl && savedDensity) || defaultDensity;

  const groupingKey = JSON.stringify(
    typeof groupBy === "string" ? [groupBy] : (groupBy ?? []),
  );
  const groupColumns = useMemo(
    () =>
      (JSON.parse(groupingKey) as string[]).flatMap((key) => {
        const column = columns.find((entry) => entry.key === key);
        return column ? [column] : [];
      }),
    [columns, groupingKey],
  );
  const virtualized = virtualizedProp;

  // The term of the search field - without the field nothing could show or
  // clear a search, so a `clientSide` table ignores one then
  const searchTerm = enableGlobalSearch ? query.search : "";

  // Only sortable columns the user sees sort - a hand-edited URL or an old
  // bookmark may name others, whose headers could not show them; a click on
  // a header drops them
  const isShownSortKey = (key: string) =>
    sortedVisibleColumns.some(
      (column) => column.sortable && column.key === key,
    );
  const querySort = getQuerySort(query);
  const sortKey = JSON.stringify(
    querySort.filter(({ key }) => isShownSortKey(key)),
  );
  const sort = useMemo(() => JSON.parse(sortKey) as DataTableSort[], [sortKey]);
  // Client-side: all rows matching the filters and the search, sorted - the
  // expensive part, so it runs again only when they, the columns or these
  // parts of the query change, not on a page change or a checkbox click -
  // nor on a new `columns` array that filters and sorts the same way.
  // The search covers what the user sees - the visible columns, with dates
  // and booleans as the table shows them.
  const queryColumns = useQueryColumns(columns);
  const searchColumns = useQueryColumns(visibleColumns);
  // Equivalent filters share a key regardless of object key order, empty
  // values or multiSelect choice order. Custom filters keep their order.
  const filtersKey = JSON.stringify(
    Object.fromEntries(
      Object.keys(query.filters)
        .sort()
        .flatMap((key) => {
          let value = normalizeFilterValue(query.filters[key]);
          const column = queryColumns.find((column) => column.key === key);
          if (
            Array.isArray(value) &&
            column?.filter === "multiSelect" &&
            !column.filterFn
          ) {
            value = value.sort();
          }
          return value === null ? [] : [[key, value]];
        }),
    ),
  );
  const matchingRows = useMemo(() => {
    if (!clientSide) return null;

    const result = filterAndSortRows(
      data,
      {
        filters: JSON.parse(filtersKey) as DataTableQuery["filters"],
        order: sort[0]?.order ?? "asc",
        search: searchTerm,
        sort,
        sortBy: sort[0]?.key ?? null,
      },
      queryColumns,
      { locale, searchColumns },
    );
    // Grouped, the rows of a group come together - in the order of the
    // sorting within it - not scattered over the pages
    const groupedColumns = (JSON.parse(groupingKey) as string[]).flatMap(
      (key) => {
        const column = queryColumns.find((candidate) => candidate.key === key);
        return column ? [column] : [];
      },
    );
    return sortByGroupColumns(result, groupedColumns, sort, locale);
  }, [
    clientSide,
    data,
    filtersKey,
    groupingKey,
    locale,
    queryColumns,
    searchColumns,
    searchTerm,
    sort,
  ]);
  const clientPage = useMemo(
    () =>
      matchingRows && pagination
        ? paginateRows(matchingRows, query.page, query.pageSize)
        : null,
    [matchingRows, pagination, query.page, query.pageSize],
  );
  const rows = clientPage?.rows ?? matchingRows ?? data;
  const rowsTotal = matchingRows?.length ?? total;
  const page = clientPage?.page ?? (matchingRows ? 1 : query.page);

  // The rendered widths of the columns by key - for the sticky offsets
  const [measuredWidths, setMeasuredWidths] = useState<Record<string, number>>(
    () => columnRecord(),
  );
  const isDraggingRef = useRef(false);
  const pendingWidthsRef = useRef<Record<string, number> | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  // "All rows matching the filters" - the filters it was chosen for, the
  // matching rows unchecked since, which it leaves out, and the ids it was
  // reported with - a controlled `selectedIds` of other ids ends it
  const [allFilteredSelection, setAllFilteredSelection] = useState<{
    excluded: T[];
    /**
     * The controlled ids it may be shown with - those it was reported with
     * last. A parent may apply them later (a transition, the URL of a
     * router): until it does, the ids it showed before and those reported
     * on the way come first.
     */
    reportedIds: RowId[][];
    scope: string;
    token: object;
  } | null>(null);

  // Full screen covers the page like a dialog, in the overlay stack shared
  // with dialogs and popovers: Escape leaves it - unless something open in
  // it takes this Escape first (a popover, the search field) - and Tab
  // stays in it
  const { childContext, id: fullScreenId } = useOverlayLayer(isFullScreen, {
    getElements: () => [rootRef.current],
    modal: true,
  });

  useEffect(() => {
    if (!isFullScreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !isEscapeKey(event) ||
        event.defaultPrevented ||
        !isTopmostOverlay(fullScreenId)
      ) {
        return;
      }
      event.preventDefault();
      setIsFullScreen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    const unlockPageScroll = lockPageScroll();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      unlockPageScroll();
    };
  }, [fullScreenId, isFullScreen]);

  useFocusTrap(isFullScreen, fullScreenId, rootRef);

  // Rows the user expanded or collapsed against `expandedByDefault`, so rows
  // loaded later follow the default
  const [toggledRows, setToggledRows] = useState<Set<RowId>>(() => new Set());
  const [explicitExpandedIds, setExplicitExpandedIds] =
    useState(defaultExpandedIds);

  const actionColumnRef = useRef<HTMLTableCellElement>(null);
  const expandColumnRef = useRef<HTMLTableCellElement>(null);
  const selectionColumnRef = useRef<HTMLTableCellElement>(null);
  const columnRefs = useRef(columnRecord<HTMLTableCellElement | null>());
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const tfootRef = useRef<HTMLTableSectionElement>(null);

  // The header row sticks under the toolbar, which grows when its content
  // wraps onto more lines
  const [headerHeight, setHeaderHeight] = useState(40);

  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() =>
      setHeaderHeight(header.offsetHeight),
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Summaries: of all rows matching the filters of a `clientSide` table, of
  // the loaded rows with server data - where the server gave no value
  const summaryRows = matchingRows ?? rows;
  const summaryData = useMemo(() => {
    const values = columnRecord<unknown>();
    let hasValues = false;

    for (const column of sortedVisibleColumns) {
      if (summaryValues && Object.hasOwn(summaryValues, column.key)) {
        values[column.key] = summaryValues[column.key];
        hasValues = true;
      } else if (column.summary !== undefined) {
        values[column.key] = computeSummary(
          column.summary,
          column,
          summaryRows,
        );
        hasValues = true;
      }
    }

    return hasValues ? values : null;
  }, [sortedVisibleColumns, summaryRows, summaryValues]);
  const hasSummaryRow = !!summaryData && rows.length > 0;

  // The height of the sticky parts of the table - the focus scrolls a
  // control (a checkbox, an edited cell) out from under them
  const [stickyHeights, setStickyHeights] = useState({ foot: 0, head: 0 });

  useEffect(() => {
    const head = theadRef.current;
    const foot = tfootRef.current;
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      const next = {
        foot: foot?.offsetHeight ?? 0,
        head: head?.offsetHeight ?? 0,
      };
      setStickyHeights((previous) =>
        previous.foot === next.foot && previous.head === next.head
          ? previous
          : next,
      );
    });
    if (head) observer.observe(head);
    if (foot) observer.observe(foot);
    return () => observer.disconnect();
  }, [hasSummaryRow]);

  // Another page, sorting, filter or search shows other rows - from their
  // top, not scrolled to where the previous rows were left
  const rowsQueryKey = `${page}:${JSON.stringify([
    query.pageSize,
    sortKey,
    query.search,
    filtersKey,
    query.after,
    query.before,
  ])}`;

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = 0;
  }, [rowsQueryKey]);

  // Whether the table is scrolled away from its start edge and short of its
  // end edge - the pinned columns cast a shadow over the scrolled ones then
  const [scrollEdges, setScrollEdges] = useState({ end: false, start: false });
  // How far the table was scrolled at the last scroll event
  const scrollLeftRef = useRef(0);
  const scrollTopRef = useRef(0);
  // The width of the table's view - virtualized tables size their columns by it
  const [viewWidth, setViewWidth] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const update = () => {
      scrollLeftRef.current = container.scrollLeft;
      scrollTopRef.current = container.scrollTop;
      setViewWidth(container.clientWidth);
      // Negative from the start of a right-to-left table
      const scrolled = Math.abs(container.scrollLeft);
      const start = scrolled > 0;
      const end = scrolled + container.clientWidth < container.scrollWidth - 1;
      setScrollEdges((previous) =>
        previous.start === start && previous.end === end
          ? previous
          : { end, start },
      );
    };

    update();
    container.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(container);
    if (tableRef.current) observer?.observe(tableRef.current);

    return () => {
      container.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);

  const hasGroupActions = !!groupActions && groupActions.length > 0;
  const isSelectionControlled = controlledSelectedIds !== undefined;
  const selectionMode: DataTableSelectionMode =
    selectionModeProp ??
    (hasGroupActions ||
    isSelectionControlled ||
    defaultSelectedIds !== undefined ||
    !!onSelectedIdsChange
      ? "multiple"
      : "none");
  const hasSelection = selectionMode !== "none";

  // "Select all N matching rows" - of a selection of several rows
  const selectionConfig: FilteredSelectionConfig | null =
    selectionMode !== "multiple" ||
    (isRowSelectable &&
      !clientSide &&
      (typeof filteredSelection !== "object" ||
        filteredSelection.total === undefined))
      ? null
      : filteredSelection === true
        ? {}
        : filteredSelection || null;

  const selectionScopeKey =
    selectionConfig?.scopeKey ?? JSON.stringify([filtersKey, query.search]);
  // Returning to earlier filters or clearing starts another selection.
  // An action still running for the previous one must not reset it.
  const [selectionScope, setSelectionScope] = useState(() => ({
    key: selectionScopeKey,
  }));
  if (selectionScope.key !== selectionScopeKey) {
    setSelectionScope({ key: selectionScopeKey });
  }
  const canSelectRow = (row: T) => !isRowSelectable || isRowSelectable(row);
  const selectableRows = rows.filter(canSelectRow);
  const selectionTotal =
    selectionConfig?.total ??
    (clientSide
      ? (matchingRows ?? rows).filter(canSelectRow).length
      : rowsTotal) ??
    selectableRows.length;
  const isAllFilteredSelected =
    !!selectionConfig && allFilteredSelection?.scope === selectionScopeKey;
  const excludedRows = useMemo(() => {
    if (!isAllFilteredSelected || !allFilteredSelection) return [];
    const excluded = allFilteredSelection.excluded;
    // Only a client-side table knows every matching row. A server page or
    // a loading placeholder cannot tell whether an exclusion is gone.
    if (matchingRows === null || loading || excluded.length === 0) {
      return excluded;
    }
    const currentRows = new Map(
      matchingRows
        .filter((row) => !isRowSelectable || isRowSelectable(row))
        .map((row) => [getRowId(row), row]),
    );
    const current = excluded.flatMap((row) => {
      const currentRow = currentRows.get(getRowId(row));
      return currentRow === undefined ? [] : [currentRow];
    });
    return current.length === excluded.length &&
      current.every((row, index) => row === excluded[index])
      ? excluded
      : current;
  }, [
    allFilteredSelection,
    isAllFilteredSelected,
    loading,
    matchingRows,
    getRowId,
    isRowSelectable,
  ]);

  // The ids of a controlled selection among those it was reported with - a
  // late parent still shows earlier ones
  const shownReportIndex =
    isSelectionControlled && allFilteredSelection
      ? allFilteredSelection.reportedIds.findIndex((ids) =>
          isSameIdSet(controlledSelectedIds, ids),
        )
      : 0;

  // "All rows matching the filters" ends with the filters - it does not come
  // back when the user returns to them - and with another controlled
  // selection than the one it was reported with
  if (
    allFilteredSelection !== null &&
    (allFilteredSelection.scope !== selectionScopeKey ||
      shownReportIndex === -1)
  ) {
    setAllFilteredSelection(null);
  } else if (allFilteredSelection && shownReportIndex > 0) {
    // The parent caught up with one of them - those before are over
    setAllFilteredSelection({
      ...allFilteredSelection,
      reportedIds: allFilteredSelection.reportedIds.slice(shownReportIndex),
    });
  } else if (
    isAllFilteredSelected &&
    allFilteredSelection &&
    excludedRows !== allFilteredSelection.excluded
  ) {
    // A row that leaves the matching data loses its exclusion for good;
    // those that remain carry their current values into action payloads.
    setAllFilteredSelection({
      ...allFilteredSelection,
      excluded: excludedRows,
    });
  }

  // Uncontrolled, rows that leave the page (another page, a refetch without
  // them) leave the selection - the others stay selected. A controlled
  // selection stays as it is given.
  const {
    ids: selectedIdList,
    isAllSelected,
    selectedIds,
    selectedRows,
    setSelectedIds,
  } = useRowSelection(rows, {
    getRowId,
    isRowSelectable,
    defaultSelectedIds,
    // Client-side all rows are loaded - a controlled selection may keep
    // rows of other pages
    lookupRows: clientSide ? data : rows,
    loading,
    resetKey: selectionScopeKey,
    selectedIds: controlledSelectedIds,
  });

  // The explicit ids a running action may still reset. Prune them after
  // committed parent changes and automatic reconciliation too, not just
  // after checkbox clicks. A reorder or a refetch with the same ids keeps
  // them; a removed and reselected id belongs to a newer selection.
  // Insertion effects also follow commits while Activity hides the table.
  const pendingActionIdsRef = useRef<Set<RowId> | null>(null);
  useInsertionEffect(() => {
    const actionIds = pendingActionIdsRef.current;
    if (actionIds) retainSelectedActionIds(actionIds, selectedIds);
  }, [selectedIds]);

  // The ids reported last - an uncontrolled selection that drops rows by
  // itself (another page, a refetch, other filters) reports it afterwards
  const reportedIdsRef = useRef(selectedIdList);

  useEffect(() => {
    if (
      isSelectionControlled ||
      isAllFilteredSelected ||
      isSameIdSet(reportedIdsRef.current, selectedIdList)
    ) {
      return;
    }
    reportedIdsRef.current = selectedIdList;
    onSelectedIdsChange?.(selectedIdList, {
      allFiltered: false,
      count: selectedIdList.length,
      excludedRows: [],
      ids: selectedIdList,
      query,
      rows: selectedRows,
    });
  });
  const excludedIds = useMemo(
    () => new Set(excludedRows.map((row) => getRowId(row))),
    [excludedRows, getRowId],
  );
  const selectedCount = isAllFilteredSelected
    ? Math.max(0, selectionTotal - excludedRows.length)
    : selectedIdList.length;
  const displayedSelectedIds = isAllFilteredSelected
    ? new Set(selectableRows.map(getRowId).filter((id) => !excludedIds.has(id)))
    : selectedIds;

  /**
   * What a selection is - reported with its ids. `excluded` for all rows
   * matching the filters but these.
   */
  const describeSelection = (
    ids: RowId[],
    excluded: T[] | null,
  ): GroupActionSelection<T> => {
    const idSet = new Set(ids);
    const loaded = new Map(
      (clientSide ? data : rows)
        .filter(canSelectRow)
        .map((row) => [getRowId(row), row]),
    );

    return {
      allFiltered: excluded !== null,
      count:
        excluded === null
          ? ids.length
          : Math.max(0, selectionTotal - excluded.length),
      excludedRows: excluded ?? [],
      ids,
      query,
      rows:
        excluded === null
          ? ids.flatMap((id) => {
              const row = loaded.get(id);
              return row === undefined ? [] : [row];
            })
          : (matchingRows ?? rows).filter((row) => idSet.has(getRowId(row))),
    };
  };

  /**
   * Makes a selection - of the ids, or (`excluded`) of all rows matching
   * the filters but those - and reports it.
   */
  const commitSelection = (ids: RowId[], excluded: T[] | null = null) => {
    if (excluded === null) {
      const known = new Map(data.map((row) => [getRowId(row), row]));
      ids = ids.filter(
        (id) => !known.has(id) || canSelectRow(known.get(id) as T),
      );
      reportedIdsRef.current = ids;
      // Record the intent at once, even if a controlled parent applies it
      // later or several selection changes happen before the next commit.
      const actionIds = pendingActionIdsRef.current;
      if (actionIds) retainSelectedActionIds(actionIds, new Set(ids));
      if (ids.length === 0) setSelectionScope({ key: selectionScopeKey });
      setAllFilteredSelection(null);
      if (!isSelectionControlled) setSelectedIds(ids);
      onSelectedIdsChange?.(ids, describeSelection(ids, null));
      return;
    }

    // The loaded rows of all matching ones - client-side all of them
    const excludedSet = new Set(excluded.map((row) => getRowId(row)));
    const loadedIds = (matchingRows ?? rows)
      .filter(canSelectRow)
      .map((row) => getRowId(row))
      .filter((id) => !excludedSet.has(id));
    reportedIdsRef.current = loadedIds;
    // A late parent shows the ids before these until it applies them
    const reportedIds = [
      ...(!isSelectionControlled
        ? []
        : isAllFilteredSelected && allFilteredSelection
          ? allFilteredSelection.reportedIds
          : [controlledSelectedIds]),
      loadedIds,
    ];
    // One that ignores the changes must not make the list grow forever -
    // the ids it shows stay first
    if (reportedIds.length > MAX_PENDING_REPORTS) reportedIds.splice(1, 1);
    setAllFilteredSelection({
      excluded,
      reportedIds,
      scope: selectionScopeKey,
      // Explicitly selecting again replaces the selection an earlier
      // action used. Refreshing its rows keeps this token.
      token: {},
    });
    onSelectedIdsChange?.(loadedIds, describeSelection(loadedIds, excluded));
  };

  // A completed action uses the current selection and callbacks, including
  // current rows and query in the reported metadata after a page or refetch.
  // Hidden tables still receive updates and finish their pending actions.
  const latestSelection = useRef({
    commitSelection,
    ids: selectedIdList,
    scope: selectionScope,
    token: isAllFilteredSelected ? allFilteredSelection?.token : undefined,
  });
  const mountedRef = useRef(false);

  // A real unmount ends this table's ownership of the selection. Activity
  // hiding keeps it alive, so its pending actions may still finish.
  useInsertionEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useInsertionEffect(() => {
    latestSelection.current = {
      commitSelection,
      ids: selectedIdList,
      scope: selectionScope,
      token: isAllFilteredSelected ? allFilteredSelection?.token : undefined,
    };
  });

  const resetAllSelection = () => commitSelection([]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Mixed with rows unchecked - all matching rows again, as a mixed
      // checkbox checks all; checked, it unchecks all
      if (excludedRows.length > 0) {
        commitSelection([], []);
      } else {
        resetAllSelection();
      }
      return;
    }

    // The rows of the page - a controlled selection keeps those of others
    const pageIds = new Set(selectableRows.map(getRowId));
    commitSelection(
      isAllSelected
        ? selectedIdList.filter((id) => !pageIds.has(id))
        : [
            ...selectedIdList.filter((id) => !pageIds.has(id)),
            ...selectableRows.map(getRowId),
          ],
    );
  };

  // The group action that runs - its button shows a spinner and none of
  // them can be pressed again until it is done
  const [runningAction, setRunningAction] = useState<number | null>(null);
  const isActionRunning = useRef(false);
  // The group action button with the focus - one that becomes unavailable
  // (its action dropped the selection) keeps the focus, `aria-disabled`,
  // until it moves on, instead of dropping it to the page
  const [focusedAction, setFocusedAction] = useState<number | null>(null);
  // "Clear selection" goes with the selection - the focus goes to the
  // "select all" checkbox instead of the page
  const selectAllRef = useRef<HTMLInputElement>(null);

  // A group action that removed the last row takes the bar of the actions
  // along - with the focus of its button, which goes to the "select all"
  // checkbox too. Looked at as the bar leaves, while it is in the page.
  const actionBarRef = useCallback((bar: HTMLDivElement | null) => {
    if (!bar) return;
    return () => {
      if (bar.contains(bar.ownerDocument.activeElement)) {
        selectAllRef.current?.focus();
      }
    };
  }, []);

  const runGroupAction = async (action: GroupAction<T>, index: number) => {
    if (isActionRunning.current) return;
    isActionRunning.current = true;
    setRunningAction(index);

    // Client-side every matching row is loaded - all of them are selected,
    // but those unchecked since
    const actionRows = isAllFilteredSelected
      ? (matchingRows ?? rows).filter(
          (row) => canSelectRow(row) && !excludedIds.has(getRowId(row)),
        )
      : selectedRows;
    const actionScope = selectionScope;
    const actionToken = isAllFilteredSelected
      ? allFilteredSelection?.token
      : undefined;
    const selection: GroupActionSelection<T> = {
      allFiltered: isAllFilteredSelected,
      count: selectedCount,
      excludedRows,
      ids: isAllFilteredSelected
        ? actionRows.map((row) => getRowId(row))
        : selectedIdList,
      query,
      rows: actionRows,
    };
    const actionIds = isAllFilteredSelected ? null : new Set(selection.ids);
    pendingActionIdsRef.current = actionIds;

    // A rejection keeps the selection like `false`, so the action can be
    // retried. No `finally` - the React Compiler cannot compile it.
    let shouldReset: unknown = false;
    try {
      shouldReset = await action.onClick(actionRows, selection);
    } catch (error) {
      logger.error(`The group action "${action.label}" failed`, error);
    }

    if (!mountedRef.current) return;

    if (autoResetSelectedRows && shouldReset !== false) {
      const current = latestSelection.current;
      // Other filters, a cleared selection or another all-filtered selection
      // belong to a later selection. Do not reset or report them.
      if (current.scope === actionScope && current.token === actionToken) {
        if (actionIds) {
          const remaining = current.ids.filter((id) => !actionIds.has(id));
          // Nothing from the action is selected any more. Do not report a
          // reset of an untouched newer selection.
          if (remaining.length !== current.ids.length) {
            current.commitSelection(remaining);
          }
        } else {
          // This is still the all-filtered selection the action got (a
          // change gets another token), so all of it goes. Uncontrolled
          // `ids` are those from before "select all", not its matching rows.
          current.commitSelection([]);
        }
      }
    }

    pendingActionIdsRef.current = null;
    isActionRunning.current = false;
    setRunningAction(null);
  };

  const renderSelectionLabel = (
    template: string | PluralMessage,
    count: number,
  ) => {
    const text =
      typeof template === "string"
        ? template
        : pluralForm(locale.code, template, count);
    const [beforeCount, afterCount = ""] = text.split("{count}");

    return (
      <>
        {beforeCount}
        <strong>{formatNumber(locale.code, count)}</strong>
        {afterCount}
      </>
    );
  };

  // The sticky offsets need the widths of the columns in front
  const visibleColumnKeys = sortedVisibleColumns
    .map((column) => column.key)
    .join(",");

  // Virtualized rows come and go as the table scrolls - columns sized by
  // their content would change their widths all the time. Such a table
  // keeps the widths its columns have with the rows it shows first, until
  // the columns, the density or the width of the view change.
  const [contentWidths, setContentWidths] = useState<{
    key: string;
    widths: Record<string, number>;
  } | null>(null);
  const contentWidthsKey =
    virtualized && rows.length > 0
      ? `${visibleColumnKeys}|${density}|${viewWidth}`
      : null;
  const frozenWidths =
    contentWidths && contentWidths.key === contentWidthsKey
      ? contentWidths.widths
      : null;

  useEffect(() => {
    if (!rows.length || typeof ResizeObserver === "undefined") return;

    // The key each measured header cell has its width under - kept by the
    // element, as a column may be keyed `actions` like the actions column
    const cellKeys = new Map<Element, string>();

    const observer = new ResizeObserver((entries) => {
      const newWidths = columnRecord<number>();

      entries.forEach((entry) => {
        const columnKey = cellKeys.get(entry.target);

        if (columnKey !== undefined) {
          newWidths[columnKey] = entry.target.getBoundingClientRect().width;
        }
      });

      if (Object.keys(newWidths).length > 0) {
        // A drag resizing a column changes widths on every move - they wait
        // for its end, not to render every row on each of them
        if (isDraggingRef.current) {
          pendingWidthsRef.current = {
            ...pendingWidthsRef.current,
            ...newWidths,
          };
        } else {
          setMeasuredWidths((prev) => mergeWidths(prev, newWidths));
        }
      }

      // The first widths under the key - a new observer measures the
      // columns sized by their content as soon as it observes them
      if (contentWidthsKey !== null) {
        const widths = columnRecord<number>();
        for (const [key, cell] of Object.entries(columnRefs.current)) {
          const width = cell?.isConnected && cell.getBoundingClientRect().width;
          if (width) widths[key] = Math.round(width);
        }
        setContentWidths((previous) =>
          previous?.key === contentWidthsKey
            ? previous
            : { key: contentWidthsKey, widths },
        );
      }
    });

    const observeCell = (cell: Element | null, key: string) => {
      if (!cell) return;
      cellKeys.set(cell, key);
      observer.observe(cell);
    };

    if (actions) observeCell(actionColumnRef.current, LEADING_KEYS.actions);
    observeCell(expandColumnRef.current, LEADING_KEYS.expand);
    observeCell(selectionColumnRef.current, LEADING_KEYS.selection);

    Object.entries(columnRefs.current).forEach(([key, cell]) => {
      observeCell(cell, key);
    });

    if (tableRef.current) {
      observer.observe(tableRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [
    actions,
    contentWidthsKey,
    hasSelection,
    renderSubRow,
    rows.length,
    visibleColumnKeys,
  ]);

  // Hiding a column takes its filter and its sorting along - the field of
  // the filter and the sort button go with the column, and rows filtered or
  // ordered by nothing visible would puzzle
  const changeColumnVisibility = (
    update:
      | Record<string, boolean>
      | ((previous: Record<string, boolean>) => Record<string, boolean>),
  ) => {
    let hidden: Column<T>[] = [];
    setColumnVisibility((previous) => {
      const visibility =
        typeof update === "function" ? update(previous) : update;
      hidden = columns.filter(
        (column) => previous[column.key] && visibility[column.key] === false,
      );
      return visibility;
    });
    if (hidden.length > 0) {
      updateQuery((current) => {
        const next = hidden.reduce(
          (result, column) =>
            column.filter ? setFilter(result, column.key, "") : result,
          current,
        );
        const currentSort = getQuerySort(current);
        const keptSort = currentSort.filter(
          ({ key }) => !hidden.some((column) => column.key === key),
        );
        return keptSort.length === currentSort.length
          ? next
          : resetPagination(next, { sort: keptSort });
      });
    }
  };

  // The order, visibility, pinning and widths of the definitions
  const handleResetSettings = () => {
    resetColumnLayout();
    changeColumnVisibility(
      Object.fromEntries(
        columns.map((column) => [column.key, column.visible ?? true]),
      ),
    );
  };

  const hasFilterColumns = sortedVisibleColumns.some((column) => column.filter);

  // Filters without a field to see or clear them in: of hidden columns
  // (from the URL, `defaultQuery` or the saved settings), a search without
  // the search field, which a server applies all the same, and filters of no
  // filterable column (an old bookmark). A `clientSide` table ignores those;
  // a server gets them - it may know them, so they stay in the query, and
  // "Clear filters" is there to drop them.
  const hasHiddenSearch = !clientSide && !enableGlobalSearch && !!query.search;
  const activeFilterKeys = Object.keys(query.filters).filter((key) =>
    hasFilterValue(query.filters[key]),
  );
  const isColumnFilter = (key: string) =>
    columns.some((column) => column.key === key && isFilterColumn(column));
  const hasStrayFilters =
    !clientSide && activeFilterKeys.some((key) => !isColumnFilter(key));
  const hasHiddenFilters =
    hasHiddenSearch ||
    hasStrayFilters ||
    columns.some(
      (column) =>
        isFilterColumn(column) &&
        // A `filterFn` without a `filter` has no field either
        !(column.filter && columnVisibility[column.key]) &&
        hasFilterValue(query.filters[column.key]),
    );
  const hasActiveFilters =
    hasHiddenSearch || hasStrayFilters || activeFilterKeys.some(isColumnFilter);

  // Counts the clearing of the filters - a filter field drops a text typed
  // but not committed yet, which would come back once typing pauses
  const [filterResetKey, setFilterResetKey] = useState(0);

  const clearFilters = () => {
    setFilterResetKey((count) => count + 1);
    updateQuery((current) =>
      resetPagination(current, {
        filters: {},
        // Without its field, the search is one of the filters
        ...(!enableGlobalSearch && { search: "" }),
      }),
    );
  };

  // Column widths: the one the user drags or resized the column to, or its
  // `width` - within its limits. A drag renders when it starts and when it
  // ends; in between the width follows the pointer through a CSS variable.
  const [draggedColumn, setDraggedColumn] = useState<{
    key: string;
    width: number;
  } | null>(null);
  const draggedKey = draggedColumn?.key;

  // Activity detaches the ref while keeping the table's state and DOM. A
  // handle's cleanup cancels without updating a detached parent; attaching
  // the table again clears the visual width retained from that gesture.
  const tableRefCallback = useCallback((element: HTMLTableElement | null) => {
    tableRef.current = element;
    if (!element) return;
    element.style.removeProperty(DRAG_WIDTH_VARIABLE);
    setDraggedColumn(null);
  }, []);

  const canResize = (column: Column<T>) =>
    resizableColumns && column.resizable !== false;

  const handleColumnDrag = (key: string, width: number | null) => {
    const table = tableRef.current;

    if (width === null) {
      table?.style.removeProperty(DRAG_WIDTH_VARIABLE);
      isDraggingRef.current = false;
      // What the columns measured while the drag lasted
      const pending = pendingWidthsRef.current;
      pendingWidthsRef.current = null;
      // The whole table was unmounted or hidden, not just its handle.
      if (!table) return;
      setDraggedColumn(null);
      if (pending) setMeasuredWidths((prev) => mergeWidths(prev, pending));
      return;
    }

    table?.style.setProperty(DRAG_WIDTH_VARIABLE, `${width}px`);
    if (draggedKey !== key) {
      isDraggingRef.current = true;
      setDraggedColumn({ key, width });
    }
  };

  const sizedWidths = columnRecord<number>();
  for (const column of sortedVisibleColumns) {
    const userWidth = canResize(column)
      ? draggedColumn?.key === column.key
        ? draggedColumn.width
        : userWidths[column.key]
      : undefined;
    const width = userWidth ?? column.width ?? frozenWidths?.[column.key];
    if (width !== undefined) {
      sizedWidths[column.key] = clampWidth(
        width,
        column.minWidth ?? 0,
        column.maxWidth ?? Infinity,
      );
    }
  }
  // The widths the resize handles start from and announce. Copy before
  // serializing, so the React Compiler can keep the layout memo below.
  const currentWidths = columnRecord<number | undefined>({
    ...measuredWidths,
    ...sizedWidths,
  });
  const sizedWidthsKey = JSON.stringify(sizedWidths);
  // Every column sized - the table is as wide as they are, not stretched
  const isEverySized =
    sortedVisibleColumns.length > 0 &&
    sortedVisibleColumns.every((column) => column.key in sizedWidths);

  const hasCellEditing = !!onCellEdit;
  const hasRowLinks = getRowHref !== undefined;

  // Where the cells of each column go, in the order the columns are shown:
  // the expand, selection and actions columns stick first, then the columns
  // pinned to the left - the start, the right edge of a right-to-left table;
  // the last of them and the first column pinned to the right (the end) cast
  // a shadow while the table is scrolled under them
  const layout = useMemo(() => {
    const widths = columnRecord(
      JSON.parse(sizedWidthsKey) as Record<string, number>,
    );
    const widthOf = (key: string, fallback: number) =>
      widths[key] ?? measuredWidths[key] ?? fallback;
    const totalWidth = (keys: string[]) =>
      keys.reduce((total, key) => total + widthOf(key, 0), 0);

    // Pinned columns stick while they leave half of the view to the others -
    // on a phone they would cover it. The right ones give way first.
    const leadingKeys = [
      renderSubRow && LEADING_KEYS.expand,
      hasSelection && LEADING_KEYS.selection,
      actions && LEADING_KEYS.actions,
    ].filter((key): key is string => !!key);
    const visibleKeys = sortedVisibleColumns.map((column) => column.key);
    let leftPinned = visibleKeys.filter((key) =>
      pinnedColumns.left.includes(key),
    );
    let rightPinned = visibleKeys.filter((key) =>
      pinnedColumns.right.includes(key),
    );
    const fitsView = () =>
      !viewWidth ||
      totalWidth([...leadingKeys, ...leftPinned, ...rightPinned]) <=
        viewWidth / 2;
    if (!fitsView()) rightPinned = [];
    if (!fitsView()) leftPinned = [];

    const layouts = columnRecord<CellLayout>();
    for (const key of visibleKeys) {
      if (widths[key] !== undefined) layouts[key] = { width: widths[key] };
    }

    // The offsets past a column being dragged follow its width
    let dragOffset: number | undefined;
    const startKeys = [...leadingKeys, ...leftPinned];
    let offset = 0;
    for (const key of startKeys) {
      layouts[key] = { dragOffset, start: offset, width: widths[key] };
      if (key === draggedKey) dragOffset = widths[key];
      offset += widthOf(
        key,
        key === LEADING_KEYS.expand
          ? 40
          : key === LEADING_KEYS.selection
            ? 30
            : 0,
      );
    }
    const start = offset;

    dragOffset = undefined;
    offset = 0;
    let firstEndKey: string | undefined;
    for (const key of [...rightPinned].reverse()) {
      layouts[key] = { dragOffset, end: offset, width: widths[key] };
      if (key === draggedKey) dragOffset = widths[key];
      offset += widthOf(key, 0);
      firstEndKey = key;
    }

    if (draggedKey && layouts[draggedKey]) {
      layouts[draggedKey] = { ...layouts[draggedKey], dragged: true };
    }

    // A pinned column is resized only as far as the pinned columns still
    // leave half of the view - wider, they would all scroll along, the
    // resized column out of view and its handle to its other edge
    if (viewWidth) {
      const room =
        viewWidth / 2 -
        totalWidth([...leadingKeys, ...leftPinned, ...rightPinned]);
      for (const key of [...leftPinned, ...rightPinned]) {
        layouts[key] = {
          ...layouts[key],
          maxResizeWidth: Math.floor(widthOf(key, 0) + room),
        };
      }
    }

    const lastStartKey = startKeys.at(-1);
    if (lastStartKey && scrollEdges.start) {
      layouts[lastStartKey] = { ...layouts[lastStartKey], shadow: "start" };
    }
    if (firstEndKey && scrollEdges.end) {
      layouts[firstEndKey] = { ...layouts[firstEndKey], shadow: "end" };
    }

    // Hidden on narrow screens - not a column that must stay: a pinned one,
    // whose offsets count on its width (pinned, not only while it sticks -
    // hidden, it measures no width and would stick again, shown, too wide
    // to stick); one of a group, whose header spans it; an editable one,
    // whose cell may be the tab stop of the editable cells; the first one of
    // rows with links, which holds them
    sortedVisibleColumns.forEach((column, index) => {
      const columnLayout = layouts[column.key] ?? DEFAULT_CELL_LAYOUT;
      if (
        column.hideBelow &&
        !pinnedColumns.left.includes(column.key) &&
        !pinnedColumns.right.includes(column.key) &&
        groupOf[column.key] === undefined &&
        !(hasCellEditing && column.editable) &&
        !(hasRowLinks && index === 0)
      ) {
        layouts[column.key] = { ...columnLayout, hideBelow: column.hideBelow };
      }
    });

    return { end: offset, layouts, start };
  }, [
    actions,
    draggedKey,
    groupOf,
    hasCellEditing,
    hasRowLinks,
    hasSelection,
    measuredWidths,
    pinnedColumns.left,
    pinnedColumns.right,
    renderSubRow,
    scrollEdges.end,
    scrollEdges.start,
    sizedWidthsKey,
    sortedVisibleColumns,
    viewWidth,
  ]);

  // Inline editing: the cell being edited, and the changes of cells being
  // saved, saved or refused - kept by cell, whatever the row objects are
  const [editingCell, setEditingCell] = useState<{
    columnKey: string;
    rowId: RowId;
  } | null>(null);
  const [cellStates, setCellStates] = useState<
    ReadonlyMap<string, CellEditState<T>>
  >(() => new Map());
  const editHintId = useId();

  // A refused change is announced once, here - the message under its cell
  // is plain text, which a row rendered again (another page and back, a
  // virtualized table scrolling) must not announce again. Announced, it
  // goes, so that no one reading the page finds it later.
  const [editAnnouncement, setEditAnnouncement] = useState<{
    id: number;
    /** The cell refused - its message goes with it. */
    key: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!editAnnouncement) return;
    const timer = setTimeout(
      () => setEditAnnouncement(null),
      ANNOUNCEMENT_DURATION,
    );
    return () => clearTimeout(timer);
  }, [editAnnouncement]);

  // New rows drop the changes that no longer show - a refusal must not stay
  // under a cell that holds another value by now, nor the changes of rows
  // gone pile up
  const [cellStatesData, setCellStatesData] = useState(data);
  if (cellStates.size > 0 && cellStatesData !== data) {
    const pruned = pruneCellStates(cellStates, data, columns, getRowId);
    setCellStatesData(data);
    setCellStates(pruned);
    if (editAnnouncement && !pruned.has(editAnnouncement.key)) {
      setEditAnnouncement(null);
    }
  }

  // The rows as they are when a save ends - the current object of its row
  const latestData = useRef(data);

  useLayoutEffect(() => {
    latestData.current = data;
  });

  // While a cell is edited the rows stay where they are: a saved value that
  // sorts or filters its row away (or onto another page) must not take the
  // field being edited next along. The rows show their new values - their
  // new order comes once the editing ends. The query the rows were shown
  // for is kept too - another page, sorting or filter ends the editing.
  const [frozenRows, setFrozenRows] = useState<{
    ids: RowId[];
    query: DataTableQuery;
  } | null>(null);
  if (editingCell && !frozenRows) {
    setFrozenRows({ ids: rows.map((row) => getRowId(row)), query });
  } else if (!editingCell && frozenRows) {
    setFrozenRows(null);
  }
  const frozenRowIds = frozenRows?.ids;

  const bodyRows = useMemo(() => {
    if (!frozenRowIds) return rows;

    const rowsById = new Map(data.map((row) => [getRowId(row), row]));
    return frozenRowIds.flatMap((id) => {
      const row = rowsById.get(id);
      return row ? [row] : [];
    });
  }, [data, frozenRowIds, rows, getRowId]);

  const rowGroups = useMemo(
    () =>
      groupColumns.length
        ? groupRowsBy(
            bodyRows,
            matchingRows ?? bodyRows,
            groupColumns,
            sort,
            locale,
          )
        : null,
    [bodyRows, groupColumns, locale, matchingRows, sort],
  );
  const [internalCollapsedGroups, setCollapsedGroups] = useState<
    ReadonlySet<string>
  >(() => new Set(defaultCollapsedGroupKeys));
  const collapsedGroups = useMemo(
    () =>
      collapsedGroupKeys
        ? new Set(collapsedGroupKeys)
        : internalCollapsedGroups,
    [collapsedGroupKeys, internalCollapsedGroups],
  );
  const bodyGroups = useMemo<BodyRowGroup[] | null>(() => {
    const build = (groups: NestedRowGroup<T>[]): BodyRowGroup[] =>
      groups.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        const metadata = groupMetadata?.[group.key];
        return {
          collapsed,
          count: metadata?.count ?? group.allRows.length,
          key: group.key,
          label: group.label,
          columnLabel: group.columnLabel,
          level: group.level,
          size: collapsed ? 0 : group.rows.length,
          summary:
            metadata?.summaryValues ??
            summarizeGroup(sortedVisibleColumns, group.allRows),
          children: group.children
            ? collapsed
              ? []
              : build(group.children)
            : undefined,
        };
      });
    return rowGroups ? build(rowGroups) : null;
  }, [collapsedGroups, groupMetadata, rowGroups, sortedVisibleColumns]);
  const shownRows = useMemo(() => {
    const flatten = (groups: NestedRowGroup<T>[]): T[] =>
      groups.flatMap((group) =>
        collapsedGroups.has(group.key)
          ? []
          : group.children
            ? flatten(group.children)
            : group.rows,
      );
    return rowGroups ? flatten(rowGroups) : bodyRows;
  }, [bodyRows, collapsedGroups, rowGroups]);
  const toggleGroup = (key: string) => {
    const next = new Set(collapsedGroups);
    if (!next.delete(key)) next.add(key);
    if (collapsedGroupKeys === undefined) setCollapsedGroups(next);
    onCollapsedGroupKeysChange?.([...next]);
  };

  // Shift + click selects the rows from the row clicked before - in the
  // order they are shown
  const [selectionAnchor, setSelectionAnchor] = useState<RowId | null>(null);

  const handleToggleRowSelection = (row: T, extend: boolean) => {
    if (!canSelectRow(row)) return;
    const isChecked = !displayedSelectedIds.has(getRowId(row));
    setSelectionAnchor(getRowId(row));

    if (selectionMode === "single") {
      commitSelection(isChecked ? [getRowId(row)] : []);
      return;
    }

    // The rows from the anchor to this one, or this one alone
    const anchorIndex =
      extend && selectionAnchor !== null
        ? shownRows.findIndex(
            (candidate) => getRowId(candidate) === selectionAnchor,
          )
        : -1;
    const rowIndex = shownRows.indexOf(row);
    const rangeRows =
      anchorIndex === -1 || rowIndex === -1
        ? [row]
        : shownRows.slice(
            Math.min(anchorIndex, rowIndex),
            Math.max(anchorIndex, rowIndex) + 1,
          );
    const toggled = rangeRows.filter(canSelectRow);
    const toggledIds = new Set(toggled.map((candidate) => getRowId(candidate)));

    if (isAllFilteredSelected) {
      // All matching rows but the unchecked ones - checked again, a row is
      // back in; with none left, nothing is selected
      const excluded = [
        ...excludedRows.filter((current) => !toggledIds.has(getRowId(current))),
        ...(isChecked ? [] : toggled),
      ];

      if (excluded.length >= selectionTotal) {
        resetAllSelection();
      } else {
        commitSelection([], excluded);
      }
      return;
    }

    const others = selectedIdList.filter((id) => !toggledIds.has(id));
    commitSelection(
      isChecked
        ? [...others, ...toggled.map((item) => getRowId(item))]
        : others,
    );
  };

  // The detail rows shown - of the rows the body shows
  const expandedRows = useMemo(
    () =>
      controlledExpandedIds !== undefined || explicitExpandedIds !== undefined
        ? new Set(controlledExpandedIds ?? explicitExpandedIds)
        : new Set(
            shownRows
              .map((row) => getRowId(row))
              .filter((id) => expandedByDefault !== toggledRows.has(id)),
          ),
    [
      controlledExpandedIds,
      explicitExpandedIds,
      expandedByDefault,
      shownRows,
      toggledRows,
      getRowId,
    ],
  );

  const toggleRowExpansion = (rowId: RowId) => {
    const next = new Set(expandedRows);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    if (controlledExpandedIds === undefined) {
      if (explicitExpandedIds !== undefined) setExplicitExpandedIds([...next]);
      else
        setToggledRows((previous) => {
          const toggled = new Set(previous);
          if (toggled.has(rowId)) toggled.delete(rowId);
          else toggled.add(rowId);
          if (toggled.size > MAX_TOGGLED_ROWS)
            toggled.delete(toggled.values().next().value as RowId);
          return toggled;
        });
    }
    onExpandedIdsChange?.([...next]);
  };

  // A row gone from the data takes its editing along, and so do a hidden
  // column and another query - rows frozen for a field left open with an
  // invalid value would not follow the page, sorting or filters the header
  // and the pagination show - and a collapsed group
  if (
    editingCell &&
    (!shownRows.some((row) => getRowId(row) === editingCell.rowId) ||
      !sortedVisibleColumns.some(
        (column) => column.key === editingCell.columnKey,
      ) ||
      (frozenRows && !isSameQuery(frozenRows.query, query)))
  ) {
    setEditingCell(null);
  }

  // By whether there is an `onCellEdit`, not by its identity - a new one on
  // every render of the parent does not render all rows again
  const isEditable = useCallback(
    (column: Column<T>, row: T) =>
      hasCellEditing && isEditableCell(column, row),
    [hasCellEditing],
  );

  /** Whether a change of the cell is being saved. */
  const isCellPending = (row: T, column: Column<T>) =>
    cellStates.get(getCellKey(getRowId(row), column.key))?.status === "pending";

  const handleStartEdit = (rowId: RowId, columnKey: string) =>
    setEditingCell({ columnKey, rowId });

  // The first value of a column among the rows - an empty cell is edited
  // in the field its column's values need. The same function for the same
  // rows, so that the (memoized) rows do not render again.
  const getColumnSample = useCallback(
    (column: Column<T>) => {
      for (const row of data) {
        const value = getColumnValue(row, column);
        if (!isEmpty(value)) return value;
      }
      return undefined;
    },
    [data],
  );

  const saveCellEdit = (
    row: T,
    column: Column<T>,
    value: unknown,
    previous: unknown,
  ) => {
    if (!onCellEdit) return;

    const key = getCellKey(getRowId(row), column.key);
    const originalValue = getColumnValue(row, column);
    // Editing waits for a save of the cell to end - no other can overtake it
    const isThisSave = (state: CellEditState<T> | undefined) =>
      state?.status === "pending" && Object.is(state.value, value);
    setCellStates((states) =>
      withCellState(states, key, { status: "pending", value }),
    );
    // A refusal of the cell announced before is over
    setEditAnnouncement((current) => (current?.key === key ? null : current));

    runCellEdit(onCellEdit, row, column.key, value).then(
      (result) => {
        // A value the app updated while saving (including normalization by
        // the server) wins. A poll still holding the old value keeps the
        // saved draft until a later update brings the saved data. An
        // explicit result also identifies normalization back to the old
        // value, which cannot be distinguished from a poll by data alone.
        const current = latestData.current.find(
          (candidate) => getRowId(candidate) === getRowId(row),
        );
        const keepDraft =
          current &&
          (result !== undefined ||
            isSameValue(getColumnValue(current, column), originalValue));
        setCellStates((states) =>
          isThisSave(states.get(key))
            ? withCellState(
                states,
                key,
                keepDraft
                  ? {
                      row: current,
                      status: "saved",
                      value: result ? result.value : value,
                    }
                  : null,
              )
            : states,
        );
      },
      (error: unknown) => {
        logger.error(`Saving the cell "${column.key}" failed`, error);
        const message = getEditErrorMessage(
          error,
          messages.dataTable.editFailed,
        );
        setCellStates((states) =>
          isThisSave(states.get(key))
            ? withCellState(states, key, {
                message,
                previous,
                refused: value,
                status: "failed",
              })
            : states,
        );
        setEditAnnouncement((current) => ({
          id: (current?.id ?? 0) + 1,
          key,
          text: message,
        }));
      },
    );
  };

  // The next (or previous) editable cell in the order they are shown - Tab
  // in an edited cell
  const findEditableCell = (row: T, column: Column<T>, move: -1 | 1) => {
    const rowIndex = shownRows.findIndex(
      (candidate) => getRowId(candidate) === getRowId(row),
    );
    const columnIndex = sortedVisibleColumns.indexOf(column);
    const width = sortedVisibleColumns.length;

    for (
      let position = rowIndex * width + columnIndex + move;
      position >= 0 && position < shownRows.length * width;
      position += move
    ) {
      const nextRow = shownRows[Math.floor(position / width)];
      const nextColumn = sortedVisibleColumns[position % width];
      if (
        isEditable(nextColumn, nextRow) &&
        !isCellPending(nextRow, nextColumn)
      ) {
        return { columnKey: nextColumn.key, rowId: getRowId(nextRow) };
      }
    }

    return null;
  };

  const handleCommitEdit = (
    row: T,
    column: Column<T>,
    change: CellChange,
    move: -1 | 0 | 1,
  ) => {
    if (change) {
      // What the cell shows - also the value from before a refused save
      const { value: shown } = getShownValue(
        cellStates.get(getCellKey(getRowId(row), column.key)),
        row,
        getColumnValue(row, column),
      );
      if (!isSameValue(shown, change.value)) {
        saveCellEdit(row, column, change.value, shown);
      }
    }

    const next = move ? findEditableCell(row, column, move) : null;
    setEditingCell(next);
    return !!next;
  };

  // CSV export - one at a time
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const isExportRunning = useRef(false);

  const handleExport = async () => {
    if (isExportRunning.current) return;
    setExportError(false);

    // What the user sees now - the columns may change while rows load
    const exportColumns = onExport
      ? sortedVisibleColumns
      : sortedVisibleColumns.map((column) =>
          column.exportValue
            ? column
            : {
                ...column,
                // The same value as the cell, including a rejected
                // optimistic update or a save awaiting refreshed data.
                // Resolve by column: getValue may read a nested value
                // that cannot be replaced by assigning row[column.key].
                exportValue: (row: T) =>
                  getShownValue(
                    cellStates.get(getCellKey(getRowId(row), column.key)),
                    row,
                    getColumnValue(row, column),
                  ).value,
              },
        );
    let exportRows: T[] | null = matchingRows ?? rows;

    if (onExport) {
      isExportRunning.current = true;
      setIsExporting(true);
      const result = await loadExportRows(onExport, query);
      exportRows = "rows" in result ? (result.rows ?? null) : null;
      isExportRunning.current = false;
      setIsExporting(false);
      if ("error" in result) {
        setExportError(true);
        onExportError?.(result.error);
      }
    }

    if (exportRows) {
      try {
        downloadCsv(
          createCsv(exportRows, exportColumns, {
            locale,
            separator: csvSeparator,
          }),
          exportFilename,
        );
      } catch (error) {
        logger.error("The CSV export failed", error);
        setExportError(true);
        onExportError?.(error);
      }
    }
  };

  // A row of the column groups over the headers of their columns
  const hasColumnGroups = sortedVisibleColumns.some(
    (column) => groupOf[column.key] !== undefined,
  );
  const headerRowCount = (hasFilterColumns ? 2 : 1) + (hasColumnGroups ? 1 : 0);
  // Rows measured under another density, or with a column the user resized,
  // have other heights now - a virtualized table measures them again. Not
  // a view of another width (a resized window, a sidebar), whose widths the
  // columns sized by their content follow: the rows keep their heights.
  const rowLayoutKey = virtualized
    ? `${density}|${JSON.stringify(
        columns.map(
          (column) =>
            (canResize(column) ? userWidths[column.key] : undefined) ??
            column.width,
        ),
      )}`
    : "";
  // Virtualized, most rows are not in the page - screen readers learn their
  // number (and place, `aria-rowindex`) from the attributes
  const rowCount = virtualized
    ? headerRowCount +
      shownRows.length +
      (renderSubRow
        ? shownRows.filter((row) => expandedRows.has(getRowId(row))).length
        : 0) +
      countGroupRows(bodyGroups) +
      (hasSummaryRow ? 1 : 0)
    : undefined;

  return (
    <div
      aria-label={
        ariaLabel ?? (ariaLabelledBy ? undefined : messages.dataTable.region)
      }
      aria-labelledby={ariaLabelledBy}
      role="region"
      {...props}
      className={cn(
        isFullScreen
          ? "fixed inset-0 z-50 bg-surface dark:bg-surface-dark"
          : "relative",
        className,
      )}
      ref={rootRefCallback}
    >
      {/* Popovers opened in the table count as part of it in full screen */}
      <OverlayContext value={childContext}>
        {exportError && (
          <div
            role="alert"
            className="mb-2 text-sm text-danger-700 dark:text-danger-400"
          >
            {messages.dataTable.exportFailed}
          </div>
        )}
        {hasGroupActions && (rowsTotal ?? rows.length) > 0 && (
          <div
            className="mb-2 flex flex-wrap items-center gap-3.5"
            ref={actionBarRef}
          >
            <div className="flex flex-wrap gap-2">
              {groupActions.map((action, index) => {
                const isUnavailable =
                  selectedCount === 0 ||
                  (runningAction !== null && runningAction !== index);
                const isKept = isUnavailable && focusedAction === index;

                return (
                  <Button
                    aria-disabled={isKept || undefined}
                    className={
                      isKept ? "cursor-not-allowed opacity-60" : undefined
                    }
                    disabled={isUnavailable && !isKept}
                    // Labels need not be unique - the running action is
                    // tracked by the index too
                    key={index}
                    loading={runningAction === index}
                    onBlur={() => setFocusedAction(null)}
                    onClick={
                      isUnavailable
                        ? undefined
                        : () => runGroupAction(action, index)
                    }
                    onFocus={() => setFocusedAction(index)}
                    size="sm"
                    variant="outline"
                  >
                    {action.label}
                  </Button>
                );
              })}
            </div>
            {/* A live region is announced when its content changes - it is
                there, empty, before the first row is selected */}
            {!selectionConfig && (
              <div
                aria-live="polite"
                className="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
              >
                {selectedCount > 0 &&
                  formatPlural(
                    locale.code,
                    messages.dataTable.selectedCount,
                    selectedCount,
                  )}
              </div>
            )}
          </div>
        )}
        {/* Without group actions the count is only announced */}
        {selectionMode === "multiple" &&
          !hasGroupActions &&
          !selectionConfig && (
            <div aria-live="polite" className="sr-only">
              {selectedCount > 0 &&
                formatPlural(
                  locale.code,
                  messages.dataTable.selectedCount,
                  selectedCount,
                )}
            </div>
          )}
        {selectionConfig && (
          <div aria-live="polite">
            {selectedCount > 0 && (
              <div className="mb-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-950 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-50">
                {isAllFilteredSelected ? (
                  <>
                    {excludedRows.length === 0
                      ? renderSelectionLabel(
                          selectionConfig.allSelectionLabel ??
                            messages.dataTable.selection.all,
                          selectionTotal,
                        )
                      : renderSelectionLabel(
                          selectionConfig.allExceptSelectionLabel ??
                            messages.dataTable.selection.allExcept,
                          selectedCount,
                        )}{" "}
                    <button
                      className="font-semibold text-primary-700 underline hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                      onClick={() => {
                        // The bar goes with the selection - and would take
                        // the focus of the button along to the page
                        selectAllRef.current?.focus();
                        resetAllSelection();
                      }}
                      type="button"
                    >
                      {selectionConfig.clearSelectionLabel ??
                        messages.dataTable.selection.clear}
                    </button>
                  </>
                ) : (
                  <>
                    {renderSelectionLabel(
                      selectionConfig.pageSelectionLabel ??
                        messages.dataTable.selection.page,
                      rows.filter((row) => selectedIds.has(getRowId(row)))
                        .length,
                    )}{" "}
                    {isAllSelected && selectionTotal > rows.length && (
                      <button
                        className="font-semibold text-primary-700 underline hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                        onClick={() => commitSelection([], [])}
                        type="button"
                      >
                        {selectionConfig.selectAllLabel
                          ? formatMessage(selectionConfig.selectAllLabel, {
                              count: formatNumber(locale.code, selectionTotal),
                            })
                          : formatPlural(
                              locale.code,
                              messages.dataTable.selection.selectAll,
                              selectionTotal,
                            )}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {onCellEdit && (
          <>
            <span hidden id={editHintId}>
              {messages.dataTable.editCell}
            </span>
            {/* There before the first refusal - a live region is announced
                when its content changes; a new node also repeats a message */}
            <div aria-live="assertive" className="sr-only">
              {editAnnouncement && (
                <span key={editAnnouncement.id}>{editAnnouncement.text}</span>
              )}
            </div>
          </>
        )}
        <div
          className="overflow-x-auto rounded-t-lg border border-neutral-100 bg-surface shadow-lg dark:border-neutral-900 dark:bg-surface-dark"
          data-table-scroll=""
          onFocus={(event) => {
            // What sticks is in view already, but the browser scrolls the
            // table to where it would be without sticking - and out from
            // under the scroll padding meant for the rows. It does so before
            // the focus event, whose scroll event is still to come, so the
            // position before it is known. The toolbar sticks both ways, the
            // header and summary rows up and down, pinned cells sideways.
            const target = event.target as Element;
            const container = event.currentTarget;
            const isInToolbar = !!headerRef.current?.contains(target);
            const isInStickyRow =
              isInToolbar ||
              !!theadRef.current?.contains(target) ||
              !!tfootRef.current?.contains(target);
            const isInStickyCell =
              isInToolbar ||
              !!target.closest("td, th")?.classList.contains("sticky");

            if (isInStickyRow && container.scrollTop !== scrollTopRef.current) {
              container.scrollTop = scrollTopRef.current;
            }
            if (
              isInStickyCell &&
              container.scrollLeft !== scrollLeftRef.current
            ) {
              container.scrollLeft = scrollLeftRef.current;
            }
          }}
          ref={scrollRef}
          style={{
            maxHeight: isFullScreen ? "calc(100vh - 50px)" : maxHeight,
            // Virtualized rows are swapped for spacers while the table
            // scrolls - the browser must not move the scroll to keep them
            overflowAnchor: virtualized ? "none" : undefined,
            // A control the focus moves to is scrolled out from under the
            // sticky parts - the header rows, the summary, pinned columns
            scrollPaddingBottom: stickyHeights.foot,
            scrollPaddingInlineEnd: layout.end,
            scrollPaddingInlineStart: layout.start,
            scrollPaddingTop: headerHeight + stickyHeights.head,
          }}
        >
          <TableHeader
            columnOrder={columnOrder}
            columnGroups={columnGroups}
            columns={columns}
            columnVisibility={columnVisibility}
            defaultSearchOpen={defaultSearchOpen}
            groupOf={groupOf}
            density={density}
            densityControl={densityControl}
            enableGlobalSearch={enableGlobalSearch}
            handleDragOver={handleDragOver}
            handleDragStart={handleDragStart}
            handleDrop={handleDrop}
            handlePinColumn={handlePinColumn}
            hasActiveFilters={hasActiveFilters}
            hasCustomSettings={hasCustomSettings}
            isExporting={isExporting}
            isFullScreen={isFullScreen}
            onClearFilters={clearFilters}
            onDensityChange={(value) =>
              setDensity(value === defaultDensity ? null : value)
            }
            onExport={enableCsvExport || onExport ? handleExport : undefined}
            onMoveColumn={moveColumn}
            onResetSettings={handleResetSettings}
            onSearchChange={(search) =>
              updateQuery((current) =>
                current.search === search
                  ? current
                  : resetPagination(current, { search }),
              )
            }
            pinnedColumns={pinnedColumns}
            ref={headerRef}
            search={searchTerm}
            setColumnVisibility={changeColumnVisibility}
            setIsFullScreen={setIsFullScreen}
            // The header of the actions column has the button otherwise - in
            // the row of the filters, which only a visible filter field adds
            showClearFilters={hasFilterColumns ? !actions : hasHiddenFilters}
            toolbar={toolbar}
          />

          <table
            aria-busy={loading || undefined}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-rowcount={rowCount}
            // Holds the loading overlay - it must not cover the toolbar and
            // the pagination
            className={cn(
              "relative bg-surface dark:bg-surface-dark",
              isEverySized ? "w-auto" : "w-full",
            )}
            ref={tableRefCallback}
          >
            <TableHead
              actionColumnRef={actionColumnRef}
              actions={actions}
              canResize={canResize}
              cellLayouts={layout.layouts}
              columnRefs={columnRefs}
              columnWidths={currentWidths}
              columnGroups={hasColumnGroups ? columnGroups : null}
              expandColumnRef={expandColumnRef}
              filterResetKey={filterResetKey}
              filters={query.filters}
              groupOf={groupOf}
              handleDragOver={handleDragOver}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              hasActiveFilters={hasActiveFilters}
              // All matching rows, or all of the page - mixed while some
              // are unchecked
              isAllSelected={
                isAllFilteredSelected
                  ? excludedRows.length === 0
                  : isAllSelected
              }
              isSomeSelected={
                isAllFilteredSelected ||
                rows.some((row) => selectedIds.has(getRowId(row)))
              }
              multiSort={multiSort}
              onClearFilters={clearFilters}
              onColumnDrag={handleColumnDrag}
              onColumnResize={setColumnWidth}
              onColumnResizeReset={(key) => setColumnWidth(key, null)}
              onFilterChange={(key, value) =>
                updateQuery((current) => setFilter(current, key, value))
              }
              onSort={(key, multi) =>
                updateQuery((current) =>
                  toggleSort(
                    // On the sorting the headers show - a column they cannot
                    // show (a hand-edited URL) would stay in front of it
                    resetPagination(current, {
                      sort: getQuerySort(current).filter((item) =>
                        isShownSortKey(item.key),
                      ),
                    }),
                    key,
                    { multi: multi && multiSort },
                  ),
                )
              }
              ref={theadRef}
              renderSubRow={renderSubRow}
              selectAllRef={selectAllRef}
              selectAllDisabled={selectableRows.length === 0}
              selectionColumnRef={selectionColumnRef}
              selectionMode={selectionMode}
              sort={sort}
              sortedVisibleColumns={sortedVisibleColumns}
              stickyTop={headerHeight}
              toggleSelectAll={handleToggleSelectAll}
            />

            <TableBody
              actions={actions}
              cellLayouts={layout.layouts}
              cellStates={cellStates}
              data={shownRows}
              density={density}
              editHintId={editHintId}
              editingCell={editingCell}
              emptyMessage={emptyMessage}
              expandedRows={expandedRows}
              filters={query.filters}
              getColumnSample={getColumnSample}
              getRowBackgroundColor={getRowBackgroundColor}
              getRowClassName={getRowClassName}
              getRowHref={getRowHref}
              getRowId={getRowId}
              isRowSelectable={isRowSelectable}
              groups={bodyGroups}
              headerRowCount={headerRowCount}
              isEditable={isEditable}
              layoutKey={rowLayoutKey}
              loading={loading}
              onCancelEdit={() => setEditingCell(null)}
              onCommitEdit={handleCommitEdit}
              onRowClick={onRowClick}
              onStartEdit={handleStartEdit}
              onToggleGroup={toggleGroup}
              renderSubRow={renderSubRow}
              scrollRef={scrollRef}
              search={searchTerm}
              selectedIds={displayedSelectedIds}
              selectionMode={selectionMode}
              sortedVisibleColumns={sortedVisibleColumns}
              toggleRowExpansion={toggleRowExpansion}
              toggleRowSelection={handleToggleRowSelection}
              virtualized={virtualized}
            />

            {hasSummaryRow && summaryData && (
              <TableSummary
                ariaRowIndex={rowCount}
                cellLayouts={layout.layouts}
                density={density}
                hasActions={!!actions}
                hasSelection={hasSelection}
                hasSubRows={!!renderSubRow}
                ref={tfootRef}
                sortedVisibleColumns={sortedVisibleColumns}
                values={summaryData}
              />
            )}
          </table>
        </div>

        {pagination && (
          <TableFooter
            label={ariaLabel}
            labelledBy={ariaLabelledBy}
            loading={loading}
            page={page}
            pageInfo={pageInfo}
            pageSizeOptions={pageSizeOptions}
            query={query}
            total={rowsTotal}
            updateQuery={updateQuery}
          />
        )}
      </OverlayContext>
    </div>
  );
}
