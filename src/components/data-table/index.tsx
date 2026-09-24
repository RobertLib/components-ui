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
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "../button";
import cn from "../../utils/cn";
import logger from "../../utils/logger";
import useColumnManagement from "./use-column-management";
import usePendingValue from "./use-pending-value";
import useQueryColumns from "./use-query-columns";
import useRowSelection from "./use-row-selection";
import {
  clampWidth,
  DRAG_WIDTH_VARIABLE,
  type CellLayout,
} from "./cell-layout";
import { computeSummary } from "./summary";
import { createCsv, downloadCsv } from "./csv";
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
  isFilterColumn,
  isSameQuery,
  paginateRows,
  resetPagination,
  setFilter,
  toggleSort,
  type DataTableQuery,
} from "./query";
import {
  formatMessage,
  formatNumber,
  formatPlural,
  pluralForm,
} from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";
import type { PluralMessage } from "../../i18n/types";
import type {
  Column,
  DataTableDensity,
  FilteredSelectionConfig,
  GroupAction,
  GroupActionSelection,
  RowId,
} from "./types";

export type {
  CellEditorProps,
  Column,
  ColumnEditor,
  ColumnFilter,
  ColumnPin,
  ColumnSummary,
  DataTableDensity,
  FilteredSelectionConfig,
  GroupAction,
  GroupActionSelection,
  RowId,
} from "./types";

const MAX_TOGGLED_ROWS = 1000;

