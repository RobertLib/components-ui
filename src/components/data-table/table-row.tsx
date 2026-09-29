import { isValidElement, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import CellEditor from "./cell-editor";
import cn, { joinTokens } from "../../utils/cn";
import EdgeShadow from "./edge-shadow";
import HighlightedText from "./highlight";
import IconButton from "../icon-button";
import Popover from "../popover";
import Spinner from "../spinner";
import { formatCellValue } from "./format-value";
import {
  DEFAULT_CELL_LAYOUT,
  DENSITY_CLASSES,
  getCellStyle,
  isClipped,
  isSticky,
  LEADING_KEYS,
  type CellLayout,
} from "./cell-layout";
import {
  getCellKey,
  getShownValue,
  isEmpty,
  type CellChange,
  type CellEditState,
} from "./editing";
import { getCellMove, type CellMove } from "./cell-navigation";
import { getColumnValue } from "./query";
import { getMeasureKey } from "./use-virtual-rows";
import { useRouter } from "../../providers/ui-context";
import type { Column, DataTableDensity, RowId } from "./types";
import type { Locale } from "../../i18n/types";

const MAX_CELL_TEXT_LENGTH = 80;

// The shown value of a cell whose `render` needs none
const NO_VALUE = { overridden: false, value: undefined };

// Controls in a cell - a click on them is theirs, not the cell's
const CELL_CONTROL = "a, button, input, select, textarea, [role=button]";

// What a click activating the row must not be on: controls, focusable
// elements (an editable cell, the trigger of a popover), the built-in
// expand, selection and actions cells
const ROW_CONTROL = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  "[role=button]",
  "[role=checkbox]",
  "[role=combobox]",
  "[role=link]",
  "[role=menuitem]",
  "[role=option]",
  "[role=switch]",
  "[role=textbox]",
  "[tabindex]",
  "[data-leading-column]",
].join(", ");

/**
 * Whether a click on a row activates it: not in a portal of the row (a
 * popover), not on a control in it, not at the end of selecting its text.
 */
function isRowActivation(rowElement: HTMLElement, target: Element) {
  if (!rowElement.contains(target)) return false;

  // The row itself is focusable (a tab stop) - it is no control in itself
  const control = target.closest(ROW_CONTROL);
  if (control && control !== rowElement && rowElement.contains(control)) {
    return false;
  }

  const selection = rowElement.ownerDocument.getSelection();
  return !(
    selection &&
    !selection.isCollapsed &&
    selection.toString().trim() !== "" &&
    (rowElement.contains(selection.anchorNode) ||
      rowElement.contains(selection.focusNode))
  );
}

/** Whether a click or key came with Shift held. */
const isShiftEvent = (event: Event) =>
  "shiftKey" in event && event.shiftKey === true;

/**
 * Scrolls a focused cell wholly into view of the table - the browser leaves
 * a cell half out of view, or under a pinned column, as it is. A sticky
 * cell is in view sideways anyway, and `scrollIntoView` would scroll the
 * table to where it would be without sticking - it is scrolled up or down
 * only, out from under the sticky header and summary rows.
 */
function revealCell(cell: HTMLElement, isSticky: boolean) {
  if (!isSticky) {
    cell.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }

  const scroller = cell.closest<HTMLElement>("[data-table-scroll]");
  if (!scroller) return;

  const style = getComputedStyle(scroller);
  const view = scroller.getBoundingClientRect();
  const rect = cell.getBoundingClientRect();
  const top = view.top + (parseFloat(style.scrollPaddingTop) || 0);
  const bottom = view.bottom - (parseFloat(style.scrollPaddingBottom) || 0);

  if (rect.top < top) scroller.scrollTop -= top - rect.top;
  else if (rect.bottom > bottom) scroller.scrollTop += rect.bottom - bottom;
}

/**
 * What a cell shows: the column's `render`, or the value as text - dates
 * and booleans by the locale, lists joined by commas. A change of the cell
 * shows its value instead of the row's (see `getShownValue`).
 */
function getCellContent<T>(
  row: T,
  column: Column<T>,
  shown: { overridden: boolean; value: unknown },
  locale: Locale,
): React.ReactNode {
  if (shown.overridden) {
    // The value goes where `render` reads it - unless `getValue` takes it
    // from elsewhere, then the value is shown as text
    if (column.render && !column.getValue) {
      return column.render({ ...row, [column.key]: shown.value });
    }
    return formatCellValue(shown.value, locale) ?? null;
  }

  if (column.render) return column.render(row);

  return (formatCellValue(shown.value, locale) ??
    shown.value) as React.ReactNode;
}

