import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import cn from "../../utils/cn";
import EdgeShadow from "./edge-shadow";
import Spinner from "../spinner";
import useIsMobile from "../../hooks/use-is-mobile";
import useVirtualRows from "./use-virtual-rows";
import {
  DEFAULT_CELL_LAYOUT,
  DENSITY_CLASSES,
  ESTIMATED_ROW_HEIGHTS,
  getCellStyle,
  isSticky,
  type CellLayout,
} from "./cell-layout";
import { getTabbableElements } from "../../utils/tabbable";
import { TableRow } from "./table-row";
import { useLocale } from "../../providers/ui-context";
import type { CellChange, CellEditState } from "./editing";
import type { Column, DataTableDensity, GroupAction, RowId } from "./types";

// Fixed so the placeholder rows do not change width on every render
const SKELETON_WIDTHS = [72, 45, 60, 38, 80, 52, 66, 30, 58, 47];

interface TableBodyProps<T extends { id: RowId }> {
  /** Content of the sticky actions cell of a row. */
  actions?: (row: T) => React.ReactNode;
  /** Layouts by column key - also of `expand`, `selection` and `actions`. */
  cellLayouts: Record<string, CellLayout>;
  /** The changes of cells - being saved, saved or refused. */
  cellStates: ReadonlyMap<string, CellEditState<T>>;
  /** The rows to show. */
  data: T[];
  /** Height of the rows. */
  density: DataTableDensity;
  /** Id of the text describing editable cells to screen readers. */
  editHintId: string;
  /** The cell being edited. */
  editingCell: { columnKey: string; rowId: RowId } | null;
  /** Text shown instead of the rows when there are none. */
  emptyMessage?: string;
  /** Ids of the rows whose `renderSubRow` detail is shown. */
  expandedRows: Set<RowId>;
  /** Column filters by column key - their terms are highlighted. */
  filters: Record<string, string>;
  /** Background of a row (any CSS color). */
  getRowBackgroundColor?: (row: T) => string | undefined;
  /** Extra classes of a row. */
  getRowClassName?: (row: T) => string | undefined;
  /** A value of a column from any row - it picks the field of an empty cell. */
  getColumnSample: (column: Column<T>) => unknown;
  /** Group actions - each row gets a checkbox when there are some. */
  groupActions?: GroupAction<T>[];
  /** Rows of the table header - virtualized rows count from them. */
  headerRowCount: number;
  /** Whether a cell can be edited. */
  isEditable: (column: Column<T>, row: T) => boolean;
  /** The rows are loading - placeholder rows without data, dimmed rows otherwise. */
  loading?: boolean;
  /** Ends the editing without a change. */
  onCancelEdit: () => void;
  /** Ends the editing - saves a changed value. */
  onCommitEdit: (
    row: T,
    column: Column<T>,
    change: CellChange,
    move: -1 | 0 | 1,
  ) => boolean;
  /** Starts editing a cell. */
  onStartEdit: (rowId: RowId, columnKey: string) => void;
  /** Expandable detail of a row. */
  renderSubRow?: (row: T) => React.ReactNode;
  /** The element that scrolls the table - virtualization follows it. */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** Term of the global search - highlighted where no column filter is. */
  search: string;
  /** Ids of the rows whose checkbox is checked. */
  selectedIds: ReadonlySet<RowId>;
  /** The visible columns in the order they are shown. */
  sortedVisibleColumns: Column<T>[];
  /** Expands or collapses the detail of a row. */
  toggleRowExpansion: (rowId: RowId) => void;
  /** Selects or deselects a row. */
  toggleRowSelection: (row: T) => void;
  /** Renders only the rows in view of `scrollRef`. */
  virtualized: boolean;
}

