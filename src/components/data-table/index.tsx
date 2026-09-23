import { TableBody } from "./table-body";
import { TableFooter } from "./table-footer";
import { TableHead } from "./table-head";
import { TableHeader } from "./table-header";
import { type PageInfo } from "../pagination";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "../button";
import cn from "../../utils/cn";
import logger from "../../utils/logger";
import useColumnManagement from "./use-column-management";
import usePendingValue from "./use-pending-value";
import useRowSelection from "./use-row-selection";
import {
  applyDataTableQuery,
  createDataTableQuery,
  DEFAULT_PAGE_SIZE_OPTIONS,
  isSameQuery,
  resetPagination,
  setFilter,
  toggleSort,
  type DataTableQuery,
} from "./query";
import { formatMessage, formatPlural, pluralForm } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";
import type { PluralMessage } from "../../i18n/types";
import type {
  Column,
  FilteredSelectionConfig,
  GroupAction,
  RowId,
} from "./types";

export type {
  Column,
  ColumnFilter,
  FilteredSelectionConfig,
  GroupAction,
  GroupActionSelection,
  RowId,
} from "./types";

const MAX_TOGGLED_ROWS = 1000;

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
  /** Rows to show - the current page, or all rows with `clientSide`. */
  data: T[];
  /** Initial query of an uncontrolled table. */
  defaultQuery?: Partial<DataTableQuery>;
  /** Opens the global search field right away. */
  defaultSearchOpen?: boolean;
  /** Replaces the generic "no data" text shown when the table has no rows. */
  emptyMessage?: string;
  /** Shows a search field searching all columns (`query.search`). */
  enableGlobalSearch?: boolean;
  /** Rows with a `renderSubRow` start expanded - also rows loaded later. */
  expandedByDefault?: boolean;
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
  /** Shows placeholder rows while there is no data, a spinner otherwise. */
  loading?: boolean;
  /**
   * Maximum height of the scrollable table (any CSS length) - the header row
   * sticks to its top. Default `calc(100vh - 212px)`.
   */
  maxHeight?: string;
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
   * Remembers the column order, visibility and pinning in `localStorage`
   * under this id. Include the user id when several people share a browser.
   */
  tableId?: string;
  /** Content left of the table controls, e.g. filters or a "New" button. */
  toolbar?: React.ReactNode;
  /** Number of rows matching the query (offset pagination). */
  total?: number;
}

/**
 * A data grid with sorting, column filters, global search, pagination, row
 * selection with group actions, expandable rows, and column reordering,
 * hiding and pinning. Works with any data source: the table reports a
 * `DataTableQuery` and shows the rows it is given.
 */
