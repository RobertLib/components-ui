import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cn from "../../../utils/cn";
import ContextMenu from "../context-menu";
import EdgeShadow from "./edge-shadow";
import { findBodyRow } from "./body-row";
import Spinner from "../spinner";
import useIsMobile from "../../../hooks/use-is-mobile";
import useVirtualRows, { getMeasureKey } from "./use-virtual-rows";
import { formatMessage, formatPlural } from "../../../i18n/ui/format";
import { SummaryCells } from "./table-summary";
import {
  DEFAULT_CELL_LAYOUT,
  DENSITY_CLASSES,
  ESTIMATED_ROW_HEIGHTS,
  getCellStyle,
  hiddenBelowClassName,
  isSticky,
  LEADING_KEYS,
  type CellLayout,
} from "./cell-layout";
import {
  findMoveTarget,
  type CellMove,
  type CellPosition,
} from "./cell-navigation";
import { getTabbableElements } from "../../../utils/tabbable";
import { isTypingTarget } from "../../../hooks/use-hotkeys";
import { getRowKey } from "./row-key";
import { TableRow } from "./table-row";
import { useLocale } from "../../../providers/ui-context";
import type { BodyRowGroup } from "./grouping";
import type { CellChange, CellEditState } from "./editing";
import type { TreeRowState } from "./use-data-table-tree";
import type { DataTableFilterValue } from "./query";
import type { DropdownEntry } from "../menu/types";
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

type BodyItem =
  | { id: string; type: "row"; index: number }
  | { id: string; type: "group" | "summary"; group: BodyRowGroup };
const bodyItemId = (item: BodyItem) => item.id;
const NO_ENTRIES: DropdownEntry[] = [];
const virtualRowId = (id: RowId) => `row:${getRowKey(id)}`;

/** Tree data of the body (`getSubRows` / `loadSubRows`). */
export interface TableTree {
  /** The column whose cells hold the toggles and the indentation. */
  columnKey: string | null;
  /** Loads the sub rows of a row again after a failure. */
  onRetry: (rowId: RowId) => void;
  /** Expands or collapses the sub rows of a row. */
  onToggle: (rowId: RowId) => void;
  /** Where each row shown is in the tree, by `getRowKey` of its id. */
  rows: ReadonlyMap<string, TreeRowState>;
}

interface TableBodyProps<T> {
  /** Content of the sticky actions cell of a row. */
  actions?: (row: T) => React.ReactNode;
  /** Layouts by column key - also of `expand`, `selection` and `actions`. */
  cellLayouts: Record<string, CellLayout>;
  /** The changes of cells - being saved, saved or refused. */
  cellStates: ReadonlyMap<string, CellEditState<T>>;
  /** The rows to show. */
  data: T[];
  getRowId: (row: T) => RowId;
  isRowSelectable?: (row: T) => boolean;
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
  /** Entries of the context menu of a row - see `DataTableProps`. */
  getRowContextMenu?: (row: T) => DropdownEntry[] | null | undefined;
  /** A value of a column from any row - it picks the field of an empty cell. */
  getColumnSample: (column: Column<T>) => unknown;
  /**
   * The groups of the rows (`groupBy`) in the order they are shown - each
   * leaves take the next `size` rows of `data`.
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
  /** Ids of the rows whose checkbox is mixed - some of their branch selected. */
  partlySelectedIds?: ReadonlySet<RowId>;
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
  /**
   * Tree data: the rows of `data` are a tree, depth first - `null` for
   * rows of one level.
   */
  tree?: TableTree | null;
  /** Renders only the rows in view of `scrollRef`. */
  virtualized: boolean;
}