interface TableRowProps<T extends { id: RowId }> {
  /** Content of the sticky actions cell. */
  actions?: (row: T) => React.ReactNode;
  /** `aria-rowindex` of a virtualized row. */
  ariaRowIndex?: number;
  /** Layouts by column key - also of `expand`, `selection` and `actions`. */
  cellLayouts: Record<string, CellLayout>;
  /** The changes of cells by `getCellKey`. */
  cellStates: ReadonlyMap<string, CellEditState<T>>;
  /** Number of cells of the row - the detail row spans them. */
  columnCount: number;
  /** The visible columns in the order they are shown. */
  columns: Column<T>[];
  /** Height of the row. */
  density: DataTableDensity;
  /** A value of a column from any row - it picks the field of an empty cell. */
  getColumnSample: (column: Column<T>) => unknown;
  /** Id of the text describing editable cells. */
  editHintId: string;
  /** Key of the column whose cell of this row is being edited. */
  editingColumnKey: string | null;
  /** Background of the row (any CSS color). */
  getRowBackgroundColor?: (row: T) => string | undefined;
  /** Extra classes of the row. */
  getRowClassName?: (row: T) => string | undefined;
  /** The row has a selection checkbox. */
  hasSelection: boolean;
  /** Term to highlight by column key - its filter, or the global search. */
  highlightTerms: Record<string, string>;
  /** The page the row opens - its first cell links there. */
  href?: string;
  /** Prefix of the ids of the row's elements. */
  idPrefix: string;
  /** Whether a cell of the row can be edited. */
  isEditable: (column: Column<T>, row: T) => boolean;
  /** The detail row is shown. */
  isExpanded: boolean;
  /** Touch device - long texts open on tap. */
  isMobile: boolean;
  /** The checkbox is checked. */
  isSelected: boolean;
  /** Formats the values. */
  locale: Locale;
  /** Measures the row and its detail row (virtualization). */
  measureRef?: (element: HTMLElement | null) => void | (() => void);
  /** Ends the editing without a change. */
  onCancelEdit: () => void;
  /** The focus came into an editable cell - it is the tab stop now. */
  onCellFocus: (rowId: RowId, columnKey: string) => void;
  /** Moves the focus from an editable cell to another one (arrow keys). */
  onCellMove: (row: T, column: Column<T>, move: CellMove) => void;
  /** A click on the row, or Enter on it - see `DataTableProps.onRowClick`. */
  onRowClick?: (
    row: T,
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  /** The focus came into the row itself - it is the tab stop now. */
  onRowFocus?: (rowId: RowId) => void;
  /** A key pressed on the row itself - the arrow keys move between rows. */
  onRowKeyDown?: (event: React.KeyboardEvent<HTMLTableRowElement>) => void;
  /** Ends the editing - saves a changed value, see `CellEditor`. */
  onCommitEdit: (
    row: T,
    column: Column<T>,
    change: CellChange,
    move: -1 | 0 | 1,
  ) => boolean;
  /** Starts editing a cell. */
  onStartEdit: (rowId: RowId, columnKey: string) => void;
  /** The expandable detail of the row. */
  renderSubRow?: (row: T) => React.ReactNode;
  /** The row. */
  row: T;
  /** Position of the row in the rows of the table. */
  rowIndex: number;
  /**
   * The `tabIndex` of a row that is a tab stop of its own (`onRowClick`
   * without links) - `0` for the one the rows are reached by.
   */
  rowTabIndex?: 0 | -1;
  /**
   * The column of the editable cell of the row that is the tab stop of the
   * editable cells - `null` for none of this row.
   */
  tabStopColumnKey: string | null;
  /** Expands or collapses the detail row. */
  toggleRowExpansion: (rowId: RowId) => void;
  /**
   * Selects or deselects the row - `extend` (Shift) also the rows from the
   * one toggled before.
   */
  toggleRowSelection: (row: T, extend: boolean) => void;
}

/** A row of the table body, with its detail row when expanded. */
export function TableRow<T extends { id: RowId }>({
  actions,
  ariaRowIndex,
  cellLayouts,
  cellStates,
  columnCount,
  columns,
  density,
  editHintId,
  editingColumnKey,
  getColumnSample,
  getRowBackgroundColor,
  getRowClassName,
  hasSelection,
  highlightTerms,
  href,
  idPrefix,
  isEditable,
  isExpanded,
  isMobile,
  isSelected,
  locale,
  measureRef,
  onCancelEdit,
  onCellFocus,
  onCellMove,
  onCommitEdit,
  onRowClick,
  onRowFocus,
  onRowKeyDown,
  onStartEdit,
  renderSubRow,
  row,
  rowIndex,
  rowTabIndex,
  tabStopColumnKey,
  toggleRowExpansion,
  toggleRowSelection,
}: TableRowProps<T>) {
  const { messages } = locale;
  const { Link } = useRouter();
  // A tap on an editable cell that has the focus already starts editing -
  // touch screens have no double-click to speak of
  const tapRef = useRef<string | null>(null);
  const isActivatable = href !== undefined || !!onRowClick;

  // A click on the row - its link follows it, as a click on the link would,
  // with the keys held (Ctrl + click opens a new tab)
  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
    const rowElement = event.currentTarget;
    if (!isRowActivation(rowElement, event.target as Element)) return;

    if (href === undefined) {
      onRowClick?.(row, event);
      return;
    }

    rowElement.querySelector("[data-row-link]")?.dispatchEvent(
      new MouseEvent("click", {
        altKey: event.altKey,
        bubbles: true,
        button: event.button,
        cancelable: true,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      }),
    );
  };

