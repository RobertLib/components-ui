import { Fragment, isValidElement, useId } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import cn from "../../utils/cn";
import HighlightedText from "./highlight";
import IconButton from "../icon-button";
import Popover from "../popover";
import Spinner from "../spinner";
import useIsMobile from "../../hooks/use-is-mobile";
import { formatCellValue } from "./format-value";
import { getColumnValue } from "./query";
import { useLocale } from "../../providers/ui-context";
import type { Column, GroupAction, RowId } from "./types";

const MAX_CELL_TEXT_LENGTH = 80;

// Fixed so the placeholder rows do not change width on every render
const SKELETON_WIDTHS = [72, 45, 60, 38, 80, 52, 66, 30, 58, 47];

interface TableBodyProps<T extends { id: RowId }> {
  actions?: (row: T) => React.ReactNode;
  calculatePosition: (columnKey: string, position: "left" | "right") => string;
  data: T[];
  emptyMessage?: string;
  expandedRows: Set<RowId>;
  filters: Record<string, string>;
  getRowBackgroundColor?: (row: T) => string | undefined;
  getRowClassName?: (row: T) => string | undefined;
  groupActions?: GroupAction<T>[];
  loading?: boolean;
  pinnedColumns: { left: string[]; right: string[] };
  renderSubRow?: (row: T) => React.ReactNode;
  search: string;
  selectedRows: T[];
  sortedVisibleColumns: Column<T>[];
  toggleRowExpansion: (rowId: RowId) => void;
  toggleRowSelection: (row: T) => void;
}