export function TableBody<T>({
  actions,
  cellLayouts,
  cellStates,
  data,
  getRowId,
  isRowSelectable,
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
  getRowContextMenu,
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
  partlySelectedIds,
  renderSubRow,
  scrollRef,
  search,
  selectedIds,
  selectionMode,
  sortedVisibleColumns,
  toggleRowExpansion,
  toggleRowSelection,
  tree,
  virtualized,
}: TableBodyProps<T>) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const idPrefix = useId();
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  // Touch devices have no hover - long texts open on tap there
  const isMobile = useIsMobile();

  const bodyItems = useMemo(() => {
    const items: BodyItem[] = [];
    const cursor = { index: 0 };
    const appendRows = (size: number) => {
      for (let offset = 0; offset < size; offset++) {
        items.push({
          id: virtualRowId(getRowId(data[cursor.index])),
          type: "row",
          index: cursor.index,
        });
        cursor.index++;
      }
    };
    const appendGroups = (entries: BodyRowGroup[]) => {
      for (const group of entries) {
        items.push({ id: `group:${group.key}`, type: "group", group });
        if (group.children) appendGroups(group.children);
        else appendRows(group.size);
        if (group.summary)
          items.push({ id: `summary:${group.key}`, type: "summary", group });
      }
    };
    if (groups) appendGroups(groups);
    else appendRows(data.length);
    return items;
  }, [data, getRowId, groups]);
  const virtualExpandedRows = useMemo(
    () => new Set([...expandedRows].map(virtualRowId)),
    [expandedRows],
  );
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null);

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
  // between them. So are the rows of tree data, whose arrow keys also
  // expand and collapse them, and rows with a context menu, which Shift +
  // F10 opens.
  const hasFocusableRows = !!onRowClick || !!tree || !!getRowContextMenu;

  // The row the context menu is for - the one pressed last (a right click,
  // a long press) or the one the focus came into (Shift + F10). Known
  // before the menu opens: its entries are those of the row by then. A
  // field of an edited cell keeps the menu of the browser.
  const [menuRowId, setMenuRowId] = useState<RowId | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRow =
    menuRowId === null
      ? undefined
      : data.find((row) => getRowId(row) === menuRowId);
  const menuEntries =
    (menuRow !== undefined && getRowContextMenu?.(menuRow)) || NO_ENTRIES;

  const trackMenuRow = (body: Element, target: EventTarget | null) => {
    const rowElement =
      target instanceof Element && !isTypingTarget(target)
        ? findBodyRow(body, target)
        : null;
    const index = rowElement?.getAttribute("data-row-index");
    const row = index ? data[Number(index)] : undefined;
    const rowId = row === undefined ? null : getRowId(row);
    if (rowId !== menuRowId && !isMenuOpen) setMenuRowId(rowId);
  };

  const withRowMenu = (body: React.ReactElement) =>
    getRowContextMenu ? (
      <ContextMenu
        aria-label={messages.dataTable.rowMenu}
        items={menuEntries}
        onOpenChange={setIsMenuOpen}
        onPointerDown={(event) =>
          trackMenuRow(event.currentTarget, event.target)
        }
      >
        {body}
      </ContextMenu>
    ) : (
      body
    );

  const [activeRowId, setActiveRowId] = useState<RowId | null>(null);

  // The row with the focus stays rendered while it is scrolled out of view,
  // so that the focus - a checkbox, a cell being edited - is not lost; so
  // does the row being edited, which Tab may take far from the view
  const [focusedRowId, setFocusedRowId] = useState<RowId | null>(null);
  const keptRowIds = virtualized ? [focusedRowId, editingCell?.rowId] : [];
  const keepIndexes = keptRowIds.flatMap((rowId) =>
    rowId === null || rowId === undefined
      ? []
      : [
          bodyItems.findIndex(
            (item) =>
              item.type === "row" && getRowId(data[item.index]) === rowId,
          ),
        ],
  );
  if (virtualized && focusedGroupKey !== null)
    keepIndexes.push(
      bodyItems.findIndex(
        (item) => item.type === "group" && item.group.key === focusedGroupKey,
      ),
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
    data: bodyItems,
    getRowId: bodyItemId,
    enabled: virtualized,
    estimatedHeight: ESTIMATED_ROW_HEIGHTS[density],
    expandedRows: virtualExpandedRows,
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
    segment.type === "row" && bodyItems[segment.index].type === "row"
      ? [(bodyItems[segment.index] as Extract<BodyItem, { type: "row" }>).index]
      : [],
  );
  let tabStop: CellPosition | null = null;

  if (hasEditableColumns) {
    const activeIndex = activeCell
      ? data.findIndex((row) => getRowId(row) === activeCell.rowId)
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
          tabStop = { columnKey: column.key, rowId: getRowId(data[index]) };
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
        : data.findIndex((row) => getRowId(row) === activeRowId);
    const focusableIndexes = renderedIndexes.filter(
      (index) => getRowHref?.(data[index]) === undefined,
    );
    rowTabStop = focusableIndexes.includes(activeIndex)
      ? activeRowId
      : focusableIndexes.length > 0
        ? getRowId(data[focusableIndexes[0]])
        : null;
  }

  // A cell or row the arrow keys moved to that is still to be rendered - a
  // row of a virtualized table far from the view
  const pendingFocusRef = useRef<FocusTarget | null>(null);

  /** The element of a body cell - or row - when it is rendered. */
  const findCellElement = ({ columnKey, rowId }: FocusTarget) => {
    const index = data.findIndex((row) => getRowId(row) === rowId);
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

  /** Moves the focus to a row - one with a link is no tab stop. */
  const focusRow = (target: T) => {
    if (getRowHref?.(target) !== undefined) return;
    setActiveRowId(getRowId(target));
    focusTarget({ columnKey: null, rowId: getRowId(target) });
  };

  /**
   * The keys of tree data on a row (the tree view pattern): ArrowRight
   * expands a collapsed row and goes to the first sub row of an expanded
   * one, ArrowLeft collapses an expanded row and goes to the parent of
   * another - the other way round right to left; Enter expands and
   * collapses a row without `onRowClick`. Whether the key was taken.
   */
  const handleTreeKey = (
    row: T,
    index: number,
    event: React.KeyboardEvent<HTMLTableRowElement>,
  ) => {
    const levelOf = (candidate: T | undefined) =>
      candidate === undefined
        ? 0
        : (tree?.rows.get(getRowKey(getRowId(candidate)))?.level ?? 0);
    const state = tree?.rows.get(getRowKey(getRowId(row)));
    if (!tree || !state) return false;

    if (event.key === "Enter") {
      if (state.expanded === undefined) return false;
      event.preventDefault();
      tree.onToggle(getRowId(row));
      return true;
    }
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return false;

    event.preventDefault();
    const isRtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const isForward = (event.key === "ArrowRight") !== isRtl;

    if (isForward ? state.expanded === false : state.expanded) {
      tree.onToggle(getRowId(row));
    } else if (isForward) {
      const child = data[index + 1];
      if (state.expanded && levelOf(child) > state.level) focusRow(child);
    } else {
      for (let parent = index - 1; parent >= 0; parent--) {
        if (levelOf(data[parent]) < state.level) {
          focusRow(data[parent]);
          break;
        }
      }
    }
    return true;
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
    if (handleTreeKey(row, index, event)) return;
    let targetIndex =
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
    const step = event.key === "ArrowUp" || event.key === "End" ? -1 : 1;
    let target = data[targetIndex];
    while (target && getRowHref?.(target) !== undefined) {
      targetIndex += step;
      target = data[targetIndex];
    }
    if (!target || target === row) return;

    setActiveRowId(getRowId(target));
    focusTarget({ columnKey: null, rowId: getRowId(target) });
  };

  useLayoutEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;

    // Given up once the focus has left the table or the row is gone - the
    // cell must not take the focus from wherever the user is now
    const body = bodyRef.current;
    if (
      !body?.contains(body.ownerDocument.activeElement) ||
      !data.some((row) => getRowId(row) === pending.rowId)
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
      getRowId,
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

  // The rows (a memoized `TableRow`) get handlers that stay the same and
  // call the latest ones - a row renders again only when what it shows
  // changes, not on every render of the table. They close over the rows,
  // the selection and the focus, which change all the time; also without
  // the React Compiler, which memoizes none of them. Insertion effects
  // update them before the effects of the rows, also while Activity hides
  // the table.
  const rowCallbacks = {
    onCancelEdit,
    onCellFocus: handleCellFocus,
    onCellMove: moveCellFocus,
    onCommitEdit,
    onRowClick,
    onRowKeyDown: handleRowKeyDown,
    onRetryTree: tree?.onRetry,
    onStartEdit,
    onToggleTree: tree?.onToggle,
    toggleRowExpansion,
    toggleRowSelection,
  };
  const rowCallbacksRef = useRef(rowCallbacks);
  useInsertionEffect(() => {
    rowCallbacksRef.current = rowCallbacks;
  });
  const [rowHandlers] = useState(() => ({
    onCancelEdit: () => rowCallbacksRef.current.onCancelEdit(),
    onCellFocus: (rowId: RowId, columnKey: string) =>
      rowCallbacksRef.current.onCellFocus(rowId, columnKey),
    onCellMove: (row: T, column: Column<T>, move: CellMove) =>
      rowCallbacksRef.current.onCellMove(row, column, move),
    onCommitEdit: (
      row: T,
      column: Column<T>,
      change: CellChange,
      move: -1 | 0 | 1,
    ) => rowCallbacksRef.current.onCommitEdit(row, column, change, move),
    onRowClick: (
      row: T,
      event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    ) => rowCallbacksRef.current.onRowClick?.(row, event),
    onRowKeyDown: (row: T, event: React.KeyboardEvent<HTMLTableRowElement>) =>
      rowCallbacksRef.current.onRowKeyDown(row, event),
    onRetryTree: (rowId: RowId) => rowCallbacksRef.current.onRetryTree?.(rowId),
    onStartEdit: (rowId: RowId, columnKey: string) =>
      rowCallbacksRef.current.onStartEdit(rowId, columnKey),
    onToggleTree: (rowId: RowId) =>
      rowCallbacksRef.current.onToggleTree?.(rowId),
    toggleRowExpansion: (rowId: RowId) =>
      rowCallbacksRef.current.toggleRowExpansion(rowId),
    toggleRowSelection: (row: T, extend: boolean) =>
      rowCallbacksRef.current.toggleRowSelection(row, extend),
  }));

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
                  hiddenBelowClassName(layout),
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

  const renderRow = (index: number, virtualIndex: number) => {
    const row = data[index];
    const rowsBefore = tableRowsBefore(virtualIndex);
    const href = getRowHref?.(row);
    const treeRow = tree?.rows.get(getRowKey(getRowId(row)));

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
        contextMenuOpen={isMenuOpen && menuRowId === getRowId(row)}
        density={density}
        editHintId={editHintId}
        editingColumnKey={
          editingCell?.rowId === getRowId(row) ? editingCell.columnKey : null
        }
        getColumnSample={getColumnSample}
        getRowBackgroundColor={getRowBackgroundColor}
        getRowClassName={getRowClassName}
        hasSelection={hasSelection}
        highlightTerms={highlightTerms}
        href={href}
        idPrefix={idPrefix}
        isEditable={isEditable}
        isExpanded={expandedRows.has(getRowId(row))}
        isMobile={isMobile}
        isPartlySelected={partlySelectedIds?.has(getRowId(row))}
        isSelected={selectedIds.has(getRowId(row))}
        key={getRowKey(getRowId(row))}
        locale={locale}
        measureRef={measureRef}
        measureId={bodyItems[virtualIndex].id}
        onCancelEdit={rowHandlers.onCancelEdit}
        onCellFocus={rowHandlers.onCellFocus}
        onCellMove={rowHandlers.onCellMove}
        onCommitEdit={rowHandlers.onCommitEdit}
        onRowClick={onRowClick && rowHandlers.onRowClick}
        onRowFocus={setActiveRowId}
        onRetryTree={rowHandlers.onRetryTree}
        onRowKeyDown={rowHandlers.onRowKeyDown}
        onStartEdit={rowHandlers.onStartEdit}
        onToggleTree={rowHandlers.onToggleTree}
        renderSubRow={renderSubRow}
        row={row}
        getRowId={getRowId}
        selectable={!isRowSelectable || isRowSelectable(row)}
        rowIndex={index}
        rowTabIndex={
          hasFocusableRows && href === undefined
            ? rowTabStop === getRowId(row)
              ? 0
              : -1
            : undefined
        }
        tabStopColumnKey={
          tabStop?.rowId === getRowId(row) ? tabStop.columnKey : null
        }
        toggleRowExpansion={rowHandlers.toggleRowExpansion}
        toggleRowSelection={rowHandlers.toggleRowSelection}
        treeColumnKey={tree?.columnKey}
        treeExpanded={treeRow?.expanded}
        treeLevel={treeRow?.level}
        treePosInSet={treeRow?.posInSet}
        treeSetSize={treeRow?.setSize}
        treeStatus={treeRow?.status}
      />
    );
  };

  const renderGroup = (
    item: Extract<BodyItem, { type: "group" | "summary" }>,
    index: number,
  ) => {
    const { group } = item;
    const rowsBefore = tableRowsBefore(index);
    const ariaRowIndex =
      rowsBefore === undefined ? undefined : headerRowCount + rowsBefore + 1;
    const Chevron = group.collapsed ? ChevronRight : ChevronDown;
    return item.type === "summary" ? (
      <tr
        aria-rowindex={ariaRowIndex}
        className="bg-neutral-50/60 font-medium dark:bg-neutral-900/60"
        data-measure-key={
          measureRef ? getMeasureKey(item.id, false) : undefined
        }
        key={item.id}
        ref={measureRef}
      >
        <SummaryCells
          cellLayouts={cellLayouts}
          density={density}
          hasActions={!!actions}
          hasSelection={hasSelection}
          hasSubRows={!!renderSubRow}
          sortedVisibleColumns={sortedVisibleColumns}
          values={group.summary!}
        />
      </tr>
    ) : (
      <tr
        aria-rowindex={ariaRowIndex}
        className="bg-neutral-50 dark:bg-neutral-900"
        data-group-key={group.key}
        data-group-level={group.level ?? 0}
        data-measure-key={
          measureRef ? getMeasureKey(item.id, false) : undefined
        }
        data-state={group.collapsed ? "closed" : "open"}
        key={item.id}
        ref={measureRef}
      >
        <td className="px-2 py-1" colSpan={columnCount}>
          <button
            aria-expanded={!group.collapsed}
            className="sticky inset-s-2 inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            data-state={group.collapsed ? "closed" : "open"}
            onClick={() => onToggleGroup(group.key)}
            style={{ marginInlineStart: `${(group.level ?? 0) * 20}px` }}
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
              label: group.columnLabel ?? "",
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
    );
  };

  return withRowMenu(
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
        if (getRowContextMenu) trackMenuRow(event.currentTarget, event.target);
        // Focus in a popup of a row (a portal) keeps the row it came from
        const target = event.target as Element;
        const rowElement = findBodyRow(event.currentTarget, target);
        const index = rowElement?.getAttribute("data-row-index");
        const row = index ? data[Number(index)] : undefined;
        if (!row || !rowElement) {
          const key = target
            .closest("tr[data-group-key]")
            ?.getAttribute("data-group-key");
          if (key !== undefined && key !== null) setFocusedGroupKey(key);
          return;
        }
        setFocusedGroupKey(null);

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
        if (getRowId(row) !== focusedRowId) setFocusedRowId(getRowId(row));
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

          const item = bodyItems[segment.index];
          return item.type === "row"
            ? renderRow(item.index, segment.index)
            : renderGroup(item, segment.index);
        })
      )}
    </tbody>,
  );
}
