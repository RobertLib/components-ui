import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Fragment,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cn from "../../utils/cn";
import EdgeShadow from "./edge-shadow";
import Spinner from "../spinner";
import useIsMobile from "../../hooks/use-is-mobile";
import useVirtualRows from "./use-virtual-rows";
import { formatMessage, formatPlural } from "../../i18n/format";
import { SummaryCells } from "./table-summary";
import {
  DEFAULT_CELL_LAYOUT,
  DENSITY_CLASSES,
  ESTIMATED_ROW_HEIGHTS,
  getCellStyle,
  isSticky,
  LEADING_KEYS,
  type CellLayout,
} from "./cell-layout";
import {
  findMoveTarget,
  type CellMove,
  type CellPosition,
} from "./cell-navigation";
import { getTabbableElements } from "../../utils/tabbable";
import { TableRow } from "./table-row";
import { useLocale } from "../../providers/ui-context";
import type { BodyRowGroup } from "./grouping";
import type { CellChange, CellEditState } from "./editing";
import type { DataTableFilterValue } from "./query";
import type {
  Column,
  DataTableDensity,
  DataTableSelectionMode,
  RowId,
} from "./types";

/** A body row to focus - a cell of it, or the row itself (`null`). */
interface FocusTarget {
  columnKey: string | null;
  rowId: RowId;
}

// Fixed so the placeholder rows do not change width on every render
const SKELETON_WIDTHS = [72, 45, 60, 38, 80, 52, 66, 30, 58, 47];

/**
 * The row of `body` an element is in - not a row of a table nested in the
 * detail of a row (master-detail), whose rows are numbered too.
 */
