import cn from "../../utils/cn";
import EdgeShadow from "./edge-shadow";
import {
  DEFAULT_CELL_LAYOUT,
  DENSITY_CLASSES,
  getCellStyle,
  isClipped,
  isSticky,
  type CellLayout,
} from "./cell-layout";
import { formatSummaryValue } from "./summary";
import { useLocale } from "../../providers/ui-context";
import type { Column, DataTableDensity } from "./types";

interface TableSummaryProps<T> {
  /** `aria-rowindex` of the row in a virtualized table - the last one. */
  ariaRowIndex?: number;
  /** The table has an actions column - the row gets a cell under it. */
  hasActions: boolean;
  /** The table has a selection column. */
  hasSelection: boolean;
  /** The table has an expand column. */
  hasSubRows: boolean;
  /** Layouts by column key - also of `expand`, `selection` and `actions`. */
  cellLayouts: Record<string, CellLayout>;
  /** Height of the row. */
  density: DataTableDensity;
  /** The `<tfoot>` - its height is measured. */
  ref?: React.Ref<HTMLTableSectionElement>;
  /** The visible columns in the order they are shown. */
  sortedVisibleColumns: Column<T>[];
  /** The value of each column in the row, by column key. */
  values: Record<string, unknown>;
}

/**
 * The summary row under the rows - the `summary` of each column, or a
 * value the server gave. It sticks to the bottom of a table that scrolls.
 */
export function TableSummary<T>({
  ariaRowIndex,
  cellLayouts,
  density,
  hasActions,
  hasSelection,
  hasSubRows,
  ref,
  sortedVisibleColumns,
  values,
}: TableSummaryProps<T>) {
  const locale = useLocale();
  const labels = locale.messages.dataTable.summary;
  const densityClass = DENSITY_CLASSES[density];

  const leadingCell = (key: string) => {
    const layout = cellLayouts[key] ?? DEFAULT_CELL_LAYOUT;

    return (
      <td
        className="sticky z-1 bg-neutral-50 dark:bg-neutral-900"
        style={getCellStyle(null, layout, false)}
      >
        <EdgeShadow side={layout.shadow} />
      </td>
    );
  };

  return (
    <tfoot
      className="sticky bottom-0 z-2 bg-neutral-50 font-medium shadow-[0_-1px_3px_0_rgb(0_0_0/0.1)] dark:bg-neutral-900 dark:shadow-neutral-800"
      ref={ref}
    >
      <tr aria-rowindex={ariaRowIndex}>
        {hasSubRows && leadingCell("expand")}
        {hasSelection && leadingCell("selection")}
        {hasActions && leadingCell("actions")}
        {sortedVisibleColumns.map((column) => {
          const layout = cellLayouts[column.key] ?? DEFAULT_CELL_LAYOUT;
          const { summary } = column;
          // The aggregate says what the number is - a function says it itself
          const label = typeof summary === "string" ? labels[summary] : null;
          const value = formatSummaryValue(
            values[column.key],
            locale,
            summary === "avg",
          );
          const content = (value !== null || label) && (
            <>
              {label && (
                <span className="mr-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  {label}
                </span>
              )}
              {/* An average or extreme of no numbers */}
              {value ?? "–"}
            </>
          );

          return (
            <td
              className={cn(
                "px-2 tabular-nums",
                densityClass,
                isSticky(layout) &&
                  "sticky z-1 bg-neutral-50 dark:bg-neutral-900",
              )}
              key={column.key}
              style={getCellStyle(column, layout, false)}
            >
              <EdgeShadow side={layout.shadow} />
              {isClipped(column, layout) ? (
                <div className="overflow-hidden">{content}</div>
              ) : (
                content
              )}
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
}