/** The measured widths with new ones - the same object when none changed. */
function mergeWidths(
  widths: Record<string, number>,
  changes: Record<string, number>,
) {
  return Object.entries(changes).every(([key, width]) => widths[key] === width)
    ? widths
    : { ...widths, ...changes };
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
 * The rows `onExport` gives - `null` when it fails, which is logged. Kept
 * out of the component, which the React Compiler compiles.
 */
async function loadExportRows<T>(
  onExport: (query: DataTableQuery) => T[] | Promise<T[]>,
  query: DataTableQuery,
) {
  try {
    return await onExport(query);
  } catch (error) {
    logger.error("The CSV export failed", error);
    return null;
  }
}

export interface DataTableProps<T extends { id: RowId }> extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** Content of a sticky first column, e.g. edit / delete buttons. */
  actions?: (row: T) => React.ReactNode;
  /** Drop the selection after a group action (unless it returns `false`). */
  autoResetSelectedRows?: boolean;
  /**
   * The table filters, searches, sorts and pages `data` itself - pass all
   * rows. Otherwise `data` is the current page, loaded for `query`.
   */
  clientSide?: boolean;
  /** Column definitions - see `Column`. */
  columns: Column<T>[];
  /**
   * Field separator of the CSV export - by default `;` for languages
   * writing a decimal comma (so e.g. a Czech Excel opens the file in
   * columns) and `,` for the others.
   */
  csvSeparator?: string;
  /** Rows to show - the current page, or all rows with `clientSide`. */
  data: T[];
  /** Initial query of an uncontrolled table. */
  defaultQuery?: Partial<DataTableQuery>;
  /** Opens the global search field right away. */
  defaultSearchOpen?: boolean;
  /**
   * Height of the rows. The user can switch it in the toolbar - the choice
   * is remembered under `tableId`.
   */
  density?: DataTableDensity;
  /** Set to `false` to leave the row density control out of the toolbar. */
  densityControl?: boolean;
  /** Replaces the generic "no data" text shown when the table has no rows. */
  emptyMessage?: string;
  /**
   * Adds a CSV export button to the toolbar. It exports every page of what
   * the user sees - the visible columns in their order, the values as the
   * cells show them: all rows matching the filters of a `clientSide` table,
   * the rows `onExport` returns with server data (the loaded ones without
   * it).
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
  /** Buttons acting on the selected rows - adds a checkbox column. */
  groupActions?: GroupAction<T>[];
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
   * Called with the new value of an `editable` cell - not for a field left
   * as it was, also when a refetch changed the cell meanwhile. While a
   * returned promise is pending, the cell shows the new value with a
   * spinner; when it rejects, the cell shows its old value again with the
   * message of the rejection (of an `Error`, or a generic one). Update
   * `data` with the saved value. Another page, sorting or filter ends the
   * editing.
   */
  onCellEdit?: (
    row: T,
    columnKey: string,
    value: unknown,
  ) => void | Promise<void>;
  /**
   * Server data: all rows of `query` - every page - for the CSV export. It
   * turns the export on too. The export button shows a spinner while the
   * rows load; a rejection is logged and nothing is saved - tell the user
   * about it yourself.
   */
  onExport?: (query: DataTableQuery) => T[] | Promise<T[]>;
  /** Called with the new query whenever the user pages, sorts, filters or searches. */
  onQueryChange?: (query: DataTableQuery) => void;
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
   * Server data: the values of the summary row by column key, e.g. the
   * totals of all rows matching the query - they win over the `summary` of
   * the columns. Numbers are written as the language writes them.
   */
  summaryValues?: Record<string, React.ReactNode>;
  /**
   * Remembers the column order, visibility, pinning and widths and the row
   * density in `localStorage` under this id. Include the user id when
   * several people share a browser.
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
 * A data grid with sorting, column filters, global search, pagination, row
 * selection with group actions, expandable rows, column reordering, hiding,
 * pinning and resizing, row density, inline editing, a summary row, CSV
 * export and row virtualization. Works with any data source: the table
 * reports a `DataTableQuery` and shows the rows it is given.
 */
export default function DataTable<T extends { id: RowId }>({
  actions,
  autoResetSelectedRows = false,
  className,
  clientSide = false,
  columns,
  csvSeparator,
  data,
  defaultQuery,
  defaultSearchOpen = false,
  density: defaultDensity = "normal",
  densityControl = true,
  emptyMessage,
  enableCsvExport = false,
  enableGlobalSearch = false,
  expandedByDefault = false,
  exportFilename = "export.csv",
  filteredSelection,
  getRowBackgroundColor,
  getRowClassName,
  groupActions,
  loading,
  maxHeight = "calc(100vh - 212px)",
  onCellEdit,
  onExport,
  onQueryChange,
  pageInfo,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  pagination = true,
  query: controlledQuery,
  ref,
  renderSubRow,
  resizableColumns = true,
  summaryValues,
  tableId,
  toolbar,
  total,
  virtualized = false,
  ...props
}: DataTableProps<T>) {
  const locale = useLocale();
  const { messages } = locale;

  // The `ref` prop gets the root element too
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement, []);

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
  } = useColumnManagement(columns, tableId);

  // The user's choice - unless the control to make it is gone
  const density = (densityControl && savedDensity) || defaultDensity;

  // The term of the search field - without the field nothing could show or
  // clear a search, so a `clientSide` table ignores one then
  const searchTerm = enableGlobalSearch ? query.search : "";

  // Client-side: all rows matching the filters and the search, sorted - the
  // expensive part, so it runs again only when they, the columns or these
  // parts of the query change, not on a page change or a checkbox click -
  // nor on a new `columns` array that filters and sorts the same way.
  // The search covers what the user sees - the visible columns, with dates
  // and booleans as the table shows them.
  const queryColumns = useQueryColumns(columns);
  const searchColumns = useQueryColumns(visibleColumns);
  const filtersKey = JSON.stringify(query.filters);
  const { order, sortBy } = query;
  const matchingRows = useMemo(
    () =>
      clientSide
        ? filterAndSortRows(
            data,
            {
              filters: JSON.parse(filtersKey) as DataTableQuery["filters"],
              order,
              search: searchTerm,
              sortBy,
            },
            queryColumns,
            { locale, searchColumns },
          )
        : null,
    [
      clientSide,
      data,
      filtersKey,
      locale,
      order,
      queryColumns,
      searchColumns,
      searchTerm,
      sortBy,
    ],
  );
  const clientPage =
    matchingRows && pagination
      ? paginateRows(matchingRows, query.page, query.pageSize)
      : null;
  const rows = clientPage?.rows ?? matchingRows ?? data;
  const rowsTotal = matchingRows?.length ?? total;
  const page = clientPage?.page ?? (matchingRows ? 1 : query.page);

  // The rendered widths of the columns by key - for the sticky offsets
  const [measuredWidths, setMeasuredWidths] = useState<Record<string, number>>(
    {},
  );
  const isDraggingRef = useRef(false);
  const pendingWidthsRef = useRef<Record<string, number> | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [allFilteredSelectionScope, setAllFilteredSelectionScope] = useState<
    string | null
  >(null);

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

  const toggleRowExpansion = useCallback((rowId: RowId) => {
    setToggledRows((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
        // Forget the oldest toggles of a long session - those rows go back
        // to the default
        if (newSet.size > MAX_TOGGLED_ROWS) {
          newSet.delete(newSet.values().next().value as RowId);
        }
      }

      return newSet;
    });
  }, []);

  const actionColumnRef = useRef<HTMLTableCellElement>(null);
  const expandColumnRef = useRef<HTMLTableCellElement>(null);
  const selectionColumnRef = useRef<HTMLTableCellElement>(null);
  const columnRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
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
    const values: Record<string, unknown> = {};
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
    query.sortBy,
    query.order,
    query.search,
    query.filters,
    query.after,
    query.before,
  ])}`;

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = 0;
  }, [rowsQueryKey]);

  // Whether the table is scrolled away from its left edge and short of its
  // right edge - the pinned columns cast a shadow over the scrolled ones then
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
      const start = container.scrollLeft > 0;
      const end =
        container.scrollLeft + container.clientWidth <
        container.scrollWidth - 1;
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

  const selectionConfig: FilteredSelectionConfig | null =
    filteredSelection === true ? {} : filteredSelection || null;

  const selectionScopeKey =
    selectionConfig?.scopeKey ??
    JSON.stringify({ filters: query.filters, search: query.search });
  const selectionTotal = selectionConfig?.total ?? rowsTotal ?? rows.length;

  // "All rows matching the filters" ends with the filters - it does not come
  // back when the user returns to them
  if (
    allFilteredSelectionScope !== null &&
    allFilteredSelectionScope !== selectionScopeKey
  ) {
    setAllFilteredSelectionScope(null);
  }

  // Rows that leave the page (another page, a refetch without them) leave
  // the selection - the others stay selected
  const {
    isAllSelected,
    resetSelection,
    selectedIds,
    selectedRows,
    setSelectedRows,
    toggleRowSelection,
    toggleSelectAll,
  } = useRowSelection(rows, { loading, resetKey: selectionScopeKey });

  const isAllFilteredSelected =
    !!selectionConfig && allFilteredSelectionScope === selectionScopeKey;
  const selectedCount = isAllFilteredSelected
    ? selectionTotal
    : selectedRows.length;
  const displayedSelectedIds = useMemo(
    () =>
      isAllFilteredSelected ? new Set(rows.map((row) => row.id)) : selectedIds,
    [isAllFilteredSelected, rows, selectedIds],
  );

  const resetAllSelection = () => {
    setAllFilteredSelectionScope(null);
    resetSelection();
  };

  const handleToggleRowSelection = (row: T) => {
    if (isAllFilteredSelected) {
      setAllFilteredSelectionScope(null);
      setSelectedRows(rows.filter((current) => current.id !== row.id));
      return;
    }

    toggleRowSelection(row);
  };

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      resetAllSelection();
      return;
    }

    toggleSelectAll();
  };

  // The group action that runs - its button shows a spinner and none of
  // them can be pressed again until it is done
  const [runningAction, setRunningAction] = useState<number | null>(null);
  const isActionRunning = useRef(false);

  const runGroupAction = async (action: GroupAction<T>, index: number) => {
    if (isActionRunning.current) return;
    isActionRunning.current = true;
    setRunningAction(index);

    // Client-side every matching row is loaded - all of them are selected
    const actionRows = isAllFilteredSelected
      ? (matchingRows ?? rows)
      : selectedRows;
    const actionScope = isAllFilteredSelected ? selectionScopeKey : null;
    const selection: GroupActionSelection<T> = {
      allFiltered: isAllFilteredSelected,
      count: selectedCount,
      query,
      rows: actionRows,
    };

    // A rejection keeps the selection like `false`, so the action can be
    // retried. No `finally` - the React Compiler cannot compile it.
    let shouldReset: unknown = false;
    try {
      shouldReset = await action.onClick(actionRows, selection);
    } catch (error) {
      logger.error(`The group action "${action.label}" failed`, error);
    }

    if (autoResetSelectedRows && shouldReset !== false) {
      // Only what the action got - rows selected while it ran stay
      // selected (a selection of another page is gone already)
      const actedIds = new Set(actionRows.map((row) => row.id));
      if (actionScope !== null) {
        setAllFilteredSelectionScope((scope) =>
          scope === actionScope ? null : scope,
        );
      }
      setSelectedRows((current) =>
        current.filter((row) => !actedIds.has(row.id)),
      );
    }

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

    const observer = new ResizeObserver((entries) => {
      const newWidths: Record<string, number> = {};

      entries.forEach((entry) => {
        const columnKey = entry.target.getAttribute("data-column-key");

        if (columnKey) {
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
        const widths: Record<string, number> = {};
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

    if (actions && actionColumnRef.current) {
      observer.observe(actionColumnRef.current);
    }

    if (expandColumnRef.current) observer.observe(expandColumnRef.current);

    if (selectionColumnRef.current) {
      observer.observe(selectionColumnRef.current);
    }

    Object.entries(columnRefs.current).forEach(([, ref]) => {
      if (ref) observer.observe(ref);
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
    groupActions?.length,
    renderSubRow,
    rows.length,
    visibleColumnKeys,
  ]);

  // Hiding a column takes its filter along - the field of the filter goes
  // with the column, and rows filtered by nothing visible would puzzle
  const changeColumnVisibility = (
    update:
      | Record<string, boolean>
      | ((previous: Record<string, boolean>) => Record<string, boolean>),
  ) => {
    const visibility =
      typeof update === "function" ? update(columnVisibility) : update;
    const hidden = columns.filter(
      (column) =>
        column.filter &&
        columnVisibility[column.key] &&
        visibility[column.key] === false,
    );

    setColumnVisibility(visibility);
    if (hidden.length > 0) {
      updateQuery((current) =>
        hidden.reduce(
          (next, column) => setFilter(next, column.key, ""),
          current,
        ),
      );
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

  const hasGroupActions = !!groupActions && groupActions.length > 0;
  const hasFilterColumns = sortedVisibleColumns.some((column) => column.filter);

  // Filters without a field to see or clear them in: of hidden columns
  // (from the URL, `defaultQuery` or the saved settings), a search without
  // the search field, which a server applies all the same, and filters of no
  // filterable column (an old bookmark). A `clientSide` table ignores those;
  // a server gets them - it may know them, so they stay in the query, and
  // "Clear filters" is there to drop them.
  const hasHiddenSearch = !clientSide && !enableGlobalSearch && !!query.search;
  const activeFilterKeys = Object.keys(query.filters).filter(
    (key) => !!query.filters[key],
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
        !!query.filters[column.key],
    );
  const hasActiveFilters =
    hasHiddenSearch || hasStrayFilters || activeFilterKeys.some(isColumnFilter);

  const clearFilters = () =>
    updateQuery((current) =>
      resetPagination(current, {
        filters: {},
        // Without its field, the search is one of the filters
        ...(!enableGlobalSearch && { search: "" }),
      }),
    );

  // Column widths: the one the user drags or resized the column to, or its
  // `width` - within its limits. A drag renders when it starts and when it
  // ends; in between the width follows the pointer through a CSS variable.
  const [draggedColumn, setDraggedColumn] = useState<{
    key: string;
    width: number;
  } | null>(null);
  const draggedKey = draggedColumn?.key;
  const canResize = (column: Column<T>) =>
    resizableColumns && column.resizable !== false;

  const handleColumnDrag = (key: string, width: number | null) => {
    const table = tableRef.current;

    if (width === null) {
      table?.style.removeProperty(DRAG_WIDTH_VARIABLE);
      isDraggingRef.current = false;
      setDraggedColumn(null);
      // What the columns measured while the drag lasted
      const pending = pendingWidthsRef.current;
      pendingWidthsRef.current = null;
      if (pending) setMeasuredWidths((prev) => mergeWidths(prev, pending));
      return;
    }

    table?.style.setProperty(DRAG_WIDTH_VARIABLE, `${width}px`);
    if (draggedKey !== key) {
      isDraggingRef.current = true;
      setDraggedColumn({ key, width });
    }
  };

  const sizedWidths: Record<string, number> = {};
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
  const sizedWidthsKey = JSON.stringify(sizedWidths);
  // Every column sized - the table is as wide as they are, not stretched
  const isEverySized =
    sortedVisibleColumns.length > 0 &&
    sortedVisibleColumns.every((column) => column.key in sizedWidths);

  // Where the cells of each column go, in the order the columns are shown:
  // the expand, selection and actions columns stick first, then the columns
  // pinned to the left; the last of them and the first column pinned to the
  // right cast a shadow while the table is scrolled under them
  const layout = useMemo(() => {
    const widths = JSON.parse(sizedWidthsKey) as Record<string, number>;
    const widthOf = (key: string, fallback: number) =>
      widths[key] ?? measuredWidths[key] ?? fallback;
    const totalWidth = (keys: string[]) =>
      keys.reduce((total, key) => total + widthOf(key, 0), 0);

    // Pinned columns stick while they leave half of the view to the others -
    // on a phone they would cover it. The right ones give way first.
    const leadingKeys = [
      renderSubRow && "expand",
      hasGroupActions && "selection",
      actions && "actions",
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

    const layouts: Record<string, CellLayout> = {};
    for (const key of visibleKeys) {
      if (widths[key] !== undefined) layouts[key] = { width: widths[key] };
    }

    // The offsets past a column being dragged follow its width
    let dragOffset: number | undefined;
    const leftKeys = [...leadingKeys, ...leftPinned];
    let offset = 0;
    for (const key of leftKeys) {
      layouts[key] = { dragOffset, left: offset, width: widths[key] };
      if (key === draggedKey) dragOffset = widths[key];
      offset += widthOf(
        key,
        key === "expand" ? 40 : key === "selection" ? 30 : 0,
      );
    }
    const left = offset;

    dragOffset = undefined;
    offset = 0;
    let firstRightKey: string | undefined;
    for (const key of [...rightPinned].reverse()) {
      layouts[key] = { dragOffset, right: offset, width: widths[key] };
      if (key === draggedKey) dragOffset = widths[key];
      offset += widthOf(key, 0);
      firstRightKey = key;
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

    const lastLeftKey = leftKeys.at(-1);
    if (lastLeftKey && scrollEdges.start) {
      layouts[lastLeftKey] = { ...layouts[lastLeftKey], shadow: "left" };
    }
    if (firstRightKey && scrollEdges.end) {
      layouts[firstRightKey] = { ...layouts[firstRightKey], shadow: "right" };
    }

    return { layouts, left, right: offset };
  }, [
    actions,
    draggedKey,
    hasGroupActions,
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

  // The widths the resize handles start from and announce
  const currentWidths: Record<string, number | undefined> = {
    ...measuredWidths,
    ...sizedWidths,
  };

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

  // The rows as they are when a save ends - the current object of its row
  const latestData = useRef(data);

  useEffect(() => {
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
    setFrozenRows({ ids: rows.map((row) => row.id), query });
  } else if (!editingCell && frozenRows) {
    setFrozenRows(null);
  }
  const frozenRowIds = frozenRows?.ids;

  const bodyRows = useMemo(() => {
    if (!frozenRowIds) return rows;

    const rowsById = new Map(data.map((row) => [row.id, row]));
    return frozenRowIds.flatMap((id) => {
      const row = rowsById.get(id);
      return row ? [row] : [];
    });
  }, [data, frozenRowIds, rows]);

  // The detail rows shown - of the rows the body shows
  const expandedRows = useMemo(
    () =>
      new Set(
        bodyRows
          .map((row) => row.id)
          .filter((id) => expandedByDefault !== toggledRows.has(id)),
      ),
    [bodyRows, expandedByDefault, toggledRows],
  );

  // A row gone from the data takes its editing along, and so do a hidden
  // column and another query - rows frozen for a field left open with an
  // invalid value would not follow the page, sorting or filters the header
  // and the pagination show
  if (
    editingCell &&
    (!bodyRows.some((row) => row.id === editingCell.rowId) ||
      !sortedVisibleColumns.some(
        (column) => column.key === editingCell.columnKey,
      ) ||
      (frozenRows && !isSameQuery(frozenRows.query, query)))
  ) {
    setEditingCell(null);
  }

  const isEditable = useCallback(
    (column: Column<T>, row: T) => !!onCellEdit && isEditableCell(column, row),
    [onCellEdit],
  );

  /** Whether a change of the cell is being saved. */
  const isCellPending = (row: T, column: Column<T>) =>
    cellStates.get(getCellKey(row.id, column.key))?.status === "pending";

  const handleStartEdit = (rowId: RowId, columnKey: string) =>
    setEditingCell({ columnKey, rowId });

  // The first value of a column among the rows - an empty cell is edited
  // in the field its column's values need
  const getColumnSample = (column: Column<T>) => {
    for (const row of data) {
      const value = getColumnValue(row, column);
      if (!isEmpty(value)) return value;
    }
    return undefined;
  };

  const saveCellEdit = (
    row: T,
    column: Column<T>,
    value: unknown,
    previous: unknown,
  ) => {
    if (!onCellEdit) return;

    const key = getCellKey(row.id, column.key);
    // Editing waits for a save of the cell to end - no other can overtake it
    const isThisSave = (state: CellEditState<T> | undefined) =>
      state?.status === "pending" && state.value === value;
    setCellStates((states) =>
      withCellState(states, key, { status: "pending", value }),
    );

    runCellEdit(onCellEdit, row, column.key, value).then(
      () => {
        // The row object of the moment - one the app has updated already
        // shows its own value from now on
        const current = latestData.current.find(
          (candidate) => candidate.id === row.id,
        );
        setCellStates((states) =>
          isThisSave(states.get(key))
            ? withCellState(states, key, {
                row: current,
                status: "saved",
                value,
              })
            : states,
        );
      },
      (error: unknown) => {
        logger.error(`Saving the cell "${column.key}" failed`, error);
        setCellStates((states) =>
          isThisSave(states.get(key))
            ? withCellState(states, key, {
                message: getEditErrorMessage(
                  error,
                  messages.dataTable.editFailed,
                ),
                previous,
                refused: value,
                status: "failed",
              })
            : states,
        );
      },
    );
  };

  // The next (or previous) editable cell in the order they are shown - Tab
  // in an edited cell
  const findEditableCell = (row: T, column: Column<T>, move: -1 | 1) => {
    const rowIndex = bodyRows.findIndex((candidate) => candidate.id === row.id);
    const columnIndex = sortedVisibleColumns.indexOf(column);
    const width = sortedVisibleColumns.length;

    for (
      let position = rowIndex * width + columnIndex + move;
      position >= 0 && position < bodyRows.length * width;
      position += move
    ) {
      const nextRow = bodyRows[Math.floor(position / width)];
      const nextColumn = sortedVisibleColumns[position % width];
      if (
        isEditable(nextColumn, nextRow) &&
        !isCellPending(nextRow, nextColumn)
      ) {
        return { columnKey: nextColumn.key, rowId: nextRow.id };
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
        cellStates.get(getCellKey(row.id, column.key)),
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
  const isExportRunning = useRef(false);

  const handleExport = async () => {
    if (isExportRunning.current) return;

    // What the user sees now - the columns may change while rows load
    const exportColumns = sortedVisibleColumns;
    let exportRows: T[] | null = matchingRows ?? rows;

    if (onExport) {
      isExportRunning.current = true;
      setIsExporting(true);
      exportRows = await loadExportRows(onExport, query);
      isExportRunning.current = false;
      setIsExporting(false);
    }

    if (exportRows) {
      downloadCsv(
        createCsv(exportRows, exportColumns, {
          locale,
          separator: csvSeparator,
        }),
        exportFilename,
      );
    }
  };

  const headerRowCount = hasFilterColumns ? 2 : 1;
  // Virtualized, most rows are not in the page - screen readers learn their
  // number (and place, `aria-rowindex`) from the attributes
  const rowCount = virtualized
    ? headerRowCount +
      bodyRows.length +
      (renderSubRow ? expandedRows.size : 0) +
      (hasSummaryRow ? 1 : 0)
    : undefined;

  return (
    <div
      aria-label={messages.dataTable.region}
      role="region"
      {...props}
      className={cn(
        isFullScreen
          ? "fixed inset-0 z-50 bg-surface dark:bg-surface-dark"
          : "relative",
        className,
      )}
      ref={rootRef}
    >
      {/* Popovers opened in the table count as part of it in full screen */}
      <OverlayContext value={childContext}>
        {hasGroupActions && (rowsTotal ?? rows.length) > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-3.5">
            <div className="flex flex-wrap gap-2">
              {groupActions.map((action, index) => (
                <Button
                  disabled={
                    selectedCount === 0 ||
                    (runningAction !== null && runningAction !== index)
                  }
                  // Labels need not be unique - the running action is
                  // tracked by the index too
                  key={index}
                  loading={runningAction === index}
                  onClick={() => runGroupAction(action, index)}
                  size="sm"
                  variant="outline"
                >
                  {action.label}
                </Button>
              ))}
            </div>
            {!selectionConfig && selectedRows.length > 0 && (
              <div
                aria-live="polite"
                className="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
              >
                {formatPlural(
                  locale.code,
                  messages.dataTable.selectedCount,
                  selectedRows.length,
                )}
              </div>
            )}
          </div>
        )}
        {selectionConfig && selectedCount > 0 && (
          <div
            aria-live="polite"
            className="mb-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-950 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-50"
          >
            {isAllFilteredSelected ? (
              <>
                {renderSelectionLabel(
                  selectionConfig.allSelectionLabel ??
                    messages.dataTable.selection.all,
                  selectionTotal,
                )}{" "}
                <button
                  className="font-semibold text-primary-700 underline hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                  onClick={resetAllSelection}
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
                  selectedRows.length,
                )}{" "}
                {isAllSelected && selectionTotal > rows.length && (
                  <button
                    className="font-semibold text-primary-700 underline hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                    onClick={() =>
                      setAllFilteredSelectionScope(selectionScopeKey)
                    }
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
        {onCellEdit && (
          <span hidden id={editHintId}>
            {messages.dataTable.editCell}
          </span>
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
            scrollPaddingLeft: layout.left,
            scrollPaddingRight: layout.right,
            scrollPaddingTop: headerHeight + stickyHeights.head,
          }}
        >
          <TableHeader
            columnOrder={columnOrder}
            columns={columns}
            columnVisibility={columnVisibility}
            defaultSearchOpen={defaultSearchOpen}
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
            aria-rowcount={rowCount}
            // Holds the loading overlay - it must not cover the toolbar and
            // the pagination
            className={cn(
              "relative bg-surface dark:bg-surface-dark",
              isEverySized ? "w-auto" : "w-full",
            )}
            ref={tableRef}
          >
            <TableHead
              actionColumnRef={actionColumnRef}
              actions={actions}
              canResize={canResize}
              cellLayouts={layout.layouts}
              columnRefs={columnRefs}
              columnWidths={currentWidths}
              expandColumnRef={expandColumnRef}
              filters={query.filters}
              groupActions={groupActions}
              handleDragOver={handleDragOver}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              hasActiveFilters={hasActiveFilters}
              isAllSelected={isAllFilteredSelected || isAllSelected}
              isSomeSelected={selectedRows.length > 0}
              onClearFilters={clearFilters}
              onColumnDrag={handleColumnDrag}
              onColumnResize={setColumnWidth}
              onColumnResizeReset={(key) => setColumnWidth(key, null)}
              onFilterChange={(key, value) =>
                updateQuery((current) => setFilter(current, key, value))
              }
              onSort={(key) =>
                updateQuery((current) => toggleSort(current, key))
              }
              order={query.order}
              ref={theadRef}
              renderSubRow={renderSubRow}
              selectionColumnRef={selectionColumnRef}
              sortBy={query.sortBy}
              sortedVisibleColumns={sortedVisibleColumns}
              stickyTop={headerHeight}
              toggleSelectAll={handleToggleSelectAll}
            />

            <TableBody
              actions={actions}
              cellLayouts={layout.layouts}
              cellStates={cellStates}
              data={bodyRows}
              density={density}
              editHintId={editHintId}
              editingCell={editingCell}
              emptyMessage={emptyMessage}
              expandedRows={expandedRows}
              filters={query.filters}
              getColumnSample={getColumnSample}
              getRowBackgroundColor={getRowBackgroundColor}
              getRowClassName={getRowClassName}
              groupActions={groupActions}
              headerRowCount={headerRowCount}
              isEditable={isEditable}
              loading={loading}
              onCancelEdit={() => setEditingCell(null)}
              onCommitEdit={handleCommitEdit}
              onStartEdit={handleStartEdit}
              renderSubRow={renderSubRow}
              scrollRef={scrollRef}
              search={searchTerm}
              selectedIds={displayedSelectedIds}
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
                hasSelection={hasGroupActions}
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
