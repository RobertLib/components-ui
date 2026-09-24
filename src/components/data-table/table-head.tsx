import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GripVertical,
  Info,
} from "lucide-react";
import Autocomplete from "../autocomplete";
import ClearFiltersButton from "./clear-filters-button";
import cn from "../../utils/cn";
import ColumnResizeHandle from "./column-resize-handle";
import DateTimePicker from "../datetime-picker";
import EdgeShadow from "./edge-shadow";
import Input from "../input";
import Popover from "../popover";
import { useEffect, useId, useRef } from "react";
import useDebouncedField from "./use-debounced-field";
import useIsMobile from "../../hooks/use-is-mobile";
import {
  DEFAULT_CELL_LAYOUT,
  getCellStyle,
  isClipped,
  isSticky,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  type CellLayout,
} from "./cell-layout";
import { formatMessage } from "../../i18n/format";
import { useMessages } from "../../providers/ui-context";
import type { Column, GroupAction } from "./types";

interface FilterInputProps {
  /** Accessible name of the field. */
  label: string;
  /** Called with the typed text once typing pauses. */
  onChange: (value: string) => void;
  /** Placeholder of the empty field. */
  placeholder: string;
  /** The filter value of the query. */
  value: string;
}

/** A text filter that updates the query once typing pauses. */
function FilterInput({
  label,
  onChange,
  placeholder,
  value,
}: FilterInputProps) {
  const field = useDebouncedField(value, onChange);

  return (
    <Input
      aria-label={label}
      dim="sm"
      onChange={({ target }) => field.change(target.value)}
      placeholder={placeholder}
      type="search"
      value={field.value}
    />
  );
}

interface TableHeadProps<T> {
  /** The header cell of the actions column - its width is measured. */
  actionColumnRef: React.RefObject<HTMLTableCellElement | null>;
  /** Content of the actions cells - the header gets their column. */
  actions?: (row: T) => React.ReactNode;
  /** Whether the user can resize a column. */
  canResize: (column: Column<T>) => boolean;
  /** Layouts by column key - also of `expand`, `selection` and `actions`. */
  cellLayouts: Record<string, CellLayout>;
  /** The header cells of the columns by key - their widths are measured. */
  columnRefs: React.RefObject<Record<string, HTMLTableCellElement | null>>;
  /** The current widths of the columns by key, as far as they are known. */
  columnWidths: Record<string, number | undefined>;
  /** The header cell of the expand column - its width is measured. */
  expandColumnRef: React.RefObject<HTMLTableCellElement | null>;
  /** Column filters by column key - the values of the filter fields. */
  filters: Record<string, string>;
  /** Group actions - the header gets a select-all checkbox when there are some. */
  groupActions?: GroupAction<T>[];
  /** Lets a column header be a drop target. */
  handleDragOver: (event: React.DragEvent<HTMLElement>) => void;
  /** Starts dragging a column by its handle. */
  handleDragStart: (
    event: React.DragEvent<HTMLElement>,
    columnKey: string,
  ) => void;
  /** Moves the dragged column in front of the one it is dropped on. */
  handleDrop: (
    event: React.DragEvent<HTMLElement>,
    targetColumnKey: string,
  ) => void;
  /** Some filter has a value - the "Clear filters" button is enabled. */
  hasActiveFilters: boolean;
  /** Every row of the page is selected - the select-all checkbox is checked. */
  isAllSelected: boolean;
  /** Some rows are selected - the select-all checkbox is mixed then. */
  isSomeSelected: boolean;
  /** Empties all filters. */
  onClearFilters: () => void;
  /** Shows the width of a column being dragged - `null` at the end. */
  onColumnDrag: (columnKey: string, width: number | null) => void;
  /** Saves the width of a resized column. */
  onColumnResize: (columnKey: string, width: number) => void;
  /** Brings back the width of a column's definition. */
  onColumnResizeReset: (columnKey: string) => void;
  /** Sets the filter of a column. */
  onFilterChange: (columnKey: string, value: string) => void;
  /** Toggles the sorting by a column. */
  onSort: (columnKey: string) => void;
  /** Direction of `sortBy`. */
  order: string;
  /** The `<thead>` - its height is measured. */
  ref?: React.Ref<HTMLTableSectionElement>;
  /** Expandable detail of a row - the header gets a column for its toggles. */
  renderSubRow?: (row: T) => React.ReactNode;
  /** The header cell of the selection column - its width is measured. */
  selectionColumnRef: React.RefObject<HTMLTableCellElement | null>;
  /** Key of the sorted column. */
  sortBy: string | null;
  /** The visible columns in the order they are shown. */
  sortedVisibleColumns: Column<T>[];
  /** Height of the toolbar above - the header row sticks right under it. */
  stickyTop: number;
  /** Selects or deselects all rows of the page. */
  toggleSelectAll: () => void;
}