export default function DataTable<T extends { id: RowId }>({
  actions,
  autoResetSelectedRows = false,
  className,
  clientSide = false,
  columns,
  data,
  defaultQuery,
  defaultSearchOpen = false,
  emptyMessage,
  enableGlobalSearch = false,
  expandedByDefault = false,
  filteredSelection,
  getRowBackgroundColor,
  getRowClassName,
  groupActions,
  loading,
  maxHeight = "calc(100vh - 212px)",
  onQueryChange,
  pageInfo,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  pagination = true,
  query: controlledQuery,
  renderSubRow,
  tableId,
  toolbar,
  total,
  ...props
}: DataTableProps<T>) {
  const locale = useLocale();
  const { messages } = locale;

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
    handleDragOver,
    handleDragStart,
    handleDrop,
    handlePinColumn,
    moveColumn,
    pinnedColumns,
    setColumnOrder,
    setColumnVisibility,
    setPinnedColumns,
    sortedVisibleColumns,
  } = useColumnManagement(columns, tableId);

  // Client-side the search covers what the user sees - the visible columns,
  // with dates and booleans as the table shows them
  const clientResult = clientSide
    ? applyDataTableQuery(data, query, columns, {
        locale,
        paginate: pagination,
        searchColumns: columns.filter((column) => columnVisibility[column.key]),
      })
    : null;
  const rows = clientResult?.rows ?? data;
  const rowsTotal = clientResult?.total ?? total;
  const page = clientResult?.page ?? query.page;

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [allFilteredSelectionScope, setAllFilteredSelectionScope] = useState<
    string | null
  >(null);

  // Rows the user expanded or collapsed against `expandedByDefault`, so rows
  // loaded later follow the default
  const [toggledRows, setToggledRows] = useState<Set<RowId>>(() => new Set());

  const expandedRows = useMemo(
    () =>
      new Set(
        rows
          .map((row) => row.id)
          .filter((id) => expandedByDefault !== toggledRows.has(id)),
      ),
    [expandedByDefault, rows, toggledRows],
  );

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
  const selectionColumnRef = useRef<HTMLTableCellElement>(null);
  const columnRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // The header row sticks under the toolbar, which grows when its content
  // wraps onto more lines
  const [headerHeight, setHeaderHeight] = useState(40);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const observer = new ResizeObserver(() =>
      setHeaderHeight(header.offsetHeight),
    );
    observer.observe(header);
    return () => observer.disconnect();
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

  const pageIds = rows.map((row) => row.id).join(",");
  const selectionResetKey = `${selectionScopeKey}:${pageIds}`;

  const {
    isAllSelected,
    resetSelection,
    selectedRows,
    setSelectedRows,
    toggleRowSelection,
    toggleSelectAll,
  } = useRowSelection(rows, selectionResetKey);

  const isAllFilteredSelected =
    !!selectionConfig && allFilteredSelectionScope === selectionScopeKey;
  const selectedCount = isAllFilteredSelected
    ? selectionTotal
    : selectedRows.length;
  const displayedSelectedRows = isAllFilteredSelected ? rows : selectedRows;

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

    const actionRows = isAllFilteredSelected ? rows : selectedRows;
    const actionScope = isAllFilteredSelected ? selectionScopeKey : null;

    try {
      const shouldReset = await action.onClick(actionRows, {
        allFiltered: isAllFilteredSelected,
        count: selectedCount,
        rows: actionRows,
      });
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
    } catch (error) {
      // The selection stays, so the action can be retried
      logger.error(`The group action "${action.label}" failed`, error);
    } finally {
      isActionRunning.current = false;
      setRunningAction(null);
    }
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
        <strong>{count}</strong>
        {afterCount}
      </>
    );
  };

  // The sticky offsets need the widths of the columns in front
  const visibleColumnKeys = sortedVisibleColumns
    .map((column) => column.key)
    .join(",");

  useEffect(() => {
    if (!rows.length) return;

    const observer = new ResizeObserver((entries) => {
      const newWidths: Record<string, number> = {};

      entries.forEach((entry) => {
        const columnKey = entry.target.getAttribute("data-column-key");

        if (columnKey) {
          newWidths[columnKey] = entry.target.getBoundingClientRect().width;
        }
      });

      if (Object.keys(newWidths).length > 0) {
        setColumnWidths((prev) => ({
          ...prev,
          ...newWidths,
        }));
      }
    });

    if (actions && actionColumnRef.current) {
      observer.observe(actionColumnRef.current);
    }

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
  }, [actions, groupActions?.length, rows.length, visibleColumnKeys]);

  const handleResetSettings = useCallback(() => {
    setColumnOrder(columns.map((column) => column.key));
    setColumnVisibility(
      Object.fromEntries(
        columns.map((column) => [column.key, column.visible ?? true]),
      ),
    );
    setPinnedColumns({
      left: [],
      right: [],
    });
  }, [columns, setColumnOrder, setColumnVisibility, setPinnedColumns]);

  const hasGroupActions = !!groupActions && groupActions.length > 0;
  const hasFilterColumns = sortedVisibleColumns.some((column) => column.filter);
  const hasActiveFilters = Object.keys(query.filters).length > 0;

  const clearFilters = () =>
    updateQuery((current) => resetPagination(current, { filters: {} }));

  // Sticky offsets in the order the columns are shown: the selection column
  // and the actions stick first, then the pinned columns
  const stickyOffsets = useMemo(() => {
    const selectionWidth = hasGroupActions
      ? (columnWidths["selection"] ?? 30)
      : 0;
    const left: Record<string, number> = { actions: selectionWidth };
    const right: Record<string, number> = {};

    let offset =
      selectionWidth + (actions ? (columnWidths["actions"] ?? 0) : 0);
    for (const column of sortedVisibleColumns) {
      if (!pinnedColumns.left.includes(column.key)) continue;
      left[column.key] = offset;
      offset += columnWidths[column.key] ?? 0;
    }

    offset = 0;
    for (const column of [...sortedVisibleColumns].reverse()) {
      if (!pinnedColumns.right.includes(column.key)) continue;
      right[column.key] = offset;
      offset += columnWidths[column.key] ?? 0;
    }

    return { left, right };
  }, [
    actions,
    columnWidths,
    hasGroupActions,
    pinnedColumns.left,
    pinnedColumns.right,
    sortedVisibleColumns,
  ]);

  const calculatePosition = useCallback(
    (columnKey: string, position: "left" | "right") => {
      const offset = stickyOffsets[position][columnKey];
      return offset === undefined ? "auto" : `${offset}px`;
    },
    [stickyOffsets],
  );

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
    >
      {hasGroupActions && (rowsTotal ?? rows.length) > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-3.5">
          <div className="flex flex-wrap gap-2">
            {groupActions.map((action, index) => (
              <Button
                disabled={
                  selectedCount === 0 ||
                  (runningAction !== null && runningAction !== index)
                }
                key={action.label}
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
                        count: selectionTotal,
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
      <div
        className="overflow-x-auto rounded-t-lg border border-neutral-100 bg-surface shadow-lg dark:border-neutral-900 dark:bg-surface-dark"
        style={{ maxHeight: isFullScreen ? "calc(100vh - 50px)" : maxHeight }}
      >
        <TableHeader
          columnOrder={columnOrder}
          columns={columns}
          columnVisibility={columnVisibility}
          defaultSearchOpen={defaultSearchOpen}
          enableGlobalSearch={enableGlobalSearch}
          handleDragOver={handleDragOver}
          handleDragStart={handleDragStart}
          handleDrop={handleDrop}
          handlePinColumn={handlePinColumn}
          hasActiveFilters={hasActiveFilters}
          isFullScreen={isFullScreen}
          onClearFilters={clearFilters}
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
          search={query.search}
          setColumnVisibility={setColumnVisibility}
          setIsFullScreen={setIsFullScreen}
          // The header of the actions column has the button otherwise
          showClearFilters={hasFilterColumns && !actions}
          toolbar={toolbar}
        />

        <table
          aria-busy={loading || undefined}
          className="w-full bg-surface dark:bg-surface-dark"
          ref={tableRef}
        >
          <TableHead
            actionColumnRef={actionColumnRef}
            actions={actions}
            calculatePosition={calculatePosition}
            columnRefs={columnRefs}
            filters={query.filters}
            groupActions={groupActions}
            handleDragOver={handleDragOver}
            handleDragStart={handleDragStart}
            handleDrop={handleDrop}
            isAllSelected={isAllFilteredSelected || isAllSelected}
            isSomeSelected={selectedRows.length > 0}
            onClearFilters={clearFilters}
            onFilterChange={(key, value) =>
              updateQuery((current) => setFilter(current, key, value))
            }
            onSort={(key) => updateQuery((current) => toggleSort(current, key))}
            order={query.order}
            pinnedColumns={pinnedColumns}
            renderSubRow={renderSubRow}
            selectionColumnRef={selectionColumnRef}
            sortBy={query.sortBy}
            sortedVisibleColumns={sortedVisibleColumns}
            stickyTop={headerHeight}
            toggleSelectAll={handleToggleSelectAll}
          />

          <TableBody
            actions={actions}
            calculatePosition={calculatePosition}
            data={rows}
            emptyMessage={emptyMessage}
            expandedRows={expandedRows}
            filters={query.filters}
            getRowBackgroundColor={getRowBackgroundColor}
            getRowClassName={getRowClassName}
            groupActions={groupActions}
            loading={loading}
            pinnedColumns={pinnedColumns}
            renderSubRow={renderSubRow}
            search={query.search}
            selectedRows={displayedSelectedRows}
            sortedVisibleColumns={sortedVisibleColumns}
            toggleRowExpansion={toggleRowExpansion}
            toggleRowSelection={handleToggleRowSelection}
          />
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
    </div>
  );
}