function findBodyRow(body: Element, element: Element) {
  let row = element.closest("tr[data-row-index]");
  while (row && row.parentElement !== body) {
    row = row.parentElement?.closest("tr[data-row-index]") ?? null;
  }
  return row;
}

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
  /** Content shown instead of the rows when there are none. */
  emptyMessage?: React.ReactNode;
  /** Ids of the rows whose `renderSubRow` detail is shown. */
  expandedRows: Set<RowId>;
  /** Column filters by column key - their terms are highlighted. */
  filters: Record<string, DataTableFilterValue>;
  /** Background of a row (any CSS color). */
  getRowBackgroundColor?: (row: T) => string | undefined;
  /** Extra classes of a row. */
  getRowClassName?: (row: T) => string | undefined;
  /** The page a row opens - its first cell links there. */
  getRowHref?: (row: T) => string | undefined;
  /** A value of a column from any row - it picks the field of an empty cell. */
  getColumnSample: (column: Column<T>) => unknown;
  /** Name of the column the rows are grouped by. */
  groupLabel?: string;
  /**
   * The groups of the rows (`groupBy`) in the order they are shown - each
   * takes the next `size` rows of `data`. Not virtualized.
   */
  groups?: BodyRowGroup[] | null;
  /** Rows of the table header - virtualized rows count from them. */
  headerRowCount: number;
  /** Whether a cell can be edited. */
  isEditable: (column: Column<T>, row: T) => boolean;
  /**
   * Changes when the rows may have other heights - another density, other
   * column widths; a virtualized table measures them again.
   */
  layoutKey: string;
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
  /** A click on a row, or Enter on it - see `DataTableProps.onRowClick`. */
  onRowClick?: (
    row: T,
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  /** Starts editing a cell. */
  onStartEdit: (rowId: RowId, columnKey: string) => void;
  /** Collapses or expands a group of rows. */
  onToggleGroup: (key: string) => void;
  /** Expandable detail of a row. */
  renderSubRow?: (row: T) => React.ReactNode;
  /** The element that scrolls the table - virtualization follows it. */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** Term of the global search - highlighted where no column filter is. */
  search: string;
  /** Ids of the rows whose checkbox is checked. */
  selectedIds: ReadonlySet<RowId>;
  /** The checkbox column - each row gets a checkbox unless `none`. */
  selectionMode: DataTableSelectionMode;
  /** The visible columns in the order they are shown. */
  sortedVisibleColumns: Column<T>[];
  /** Expands or collapses the detail of a row. */
  toggleRowExpansion: (rowId: RowId) => void;
  /** Selects or deselects a row - `extend` from the row toggled before. */
  toggleRowSelection: (row: T, extend: boolean) => void;
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
  getRowHref,
  groupLabel = "",
  groups,
  headerRowCount,
  isEditable,
  layoutKey,
  loading,
  onCancelEdit,
  onCommitEdit,
  onRowClick,
  onStartEdit,
  onToggleGroup,
  renderSubRow,
  scrollRef,
  search,
  selectedIds,
  selectionMode,
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

  const hasSelection = selectionMode !== "none";
  const columnCount =
    sortedVisibleColumns.length +
    (actions ? 1 : 0) +
    (hasSelection ? 1 : 0) +
    (renderSubRow ? 1 : 0);
  const densityClass = DENSITY_CLASSES[density];

  // The column filter wins over the global search - a text filter; lists
  // and ranges highlight nothing
  const highlightTerms = useMemo(
    () =>
      Object.fromEntries(
        sortedVisibleColumns.map((column) => {
          const filter = filters[column.key];
          return [column.key, (typeof filter === "string" && filter) || search];
        }),
      ),
    [filters, search, sortedVisibleColumns],
  );

  // Rows activated by a click and Enter, without links, are one tab stop -
  // the one focused last, or the first one rendered; the arrow keys move
  // between them
  const hasFocusableRows = !!onRowClick && !getRowHref;
  const [activeRowId, setActiveRowId] = useState<RowId | null>(null);

  // The row with the focus stays rendered while it is scrolled out of view,
  // so that the focus - a checkbox, a cell being edited - is not lost; so
  // does the row being edited, which Tab may take far from the view
  const [focusedRowId, setFocusedRowId] = useState<RowId | null>(null);
  const keptRowIds = virtualized ? [focusedRowId, editingCell?.rowId] : [];
  const keepIndexes = keptRowIds.flatMap((rowId) =>
    rowId === null || rowId === undefined
      ? []
      : [data.findIndex((row) => row.id === rowId)],
  );

  // Where the focus is in the rows. When its row goes away - it sorted
  // onto another page once its edit was saved, a refetch left it out - the
  // focus moves to the same place among the rows that are there, not to the
  // page.
  const focusRef = useRef<{
    /** The cell with the focus - `-1` for the row itself. */
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
    // The rows of this body - not those of a table nested in a detail
    const rows = body.querySelectorAll<HTMLElement>(
      ":scope > tr[data-row-index]",
    );
    const row =
      body.querySelector<HTMLElement>(
        `:scope > tr[data-row-index="${focus.rowIndex}"]`,
      ) ?? rows[rows.length - 1];
    if (focus.cellIndex === -1 && row?.hasAttribute("tabindex")) {
      row.focus();
      return;
    }
    const cell = row?.children[Math.max(0, focus.cellIndex)];
    // An editable cell takes the focus - also one that is not the tab stop
    const target =
      cell instanceof HTMLElement && cell.hasAttribute("tabindex")
        ? cell
        : getTabbableElements(cell ?? row)[0];
    target?.focus();
  });

  const { measureRef, segments, tableRowsBefore } = useVirtualRows({
    bodyRef,
    data,
    enabled: virtualized && !groups,
    estimatedHeight: ESTIMATED_ROW_HEIGHTS[density],
    expandedRows,
    hasSubRows: !!renderSubRow,
    keepIndexes,
    layoutKey,
    scrollRef,
  });

  // The editable cells are one tab stop (the grid pattern): the cell the
  // focus was in last, or - when that one is gone - the first editable cell
  // rendered. The arrow keys move the focus between them.
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const hasEditableColumns = sortedVisibleColumns.some(
    (column) => !!column.editable,
  );
  const renderedIndexes = segments.flatMap((segment) =>
    segment.type === "row" ? [segment.index] : [],
  );
  let tabStop: CellPosition | null = null;

  if (hasEditableColumns) {
    const activeIndex = activeCell
      ? data.findIndex((row) => row.id === activeCell.rowId)
      : -1;
    const activeColumn = sortedVisibleColumns.find(
      (column) => column.key === activeCell?.columnKey,
    );

    if (
      activeCell &&
      activeColumn &&
      renderedIndexes.includes(activeIndex) &&
      isEditable(activeColumn, data[activeIndex])
    ) {
      tabStop = activeCell;
    } else {
      for (const index of renderedIndexes) {
        const column = sortedVisibleColumns.find((candidate) =>
          isEditable(candidate, data[index]),
        );
        if (column) {
          tabStop = { columnKey: column.key, rowId: data[index].id };
          break;
        }
      }
    }
  }

  // The row that is the tab stop of the rows - of those rendered
  let rowTabStop: RowId | null = null;

  if (hasFocusableRows) {
    const activeIndex =
      activeRowId === null
        ? -1
        : data.findIndex((row) => row.id === activeRowId);
    rowTabStop = renderedIndexes.includes(activeIndex)
      ? activeRowId
      : renderedIndexes.length > 0
        ? data[renderedIndexes[0]].id
        : null;
  }

  // A cell or row the arrow keys moved to that is still to be rendered - a
  // row of a virtualized table far from the view
  const pendingFocusRef = useRef<FocusTarget | null>(null);

  /** The element of a body cell - or row - when it is rendered. */
  const findCellElement = ({ columnKey, rowId }: FocusTarget) => {
    const index = data.findIndex((row) => row.id === rowId);
    // A row of this body - not of a table nested in a detail
    const rowElement = bodyRef.current?.querySelector(
      `:scope > tr[data-row-index="${index}"]`,
    );
    if (columnKey === null) {
      return rowElement instanceof HTMLElement ? rowElement : undefined;
    }
    return Array.from(rowElement?.children ?? []).find(
      (cell): cell is HTMLElement =>
        cell instanceof HTMLElement && cell.dataset.columnKey === columnKey,
    );
  };

  /** Moves the focus to a cell or row - once it is rendered. */
  const focusTarget = (target: FocusTarget) => {
    const element = findCellElement(target);
    if (element) {
      element.focus();
    } else {
      // Kept rendered as the row with the focus, then focused
      pendingFocusRef.current = target;
      setFocusedRowId(target.rowId);
    }
  };

  // The arrow keys move between the rows, Home and End to the first and
  // last one
  const handleRowKeyDown = (
    row: T,
    event: React.KeyboardEvent<HTMLTableRowElement>,
  ) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    const index = data.indexOf(row);
    const targetIndex =
      event.key === "ArrowDown"
        ? index + 1
        : event.key === "ArrowUp"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? data.length - 1
              : null;
    if (targetIndex === null) return;

    event.preventDefault();
    const target = data[targetIndex];
    if (!target || target === row) return;

    setActiveRowId(target.id);
    focusTarget({ columnKey: null, rowId: target.id });
  };

  useLayoutEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;

    // Given up once the focus has left the table or the row is gone - the
    // cell must not take the focus from wherever the user is now
    const body = bodyRef.current;
    if (
      !body?.contains(body.ownerDocument.activeElement) ||
      !data.some((row) => row.id === pending.rowId)
    ) {
      pendingFocusRef.current = null;
      return;
    }

    const cell = findCellElement(pending);
    if (cell) {
      pendingFocusRef.current = null;
      cell.focus();
    }
  });

  const moveCellFocus = (row: T, column: Column<T>, move: CellMove) => {
    const target = findMoveTarget(
      data,
      sortedVisibleColumns,
      isEditable,
      data.indexOf(row),
      sortedVisibleColumns.indexOf(column),
      move,
    );
    if (!target) return;

    setActiveCell(target);
    focusTarget(target);
  };

  const handleCellFocus = (rowId: RowId, columnKey: string) => {
    if (activeCell?.rowId !== rowId || activeCell.columnKey !== columnKey) {
      setActiveCell({ columnKey, rowId });
    }
  };

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
              style={getCellStyle(
                null,
                leadingLayout(LEADING_KEYS.expand),
                false,
              )}
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
              style={getCellStyle(
                null,
                leadingLayout(LEADING_KEYS.selection),
                false,
              )}
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
              style={getCellStyle(
                null,
                leadingLayout(LEADING_KEYS.actions),
                false,
              )}
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

  const renderRow = (index: number) => {
    const row = data[index];
    const rowsBefore = tableRowsBefore(index);

    return (
      <TableRow
        actions={actions}
        ariaRowIndex={
          rowsBefore === undefined ? undefined : headerRowCount + rowsBefore + 1
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
        href={getRowHref?.(row)}
        idPrefix={idPrefix}
        isEditable={isEditable}
        isExpanded={expandedRows.has(row.id)}
        isMobile={isMobile}
        isSelected={selectedIds.has(row.id)}
        key={row.id}
        locale={locale}
        measureRef={measureRef}
        onCancelEdit={onCancelEdit}
        onCellFocus={handleCellFocus}
        onCellMove={moveCellFocus}
        onCommitEdit={onCommitEdit}
        onRowClick={onRowClick}
        onRowFocus={setActiveRowId}
        onRowKeyDown={(event) => handleRowKeyDown(row, event)}
        onStartEdit={onStartEdit}
        renderSubRow={renderSubRow}
        row={row}
        rowIndex={index}
        rowTabIndex={
          hasFocusableRows ? (rowTabStop === row.id ? 0 : -1) : undefined
        }
        tabStopColumnKey={tabStop?.rowId === row.id ? tabStop.columnKey : null}
        toggleRowExpansion={toggleRowExpansion}
        toggleRowSelection={toggleRowSelection}
      />
    );
  };

  // Each group: its header, which collapses and expands it, its rows and
  // the summary of all its rows
  const renderGroups = (bodyGroups: BodyRowGroup[]) => {
    const rendered: React.ReactNode[] = [];
    let start = 0;

    for (const group of bodyGroups) {
      const indexes: number[] = [];
      for (let offset = 0; offset < group.size; offset++) {
        indexes.push(start + offset);
      }
      start += group.size;
      const Chevron = group.collapsed ? ChevronRight : ChevronDown;

      rendered.push(
        <Fragment key={group.key}>
          <tr
            className="bg-neutral-50 dark:bg-neutral-900"
            data-group-key={group.key}
            data-state={group.collapsed ? "closed" : "open"}
          >
            <td className="px-2 py-1" colSpan={columnCount}>
              {/* Stays in view while the table scrolls sideways */}
              <button
                aria-expanded={!group.collapsed}
                className="sticky start-2 inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                data-state={group.collapsed ? "closed" : "open"}
                onClick={() => onToggleGroup(group.key)}
                type="button"
              >
                <Chevron
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-neutral-500 dark:text-neutral-400",
                    group.collapsed && "rtl:rotate-180",
                  )}
                  size={16}
                />
                {formatMessage(messages.dataTable.groupLabel, {
                  label: groupLabel,
                  value: group.label || messages.dataTable.noValue,
                })}{" "}
                <span className="font-normal text-neutral-600 dark:text-neutral-400">
                  (
                  {formatPlural(
                    locale.code,
                    messages.dataTable.groupRowCount,
                    group.count,
                  )}
                  )
                </span>
              </button>
            </td>
          </tr>
          {indexes.map((index) => renderRow(index))}
          {group.summary && (
            <tr className="bg-neutral-50/60 font-medium dark:bg-neutral-900/60">
              <SummaryCells
                cellLayouts={cellLayouts}
                density={density}
                hasActions={!!actions}
                hasSelection={hasSelection}
                hasSubRows={!!renderSubRow}
                sortedVisibleColumns={sortedVisibleColumns}
                values={group.summary}
              />
            </tr>
          )}
        </Fragment>,
      );
    }

    return rendered;
  };

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
        const rowElement = findBodyRow(event.currentTarget, target);
        const index = rowElement?.getAttribute("data-row-index");
        const row = index ? data[Number(index)] : undefined;
        if (!row || !rowElement) return;

        const cellIndex =
          target === rowElement
            ? -1
            : Math.max(
                0,
                Array.from(rowElement.children).findIndex((cell) =>
                  cell.contains(target),
                ),
              );
        focusRef.current = {
          cellIndex,
          element: target,
          rowIndex: Number(index),
        };
        if (row.id !== focusedRowId) setFocusedRowId(row.id);
      }}
      ref={bodyRef}
    >
      {data.length === 0 && !groups?.length ? (
        loading ? (
          renderSkeletonRows()
        ) : (
          <tr>
            <td className="px-2 py-1 text-sm" colSpan={columnCount}>
              {/* Any content - a block too */}
              <div className="flex min-h-25 items-center justify-center p-1 font-medium text-neutral-500 dark:text-neutral-400">
                {emptyMessage ?? messages.dataTable.noData}
              </div>
            </td>
          </tr>
        )
      ) : groups ? (
        renderGroups(groups)
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

          return renderRow(segment.index);
        })
      )}
    </tbody>
  );
}