export function TableBody<T extends { id: RowId }>({
  actions,
  calculatePosition,
  data,
  emptyMessage,
  expandedRows,
  filters,
  getRowBackgroundColor,
  getRowClassName,
  groupActions,
  loading,
  pinnedColumns,
  renderSubRow,
  search,
  selectedRows,
  sortedVisibleColumns,
  toggleRowExpansion,
  toggleRowSelection,
}: TableBodyProps<T>) {
  const locale = useLocale();
  const { messages } = locale;
  const idPrefix = useId();

  // Touch devices have no hover - long texts open on tap there
  const isMobile = useIsMobile();

  const columnCount =
    sortedVisibleColumns.length +
    (actions ? 1 : 0) +
    (groupActions && groupActions.length > 0 ? 1 : 0) +
    (renderSubRow ? 1 : 0);

  return (
    <tbody
      className={cn(
        "divide-y divide-neutral-100 transition-opacity dark:divide-neutral-900",
        // New rows are on their way - dim the old ones meanwhile
        loading && data.length > 0 && "opacity-60",
      )}
    >
      {data.length === 0 ? (
        loading ? (
          <>
            <tr>
              <td
                className="absolute inset-0 z-10 animate-fade-in"
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
                  <td className="w-10 text-center">
                    <div className="mx-auto h-5 w-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  </td>
                )}
                {groupActions && groupActions.length > 0 && (
                  <td className="sticky left-0 bg-surface px-2 py-1 dark:bg-surface-dark">
                    <div className="h-4 w-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  </td>
                )}
                {actions && (
                  <td
                    className="sticky z-1 bg-surface px-2 py-1 text-sm dark:bg-surface-dark"
                    style={{ left: calculatePosition("actions", "left") }}
                  >
                    <div className="h-6 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  </td>
                )}
                {sortedVisibleColumns.map((_, colIndex) => (
                  <td
                    className="px-2 py-1"
                    key={`skeleton-${index}-${colIndex}`}
                  >
                    <div
                      className="h-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
                      style={{
                        width: `${SKELETON_WIDTHS[(index + colIndex * 3) % SKELETON_WIDTHS.length]}%`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </>
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
        data.map((row, rowIndex) => {
          // "Select row" alone does not tell the rows apart - the controls
          // of a row add its first cell to their names
          const rowLabelId = sortedVisibleColumns.length
            ? `${idPrefix}-row-${rowIndex}`
            : undefined;
          const labelledBy = (controlId: string) =>
            rowLabelId ? `${controlId} ${rowLabelId}` : undefined;
          const expandId = `${idPrefix}-expand-${rowIndex}`;
          const selectId = `${idPrefix}-select-${rowIndex}`;
          const backgroundColor = getRowBackgroundColor?.(row);
          const rowStyle = backgroundColor ? { backgroundColor } : undefined;
          const extraClassName = getRowClassName?.(row);
          const isExpanded = expandedRows.has(row.id);
          const expandLabel = isExpanded
            ? messages.dataTable.collapseRow
            : messages.dataTable.expandRow;

          return (
            <Fragment key={row.id}>
              <tr
                aria-selected={
                  groupActions?.length
                    ? selectedRows.some((r) => r.id === row.id)
                    : undefined
                }
                className={cn(
                  "group transition-colors duration-150 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80",
                  extraClassName,
                )}
                style={rowStyle}
              >
                {renderSubRow && (
                  <td className="w-10 text-center">
                    <IconButton
                      aria-expanded={isExpanded}
                      aria-label={expandLabel}
                      aria-labelledby={labelledBy(expandId)}
                      className="mt-0.75"
                      id={expandId}
                      onClick={() => toggleRowExpansion(row.id)}
                      title={expandLabel}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </IconButton>
                  </td>
                )}
                {groupActions && groupActions.length > 0 && (
                  <td
                    className={cn(
                      "sticky left-0 px-2 py-1",
                      !backgroundColor && "bg-surface dark:bg-surface-dark",
                    )}
                    style={rowStyle}
                  >
                    <input
                      aria-label={messages.dataTable.selectRow}
                      aria-labelledby={labelledBy(selectId)}
                      checked={selectedRows.some((r) => r.id === row.id)}
                      className="accent-primary-500"
                      id={selectId}
                      onChange={() => toggleRowSelection(row)}
                      type="checkbox"
                    />
                  </td>
                )}
                {actions && (
                  <td
                    className={cn(
                      "sticky z-1 px-2 py-1 text-sm transition-colors duration-150",
                      !backgroundColor &&
                        "bg-surface group-hover:bg-neutral-50 dark:bg-surface-dark dark:group-hover:bg-neutral-800",
                    )}
                    data-column-key="actions"
                    style={{
                      ...rowStyle,
                      left: calculatePosition("actions", "left"),
                    }}
                  >
                    <div className="absolute top-0 -right-px h-full border-r border-neutral-200 shadow dark:border-neutral-800" />
                    {actions(row)}
                  </td>
                )}
                {sortedVisibleColumns.map((column, columnIndex) => {
                  const cellId = columnIndex === 0 ? rowLabelId : undefined;
                  const isPinnedLeft = pinnedColumns.left.includes(column.key);
                  const isPinnedRight = pinnedColumns.right.includes(
                    column.key,
                  );

                  const leftPosition = isPinnedLeft
                    ? calculatePosition(column.key, "left")
                    : "auto";
                  const rightPosition = isPinnedRight
                    ? calculatePosition(column.key, "right")
                    : "auto";

                  const cellStyle: React.CSSProperties = {
                    left: leftPosition,
                    right: rightPosition,
                    ...(backgroundColor && { backgroundColor }),
                  };

                  if (column.minWidth !== undefined) {
                    cellStyle.minWidth = `${column.minWidth}px`;
                  }
                  if (column.maxWidth !== undefined) {
                    cellStyle.maxWidth = `${column.maxWidth}px`;
                  }

                  const cellClassName = cn(
                    "px-2 py-1 text-sm",
                    (isPinnedLeft || isPinnedRight) &&
                      !backgroundColor &&
                      "bg-surface group-hover:bg-neutral-50 dark:bg-surface-dark dark:group-hover:bg-neutral-800",
                    (isPinnedLeft || isPinnedRight) &&
                      "sticky z-1 transition-colors duration-150",
                    column.maxWidth &&
                      !column.disableOverflow &&
                      "overflow-hidden",
                  );

                  // Without `render` the value is shown as text - dates and
                  // booleans formatted by the locale
                  const value = column.render
                    ? undefined
                    : getColumnValue(row, column);
                  const cellContent = (
                    column.render
                      ? column.render(row)
                      : (formatCellValue(value, locale) ?? value)
                  ) as React.ReactNode;

                  // The column filter wins over the global search
                  const highlightTerm = filters[column.key] || search;

                  if (
                    typeof cellContent === "string" ||
                    typeof cellContent === "number"
                  ) {
                    const stringContent = String(cellContent);

                    if (stringContent.length > MAX_CELL_TEXT_LENGTH) {
                      return (
                        <td
                          className={cellClassName}
                          id={cellId}
                          key={column.key}
                          style={cellStyle}
                        >
                          <Popover
                            contentClassName="p-2"
                            position="bottom"
                            // Reachable from the keyboard, where it opens on focus
                            tabIndex={0}
                            trigger={
                              <div>
                                <HighlightedText
                                  term={highlightTerm}
                                  text={`${stringContent.substring(0, MAX_CELL_TEXT_LENGTH)}...`}
                                />
                              </div>
                            }
                            triggerType={isMobile ? "click" : "hover"}
                            width="320px"
                          >
                            {stringContent}
                          </Popover>
                        </td>
                      );
                    }

                    return (
                      <td
                        className={cellClassName}
                        id={cellId}
                        key={column.key}
                        style={cellStyle}
                      >
                        <HighlightedText
                          term={highlightTerm}
                          text={stringContent}
                        />
                      </td>
                    );
                  }

                  return (
                    <td
                      className={cellClassName}
                      id={cellId}
                      key={column.key}
                      style={cellStyle}
                    >
                      {isValidElement(cellContent) || Array.isArray(cellContent)
                        ? cellContent
                        : null}
                    </td>
                  );
                })}
              </tr>
              {renderSubRow && isExpanded && (
                <tr className="bg-neutral-50 dark:bg-neutral-900">
                  <td colSpan={columnCount} className="p-4">
                    {renderSubRow(row)}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })
      )}
    </tbody>
  );
}