export function TableHead<T>({
  actionColumnRef,
  actions,
  canResize,
  cellLayouts,
  columnRefs,
  columnWidths,
  expandColumnRef,
  filters,
  groupActions,
  handleDragOver,
  handleDragStart,
  handleDrop,
  hasActiveFilters,
  isAllSelected,
  isSomeSelected,
  onClearFilters,
  onColumnDrag,
  onColumnResize,
  onColumnResizeReset,
  onFilterChange,
  onSort,
  order,
  ref,
  renderSubRow,
  selectionColumnRef,
  sortBy,
  sortedVisibleColumns,
  stickyTop,
  toggleSelectAll,
}: TableHeadProps<T>) {
  const messages = useMessages();
  const idPrefix = useId();

  // Touch devices have no hover, so the labelInfo popover opens on tap there.
  const isMobile = useIsMobile();

  const hasAnyFilters = sortedVisibleColumns.some((column) => column.filter);
  const hasGroupActions = !!groupActions && groupActions.length > 0;

  const selectAllRef = useRef<HTMLInputElement>(null);
  const isMixed = isSomeSelected && !isAllSelected;

  // `indeterminate` exists only as a DOM property
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = isMixed;
  }, [isMixed]);

  const layoutOf = (key: string) => cellLayouts[key] ?? DEFAULT_CELL_LAYOUT;

  // Sticky header cells are `z-2`, above the resize handles (`z-1`) of the
  // columns scrolled under them - which could be grabbed through them

  return (
    <thead
      className="sticky left-0 z-2 bg-surface shadow dark:bg-surface-dark dark:shadow-neutral-800"
      ref={ref}
      style={{ top: stickyTop }}
    >
      <tr>
        {renderSubRow && (
          <th
            className="sticky z-2 w-10 bg-surface dark:bg-surface-dark"
            data-column-key="expand"
            ref={expandColumnRef}
            style={getCellStyle(null, layoutOf("expand"), true)}
          >
            <EdgeShadow side={layoutOf("expand").shadow} />
            <span className="sr-only">{messages.dataTable.expandRow}</span>
          </th>
        )}
        {hasGroupActions && (
          <th
            className="sticky z-2 bg-surface px-2 py-1 text-left dark:bg-surface-dark"
            data-column-key="selection"
            ref={selectionColumnRef}
            style={getCellStyle(null, layoutOf("selection"), true)}
          >
            <EdgeShadow side={layoutOf("selection").shadow} />
            <input
              aria-label={messages.dataTable.selectAllRows}
              checked={isAllSelected}
              className="accent-primary-500"
              onChange={toggleSelectAll}
              ref={selectAllRef}
              type="checkbox"
            />
          </th>
        )}
        {actions && (
          <th
            className="sticky z-2 bg-surface px-2 py-1 text-left align-top text-sm font-medium dark:bg-surface-dark"
            data-column-key="actions"
            ref={actionColumnRef}
            style={getCellStyle(null, layoutOf("actions"), true)}
          >
            <div className="absolute top-0 -right-px h-full border-r border-neutral-200 dark:border-neutral-800" />
            <EdgeShadow side={layoutOf("actions").shadow} />
            <span className="font-semibold">{messages.dataTable.actions}</span>
          </th>
        )}
        {sortedVisibleColumns.map((column, columnIndex) => {
          const layout = layoutOf(column.key);
          const isPinned = isSticky(layout);
          const clipped = isClipped(column, layout);
          const isSized = !!column.maxWidth || layout.width !== undefined;
          const columnName = column.labelTitle ?? column.label;
          const infoId = `${idPrefix}-info-${column.key}`;
          const labelId = `${idPrefix}-label-${columnIndex}`;
          // The narrowest the user may make the column - not narrower than
          // its own `width`, though
          const minWidth =
            column.minWidth ??
            Math.min(MIN_COLUMN_WIDTH, column.width ?? MIN_COLUMN_WIDTH);
          // The widest - also as far as a pinned column still sticks
          const maxWidth =
            layout.maxResizeWidth === undefined
              ? column.maxWidth
              : Math.min(
                  column.maxWidth ?? MAX_COLUMN_WIDTH,
                  layout.maxResizeWidth,
                );

          return (
            <th
              aria-describedby={column.labelInfo ? infoId : undefined}
              // Named by the label alone, not also by the resize handle in it
              aria-labelledby={labelId}
              aria-sort={
                sortBy === column.key
                  ? order === "asc"
                    ? "ascending"
                    : "descending"
                  : column.sortable
                    ? "none"
                    : undefined
              }
              className={cn(
                "group/th px-2 py-1 text-left align-top text-sm font-medium",
                isPinned
                  ? "sticky z-2 bg-surface dark:bg-surface-dark"
                  : "relative",
              )}
              data-column-key={column.key}
              key={column.key}
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, column.key)}
              ref={(el) => {
                columnRefs.current[column.key] = el;
              }}
              style={getCellStyle(column, layout, true)}
            >
              <EdgeShadow side={layout.shadow} />
              {/* The name of the header is its label alone - the drag
                  handle is for the mouse (the column settings move columns
                  from the keyboard), the info is its description and the
                  resize handle a separator of its own */}
              <div
                className={cn(
                  "flex items-center gap-1",
                  isSized && "max-w-full min-w-0",
                  clipped && "overflow-hidden",
                )}
              >
                <span
                  aria-hidden="true"
                  className="shrink-0 cursor-grab opacity-50 hover:opacity-100"
                  draggable
                  onDragStart={(event) => {
                    handleDragStart(event, column.key);
                    event.dataTransfer.setDragImage(
                      event.currentTarget.closest("th") as Element,
                      0,
                      0,
                    );
                  }}
                  title={messages.dataTable.dragColumn}
                >
                  <GripVertical size={16} />
                </span>
                {column.sortable ? (
                  // The sort state is the `aria-sort` of the header
                  <button
                    className={cn(
                      "link flex items-center gap-1 text-left",
                      isSized && "min-w-0",
                    )}
                    onClick={() => onSort(column.key)}
                    title={formatMessage(messages.dataTable.sortBy, {
                      label: columnName,
                    })}
                    type="button"
                  >
                    <span
                      className={cn(
                        "truncate font-semibold",
                        isSized && "min-w-0",
                      )}
                      id={labelId}
                    >
                      {column.label}
                    </span>
                    {sortBy === column.key ? (
                      order === "asc" ? (
                        <ArrowUp size={16} className="shrink-0" />
                      ) : (
                        <ArrowDown size={16} className="shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown size={16} className="shrink-0" />
                    )}
                  </button>
                ) : (
                  <span
                    className={cn(
                      "truncate font-semibold",
                      isSized && "block min-w-0",
                    )}
                    id={labelId}
                    title={columnName}
                  >
                    {column.label}
                  </span>
                )}
                {column.labelInfo && (
                  <>
                    <span hidden id={infoId}>
                      {column.labelInfo}
                    </span>
                    <Popover
                      // A hover popover is for the mouse - a tap one is a
                      // button, which needs its name
                      aria-hidden={isMobile ? undefined : true}
                      className="shrink-0"
                      contentClassName="p-2 text-sm"
                      position="bottom"
                      trigger={
                        <Info
                          aria-label={isMobile ? column.labelInfo : undefined}
                          className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                          role={isMobile ? "img" : undefined}
                          size={14}
                        />
                      }
                      triggerType={isMobile ? "click" : "hover"}
                      width="260px"
                    >
                      {column.labelInfo}
                    </Popover>
                  </>
                )}
              </div>
              {canResize(column) && (
                <ColumnResizeHandle
                  columnName={columnName}
                  // A column pinned to the right grows to the left
                  edge={layout.right === undefined ? "right" : "left"}
                  maxWidth={maxWidth}
                  minWidth={minWidth}
                  onDrag={(width) => onColumnDrag(column.key, width)}
                  onResize={(width) => onColumnResize(column.key, width)}
                  onReset={() => onColumnResizeReset(column.key)}
                  width={columnWidths[column.key]}
                />
              )}
            </th>
          );
        })}
      </tr>
      {/* The filters have a row of their own, so they are no part of the
          names of the column headers */}
      {hasAnyFilters && (
        <tr>
          {renderSubRow && (
            <td
              className="sticky z-1 bg-surface dark:bg-surface-dark"
              style={getCellStyle(null, layoutOf("expand"), false)}
            >
              <EdgeShadow side={layoutOf("expand").shadow} />
            </td>
          )}
          {hasGroupActions && (
            <td
              className="sticky z-1 bg-surface dark:bg-surface-dark"
              style={getCellStyle(null, layoutOf("selection"), false)}
            >
              <EdgeShadow side={layoutOf("selection").shadow} />
            </td>
          )}
          {actions && (
            <td
              className="sticky z-1 bg-surface px-2 pb-1 align-top dark:bg-surface-dark"
              style={getCellStyle(null, layoutOf("actions"), false)}
            >
              <div className="absolute top-0 -right-px h-full border-r border-neutral-200 dark:border-neutral-800" />
              <EdgeShadow side={layoutOf("actions").shadow} />
              <div className="flex justify-end">
                <ClearFiltersButton
                  hasActiveFilters={hasActiveFilters}
                  inFilterRow
                  onClear={onClearFilters}
                />
              </div>
            </td>
          )}
          {sortedVisibleColumns.map((column) => {
            const layout = layoutOf(column.key);
            const filterLabel = formatMessage(messages.dataTable.filterColumn, {
              label: column.labelTitle ?? column.label,
            });
            const filterPlaceholder = formatMessage(
              messages.dataTable.searchColumn,
              { label: column.label },
            );
            const filterValue = filters[column.key] || "";

            const filterField = (
              <>
                {column.filter === "input" && (
                  <FilterInput
                    label={filterLabel}
                    onChange={(value) => onFilterChange(column.key, value)}
                    placeholder={filterPlaceholder}
                    value={filterValue}
                  />
                )}
                {column.filter === "select" && (
                  <Autocomplete
                    aria-label={filterLabel}
                    asSelect
                    // As high as the other filter fields (22px) - its field
                    // is the element around the combobox
                    className="[&_:has(>[role=combobox])]:px-1 [&_:has(>[role=combobox])]:py-0"
                    hasEmpty
                    onChange={(value) => {
                      onFilterChange(
                        column.key,
                        value === null || Array.isArray(value)
                          ? ""
                          : String(value),
                      );
                    }}
                    options={column.filterSelectOptions ?? []}
                    placeholder={filterPlaceholder}
                    value={filterValue}
                  />
                )}
                {(column.filter === "date" ||
                  column.filter === "time" ||
                  column.filter === "datetime") && (
                  <DateTimePicker
                    aria-label={filterLabel}
                    dim="sm"
                    onChange={({ target }) =>
                      onFilterChange(column.key, target.value)
                    }
                    placeholder={filterPlaceholder}
                    type={
                      column.filter === "datetime"
                        ? "datetime-local"
                        : column.filter
                    }
                    value={filterValue}
                  />
                )}
                {column.filter === "custom" &&
                  column.customFilter?.(onFilterChange, filterValue)}
              </>
            );

            return (
              <td
                className={cn(
                  "px-2 pb-1 align-top text-sm font-medium",
                  isSticky(layout) &&
                    "sticky z-1 bg-surface dark:bg-surface-dark",
                )}
                key={column.key}
                style={getCellStyle(column, layout, false)}
              >
                <EdgeShadow side={layout.shadow} />
                {column.maxWidth && !column.disableOverflow ? (
                  <div className="overflow-hidden">{filterField}</div>
                ) : (
                  filterField
                )}
              </td>
            );
          })}
        </tr>
      )}
    </thead>
  );
}