export function TableBody<T extends { id: RowId }>({
  actions,
  cellLayouts,
  cellStates,
  data,
  density,
  editHintId,
  editingCell,
  emptyMessage,
  expandedRows,
  filters,
  getColumnSample,
  getRowBackgroundColor,
  getRowClassName,
  groupActions,
  headerRowCount,
  isEditable,
  loading,
  onCancelEdit,
  onCommitEdit,
  onStartEdit,
  renderSubRow,
  scrollRef,
  search,
  selectedIds,
  sortedVisibleColumns,
  toggleRowExpansion,
  toggleRowSelection,
  virtualized,
}: TableBodyProps<T>) {
  const locale = useLocale();
  const { messages } = locale;
  const idPrefix = useId();
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  // Touch devices have no hover - long texts open on tap there
  const isMobile = useIsMobile();

  const hasSelection = !!groupActions && groupActions.length > 0;
  const columnCount =
    sortedVisibleColumns.length +
    (actions ? 1 : 0) +
    (hasSelection ? 1 : 0) +
    (renderSubRow ? 1 : 0);
  const densityClass = DENSITY_CLASSES[density];

  // The column filter wins over the global search
  const highlightTerms = useMemo(
    () =>
      Object.fromEntries(
        sortedVisibleColumns.map((column) => [
          column.key,
          filters[column.key] || search,
        ]),
      ),
    [filters, search, sortedVisibleColumns],
  );

  // The row with the focus stays rendered while it is scrolled out of view,
  // so that the focus - a checkbox, a cell being edited - is not lost
  const [focusedRowId, setFocusedRowId] = useState<RowId | null>(null);
  const keepIndex =
    virtualized && focusedRowId !== null
      ? data.findIndex((row) => row.id === focusedRowId)
      : -1;

  // Where the focus is in the rows. When its row goes away - it sorted
  // onto another page once its edit was saved, a refetch left it out - the
  // focus moves to the same place among the rows that are there, not to the
  // page.
  const focusRef = useRef<{
    cellIndex: number;
    element: Element;
    rowIndex: number;
  } | null>(null);

  useLayoutEffect(() => {
    const focus = focusRef.current;
    const body = bodyRef.current;
    const active = document.activeElement;
    if (
      !focus ||
      !body ||
      focus.element.isConnected ||
      (active && active !== document.body)
    ) {
      return;
    }

    focusRef.current = null;
    const rows = body.querySelectorAll<HTMLElement>("tr[data-row-index]");
    const row =
      body.querySelector<HTMLElement>(
        `tr[data-row-index="${focus.rowIndex}"]`,
      ) ?? rows[rows.length - 1];
    const cell = row?.children[focus.cellIndex];
    const target =
      cell instanceof HTMLElement && cell.tabIndex >= 0
        ? cell
        : getTabbableElements(cell ?? row)[0];
    target?.focus();
  });

  const { measureRef, segments, tableRowsBefore } = useVirtualRows({
    bodyRef,
    data,
    enabled: virtualized,
    estimatedHeight: ESTIMATED_ROW_HEIGHTS[density],
    expandedRows,
    hasSubRows: !!renderSubRow,
    keepIndex,
    scrollRef,
  });

  const leadingLayout = (key: string) =>
    cellLayouts[key] ?? DEFAULT_CELL_LAYOUT;

  const renderSkeletonRows = () => (
    <>
      <tr>
        {/* Over the placeholder rows, positioned in the table - the toolbar
            and the pagination stay usable, and the sticky header row paints
            above it */}
        <td
          className="absolute inset-0 z-1 animate-fade-in"
          colSpan={columnCount}
        >
          <div className="flex h-full w-full items-center justify-center bg-surface/30 dark:bg-surface-dark/30">
            <Spinner className="mx-auto" />
          </div>
        </td>
      </tr>
      {Array.from({ length: 10 }).map((_, index) => (
        <tr className="animate-fade-in" key={`skeleton-${index}`}>
          {renderSubRow && (
            <td
              className="sticky w-10 bg-surface text-center dark:bg-surface-dark"
              style={getCellStyle(null, leadingLayout("expand"), false)}
            >
              <div className="mx-auto h-5 w-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </td>
          )}
          {hasSelection && (
            <td
              className={cn(
                "sticky bg-surface px-2 dark:bg-surface-dark",
                densityClass,
              )}
              style={getCellStyle(null, leadingLayout("selection"), false)}
            >
              <div className="h-4 w-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </td>
          )}
          {actions && (
            <td
              className={cn(
                "sticky z-1 bg-surface px-2 dark:bg-surface-dark",
                densityClass,
              )}
              style={getCellStyle(null, leadingLayout("actions"), false)}
            >
              <div className="h-6 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </td>
          )}
          {sortedVisibleColumns.map((column, colIndex) => {
            const layout = cellLayouts[column.key] ?? DEFAULT_CELL_LAYOUT;

            return (
              <td
                className={cn(
                  "px-2",
                  densityClass,
                  isSticky(layout) && "sticky bg-surface dark:bg-surface-dark",
                )}
                key={`skeleton-${index}-${colIndex}`}
                style={getCellStyle(column, layout, false)}
              >
                <EdgeShadow side={layout.shadow} />
                <div
                  className="h-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
                  style={{
                    width: `${SKELETON_WIDTHS[(index + colIndex * 3) % SKELETON_WIDTHS.length]}%`,
                  }}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );

  return (
    <tbody
      className={cn(
        "divide-y divide-neutral-100 transition-opacity dark:divide-neutral-900",
        // New rows are on their way - dim the old ones meanwhile
        loading && data.length > 0 && "opacity-60",
      )}
      onBlur={(event) => {
        // Gone to another element - a row taking the focus away with it
        // leaves a disconnected target, whose place is kept
        if (event.target.isConnected) focusRef.current = null;
      }}
      onFocus={(event) => {
        // Focus in a popup of a row (a portal) keeps the row it came from
        const target = event.target as Element;
        const rowElement = target.closest("[data-row-index]");
        const index = rowElement?.getAttribute("data-row-index");
        const row = index === undefined ? undefined : data[Number(index)];
        if (!row || !rowElement) return;

        const cell = target.closest("td");
        focusRef.current = {
          cellIndex: cell ? Array.from(rowElement.children).indexOf(cell) : 0,
          element: target,
          rowIndex: Number(index),
        };
        if (row.id !== focusedRowId) setFocusedRowId(row.id);
      }}
      ref={bodyRef}
    >
      {data.length === 0 ? (
        loading ? (
          renderSkeletonRows()
        ) : (
          <tr>
            <td className="px-2 py-1 text-sm" colSpan={columnCount}>
              <p className="flex min-h-25 items-center justify-center p-1 font-medium text-neutral-500 dark:text-neutral-400">
                {emptyMessage ?? messages.dataTable.noData}
              </p>
            </td>
          </tr>
        )
      ) : (
        segments.map((segment) => {
          if (segment.type === "spacer") {
            // The room of the rows left out - nothing for screen readers,
            // which count the rows by `aria-rowindex`
            return (
              <tr aria-hidden="true" className="border-0" key={segment.key}>
                <td
                  className="p-0"
                  colSpan={columnCount}
                  style={{ height: segment.height }}
                />
              </tr>
            );
          }

          const { index } = segment;
          const row = data[index];
          const rowsBefore = tableRowsBefore(index);

          return (
            <TableRow
              actions={actions}
              ariaRowIndex={
                rowsBefore === undefined
                  ? undefined
                  : headerRowCount + rowsBefore + 1
              }
              cellLayouts={cellLayouts}
              cellStates={cellStates}
              columnCount={columnCount}
              columns={sortedVisibleColumns}
              density={density}
              editHintId={editHintId}
              editingColumnKey={
                editingCell?.rowId === row.id ? editingCell.columnKey : null
              }
              getColumnSample={getColumnSample}
              getRowBackgroundColor={getRowBackgroundColor}
              getRowClassName={getRowClassName}
              hasSelection={hasSelection}
              highlightTerms={highlightTerms}
              idPrefix={idPrefix}
              isEditable={isEditable}
              isExpanded={expandedRows.has(row.id)}
              isMobile={isMobile}
              isSelected={selectedIds.has(row.id)}
              key={row.id}
              locale={locale}
              measureRef={measureRef}
              onCancelEdit={onCancelEdit}
              onCommitEdit={onCommitEdit}
              onStartEdit={onStartEdit}
              renderSubRow={renderSubRow}
              row={row}
              rowIndex={index}
              toggleRowExpansion={toggleRowExpansion}
              toggleRowSelection={toggleRowSelection}
            />
          );
        })
      )}
    </tbody>
  );
}