  // "Select row" alone does not tell the rows apart - the controls of a row
  // add its first cell to their names
  const rowLabelId = columns.length ? `${idPrefix}-row-${rowIndex}` : undefined;
  const labelledBy = (controlId: string) =>
    rowLabelId ? `${controlId} ${rowLabelId}` : undefined;
  const expandId = `${idPrefix}-expand-${rowIndex}`;
  const detailId = `${idPrefix}-detail-${rowIndex}`;
  const selectId = `${idPrefix}-select-${rowIndex}`;
  const backgroundColor = getRowBackgroundColor?.(row);
  const rowStyle = backgroundColor ? { backgroundColor } : undefined;
  const densityClass = DENSITY_CLASSES[density];
  const expandLabel = isExpanded
    ? messages.dataTable.collapseRow
    : messages.dataTable.expandRow;

  // Sticky cells need a background of their own - the scrolled cells pass
  // under them
  const stickyBackground =
    !backgroundColor &&
    "bg-surface group-hover:bg-neutral-50 dark:bg-surface-dark dark:group-hover:bg-neutral-800";

  const leadingLayout = (key: string) =>
    cellLayouts[key] ?? DEFAULT_CELL_LAYOUT;

  return (
    <>
      {/* No `aria-selected` - it belongs to grid rows, not to the rows of a
          table; the row's checkbox tells the selection. `data-selected` and
          `data-state` (of a row with a detail) are for styling. */}
      <tr
        aria-rowindex={ariaRowIndex}
        className={cn(
          "group transition-colors duration-150 hover:bg-neutral-100/80 motion-reduce:transition-none dark:hover:bg-neutral-800/80",
          isActivatable && "cursor-pointer",
          rowTabIndex !== undefined &&
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-400",
          getRowClassName?.(row),
        )}
        data-measure-key={measureRef ? getMeasureKey(row.id, false) : undefined}
        data-row-index={rowIndex}
        data-selected={isSelected ? "" : undefined}
        data-state={renderSubRow ? (isExpanded ? "open" : "closed") : undefined}
        onClick={isActivatable ? handleRowClick : undefined}
        onFocus={
          rowTabIndex === undefined
            ? undefined
            : (event) => {
                if (event.target === event.currentTarget) onRowFocus?.(row.id);
              }
        }
        onKeyDown={
          rowTabIndex === undefined
            ? undefined
            : (event) => {
                // Keys of the row itself, not of a control in it
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" && onRowClick) {
                  event.preventDefault();
                  onRowClick(row, event);
                  return;
                }
                onRowKeyDown?.(event);
              }
        }
        ref={measureRef}
        style={rowStyle}
        tabIndex={rowTabIndex}
      >
        {renderSubRow && (
          <td
            className={cn(
              "sticky z-1 w-10 text-center transition-colors duration-150",
              stickyBackground,
            )}
            data-leading-column="expand"
            style={{
              ...rowStyle,
              ...getCellStyle(null, leadingLayout(LEADING_KEYS.expand), false),
            }}
          >
            <EdgeShadow side={leadingLayout(LEADING_KEYS.expand).shadow} />
            <IconButton
              // Only at a detail that is shown
              aria-controls={isExpanded ? detailId : undefined}
              aria-expanded={isExpanded}
              aria-label={expandLabel}
              aria-labelledby={labelledBy(expandId)}
              className={density === "compact" ? undefined : "mt-0.75"}
              data-state={isExpanded ? "open" : "closed"}
              id={expandId}
              onClick={() => toggleRowExpansion(row.id)}
              title={expandLabel}
            >
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight className="rtl:rotate-180" size={16} />
              )}
            </IconButton>
          </td>
        )}
        {hasSelection && (
          <td
            className={cn(
              "sticky z-1 px-2 transition-colors duration-150",
              densityClass,
              stickyBackground,
            )}
            data-leading-column="selection"
            style={{
              ...rowStyle,
              ...getCellStyle(
                null,
                leadingLayout(LEADING_KEYS.selection),
                false,
              ),
            }}
          >
            <EdgeShadow side={leadingLayout(LEADING_KEYS.selection).shadow} />
            <input
              aria-label={messages.dataTable.selectRow}
              aria-labelledby={labelledBy(selectId)}
              checked={isSelected}
              className="accent-primary-500"
              id={selectId}
              // The change of a checkbox comes with its click - Shift also
              // when Space toggles it
              onChange={(event) =>
                toggleRowSelection(row, isShiftEvent(event.nativeEvent))
              }
              type="checkbox"
            />
          </td>
        )}
        {actions && (
          <td
            className={cn(
              "sticky z-1 px-2 transition-colors duration-150",
              densityClass,
              stickyBackground,
            )}
            data-leading-column="actions"
            style={{
              ...rowStyle,
              ...getCellStyle(null, leadingLayout(LEADING_KEYS.actions), false),
            }}
          >
            <div className="absolute -end-px top-0 h-full border-e border-neutral-200 shadow dark:border-neutral-800" />
            <EdgeShadow side={leadingLayout(LEADING_KEYS.actions).shadow} />
            {actions(row)}
          </td>
        )}
        {columns.map((column, columnIndex) => {
          const layout = cellLayouts[column.key] ?? DEFAULT_CELL_LAYOUT;
          const sticky = isSticky(layout);
          const cellId = columnIndex === 0 ? rowLabelId : undefined;
          const state = cellStates.get(getCellKey(row.id, column.key));
          const isPending = state?.status === "pending";
          // A cell being saved stays a tab stop, but cannot be edited again
          // until the save is done
          const isEditableCell = isEditable(column, row);
          const canEdit = isEditableCell && !isPending;
          const isEditing = canEdit && editingColumnKey === column.key;
          // The first cell holds the link of the row
          const isLinkCell = href !== undefined && columnIndex === 0;
          // The value only where it is needed - a `render` shows the cell
          // itself, and `getValue` may be costly
          const shown =
            state || isEditing || !column.render
              ? getShownValue(state, row, getColumnValue(row, column))
              : NO_VALUE;
          const columnName = column.labelTitle ?? column.label;
          const messageId =
            state?.status === "failed" && !isEditing
              ? `${idPrefix}-message-${rowIndex}-${columnIndex}`
              : undefined;

          let content: React.ReactNode;

          if (isEditing) {
            content = (
              <CellEditor
                column={column}
                columnName={columnName}
                initialValue={shown.value}
                onCancel={onCancelEdit}
                onCommit={(change, move) =>
                  onCommitEdit(row, column, change, move)
                }
                row={row}
                sampleValue={
                  isEmpty(shown.value) ? getColumnSample(column) : undefined
                }
              />
            );
          } else {
            const cellContent = getCellContent(row, column, shown, locale);
            // The column filter wins over the global search
            const highlightTerm = highlightTerms[column.key];

            if (
              typeof cellContent === "string" ||
              typeof cellContent === "number"
            ) {
              const text = String(cellContent);

              if (text.length <= MAX_CELL_TEXT_LENGTH) {
                content = <HighlightedText term={highlightTerm} text={text} />;
              } else if (isEditableCell || isLinkCell) {
                // An editable cell is a control itself, a link cannot hold
                // one - no popover in them; the field shows the whole text
                content = (
                  <span title={text}>
                    <HighlightedText
                      term={highlightTerm}
                      text={`${text.substring(0, MAX_CELL_TEXT_LENGTH)}...`}
                    />
                  </span>
                );
              } else {
                content = (
                  <Popover
                    contentClassName="p-2"
                    position="bottom"
                    // Reachable from the keyboard, where it opens on focus
                    tabIndex={0}
                    trigger={
                      <div>
                        <HighlightedText
                          term={highlightTerm}
                          text={`${text.substring(0, MAX_CELL_TEXT_LENGTH)}...`}
                        />
                      </div>
                    }
                    triggerType={isMobile ? "click" : "hover"}
                    width="320px"
                  >
                    {text}
                  </Popover>
                );
              }
            } else {
              // Several nodes only from `render` - a list value is text by now
              content =
                isValidElement(cellContent) ||
                (column.render && Array.isArray(cellContent))
                  ? cellContent
                  : null;
            }

            if (isLinkCell) {
              content = (
                <Link
                  className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  data-row-link=""
                  href={href}
                  // Before the link is followed - `preventDefault()` stays
                  onClick={
                    onRowClick ? (event) => onRowClick(row, event) : undefined
                  }
                >
                  {content}
                </Link>
              );
            }

            if (isPending) {
              content = (
                <span className="inline-flex items-center gap-1.5">
                  {content}
                  <Spinner label={messages.dataTable.saving} size="sm" />
                </span>
              );
            }

            // Announced once by the table - a row rendered again must not
            // announce it again; the cell is described by it
            if (state?.status === "failed") {
              content = (
                <>
                  {content}
                  <span
                    className="block text-xs text-danger-700 dark:text-danger-400"
                    id={messageId}
                  >
                    {state.message}
                  </span>
                </>
              );
            }
          }

          return (
            <td
              aria-busy={isPending || undefined}
              aria-describedby={joinTokens(
                isEditableCell && !isEditing && editHintId,
                messageId,
              )}
              className={cn(
                "px-2",
                densityClass,
                sticky && stickyBackground,
                sticky && "sticky z-1 transition-colors duration-150",
                isEditableCell &&
                  "cursor-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-400",
              )}
              // The arrow keys find the cell of a column by it
              data-column-key={column.key}
              id={cellId}
              key={column.key}
              onClick={
                canEdit && !isEditing
                  ? (event) => {
                      const wasTapped = tapRef.current === column.key;
                      tapRef.current = null;
                      if (
                        wasTapped &&
                        !(event.target as Element).closest(CELL_CONTROL)
                      ) {
                        onStartEdit(row.id, column.key);
                      }
                    }
                  : undefined
              }
              onDoubleClick={
                canEdit && !isEditing
                  ? () => onStartEdit(row.id, column.key)
                  : undefined
              }
              onFocus={
                isEditableCell
                  ? (event) => {
                      // Also the field of the cell - the tab stop stays here
                      onCellFocus(row.id, column.key);
                      if (event.target === event.currentTarget) {
                        revealCell(event.currentTarget, sticky);
                      }
                    }
                  : undefined
              }
              onKeyDown={
                isEditableCell && !isEditing
                  ? (event) => {
                      // Keys of the cell itself, not of a link in it
                      if (event.target !== event.currentTarget) return;
                      if (
                        canEdit &&
                        (event.key === "Enter" || event.key === "F2")
                      ) {
                        event.preventDefault();
                        onStartEdit(row.id, column.key);
                        return;
                      }
                      const move = getCellMove(event);
                      if (move) {
                        event.preventDefault();
                        onCellMove(row, column, move);
                      }
                    }
                  : undefined
              }
              onPointerDown={
                canEdit && !isEditing
                  ? (event) => {
                      tapRef.current =
                        event.pointerType === "touch" &&
                        document.activeElement === event.currentTarget
                          ? column.key
                          : null;
                    }
                  : undefined
              }
              style={{
                ...getCellStyle(column, layout, false),
                ...(backgroundColor && { backgroundColor }),
              }}
              // The editable cells are one tab stop - the arrow keys move
              // between them; a cell being edited has its field instead
              tabIndex={
                isEditableCell
                  ? !isEditing && tabStopColumnKey === column.key
                    ? 0
                    : -1
                  : undefined
              }
            >
              <EdgeShadow side={layout.shadow} />
              {/* A field being edited keeps its focus ring */}
              {isClipped(column, layout) && !isEditing ? (
                <div className="overflow-hidden">{content}</div>
              ) : (
                content
              )}
            </td>
          );
        })}
      </tr>
      {renderSubRow && isExpanded && (
        <tr
          aria-rowindex={
            ariaRowIndex === undefined ? undefined : ariaRowIndex + 1
          }
          className="bg-neutral-50 dark:bg-neutral-900"
          data-measure-key={
            measureRef ? getMeasureKey(row.id, true) : undefined
          }
          data-row-index={rowIndex}
          id={detailId}
          ref={measureRef}
        >
          <td colSpan={columnCount} className="p-4">
            {renderSubRow(row)}
          </td>
        </tr>
      )}
    </>
  );
}
