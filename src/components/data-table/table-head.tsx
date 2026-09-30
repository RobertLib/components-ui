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
import Popover from "../popover";
import { useEffect, useId } from "react";
import useIsMobile from "../../hooks/use-is-mobile";
import {
  DateRangeFilter,
  FilterInput,
  MultiSelectFilter,
  NumberRangeFilter,
} from "./filter-fields";
import {
  DEFAULT_CELL_LAYOUT,
  getCellStyle,
  isClipped,
  isSticky,
  LEADING_KEYS,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  type CellLayout,
} from "./cell-layout";
import { formatMessage } from "../../i18n/format";
import { useMessages } from "../../providers/ui-context";
import type {
  DataTableFilterValue,
  DataTableRangeFilter,
  DataTableSort,
} from "./query";
import type { Column, ColumnGroup, DataTableSelectionMode } from "./types";

/** The value of a filter as a list - `[]` for none or a range. */
const toList = (value: DataTableFilterValue | undefined) =>
  Array.isArray(value)
    ? value
    : typeof value === "string" && value
      ? [value]
      : [];

/** The value of a filter as a range - empty for none or a list. */
const toRange = (value: DataTableFilterValue | undefined) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value
    : ({} as DataTableRangeFilter);

/** A run of neighboring header cells of one group, sticking alike. */
interface GroupRun<T> {
  /** The columns of the run in the order they are shown. */
  columns: Column<T>[];
  /** The group - `null` for columns of none. */
  group: ColumnGroup<T> | null;
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
  /**
   * The groups of the columns by key - a row above the headers shows them.
   * `null` while no visible column is in one.
   */
  columnGroups: Readonly<Record<string, ColumnGroup<T>>> | null;
  /** The header cells of the columns by key - their widths are measured. */
  columnRefs: React.RefObject<Record<string, HTMLTableCellElement | null>>;
  /** The current widths of the columns by key, as far as they are known. */
  columnWidths: Record<string, number | undefined>;
  /** The header cell of the expand column - its width is measured. */
  expandColumnRef: React.RefObject<HTMLTableCellElement | null>;
  /** Column filters by column key - the values of the filter fields. */
  filters: Record<string, DataTableFilterValue>;
  /** Changes when the filters are cleared - the fields drop what is typed. */
  filterResetKey: number;
  /** The key of the group of each grouped column. */
  groupOf: Readonly<Record<string, string>>;
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
  /** Shift + click on a sort button adds its column to the sorting. */
  multiSort: boolean;
  /** Empties all filters. */
  onClearFilters: () => void;
  /** Shows the width of a column being dragged - `null` at the end. */
  onColumnDrag: (columnKey: string, width: number | null) => void;
  /** Saves the width of a resized column. */
  onColumnResize: (columnKey: string, width: number) => void;
  /** Brings back the width of a column's definition. */
  onColumnResizeReset: (columnKey: string) => void;
  /** Sets the filter of a column. */
  onFilterChange: (columnKey: string, value: DataTableFilterValue) => void;
  /** Toggles the sorting by a column - `multi` adds it to the sorting. */
  onSort: (columnKey: string, multi: boolean) => void;
  /** The `<thead>` - its height is measured. */
  ref?: React.Ref<HTMLTableSectionElement>;
  /** Expandable detail of a row - the header gets a column for its toggles. */
  renderSubRow?: (row: T) => React.ReactNode;
  /** The "select all" checkbox - it takes the focus of "Clear selection". */
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  /** The header cell of the selection column - its width is measured. */
  selectionColumnRef: React.RefObject<HTMLTableCellElement | null>;
  /** The checkbox column - `multiple` gets a select-all checkbox. */
  selectionMode: DataTableSelectionMode;
  /** The sorted columns - sortable ones, the first one first. */
  sort: DataTableSort[];
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
  columnGroups,
  columnRefs,
  columnWidths,
  expandColumnRef,
  filterResetKey,
  filters,
  groupOf,
  handleDragOver,
  handleDragStart,
  handleDrop,
  hasActiveFilters,
  isAllSelected,
  isSomeSelected,
  multiSort,
  onClearFilters,
  onColumnDrag,
  onColumnResize,
  onColumnResizeReset,
  onFilterChange,
  onSort,
  ref,
  renderSubRow,
  selectAllRef,
  selectionColumnRef,
  selectionMode,
  sort,
  sortedVisibleColumns,
  stickyTop,
  toggleSelectAll,
}: TableHeadProps<T>) {
  const messages = useMessages();
  const idPrefix = useId();

  // Touch devices have no hover, so the labelInfo popover opens on tap there.
  const isMobile = useIsMobile();

  const hasAnyFilters = sortedVisibleColumns.some((column) => column.filter);
  const hasSelection = selectionMode !== "none";

  const isMixed = isSomeSelected && !isAllSelected;

  // `indeterminate` exists only as a DOM property
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = isMixed;
  }, [isMixed, selectAllRef]);

  const layoutOf = (key: string) => cellLayouts[key] ?? DEFAULT_CELL_LAYOUT;

  // The side a column sticks to - a group is split where it changes
  const stickSide = (key: string) => {
    const layout = layoutOf(key);
    return layout.start !== undefined
      ? "start"
      : layout.end !== undefined
        ? "end"
        : null;
  };

  // The headers of the groups - one over each run of their columns
  const groupRuns: GroupRun<T>[] = [];
  if (columnGroups) {
    for (const column of sortedVisibleColumns) {
      const groupKey = groupOf[column.key];
      const group = groupKey === undefined ? null : columnGroups[groupKey];
      const last = groupRuns.at(-1);

      if (
        last &&
        last.group === group &&
        group !== null &&
        stickSide(last.columns[0].key) === stickSide(column.key)
      ) {
        last.columns.push(column);
      } else {
        groupRuns.push({ columns: [column], group: group ?? null });
      }
    }
  }

  // Sticky header cells are `z-2`, above the resize handles (`z-1`) of the
  // columns scrolled under them - which could be grabbed through them

  /** An empty sticky cell under a leading column in the other header rows. */
  const leadingCell = (key: string, className?: string) => (
    <td
      className={cn("sticky z-1 bg-surface dark:bg-surface-dark", className)}
      style={getCellStyle(null, layoutOf(key), false)}
    >
      <EdgeShadow side={layoutOf(key).shadow} />
    </td>
  );

  return (
    <thead
      className="sticky inset-s-0 z-2 bg-surface shadow dark:bg-surface-dark dark:shadow-neutral-800"
      ref={ref}
      style={{ top: stickyTop }}
    >
      {columnGroups && (
        <tr>
          {renderSubRow && leadingCell(LEADING_KEYS.expand)}
          {hasSelection && leadingCell(LEADING_KEYS.selection)}
          {actions && leadingCell(LEADING_KEYS.actions)}
          {groupRuns.map(({ columns, group }) => {
            const first = layoutOf(columns[0].key);
            const last = layoutOf(columns[columns.length - 1].key);
            // Sticks with its columns - from the edge its first (or last)
            // one sticks at
            const layout: CellLayout = {
              end: last.end,
              shadow:
                last.shadow === "start"
                  ? "start"
                  : first.shadow === "end"
                    ? "end"
                    : undefined,
              start: first.start,
            };
            const key = `${group?.key ?? ""}\u0000${columns[0].key}`;

            if (!group) {
              return (
                <td
                  className={cn(
                    isSticky(layout) &&
                      "sticky z-2 bg-surface dark:bg-surface-dark",
                  )}
                  key={key}
                  style={getCellStyle(null, layout, false)}
                >
                  <EdgeShadow side={layout.shadow} />
                </td>
              );
            }

            return (
              <th
                className={cn(
                  "border-b border-neutral-200 px-2 pt-1 text-center text-sm font-semibold dark:border-neutral-800",
                  isSticky(layout)
                    ? "sticky z-2 bg-surface dark:bg-surface-dark"
                    : "relative",
                )}
                colSpan={columns.length}
                key={key}
                scope="colgroup"
                style={getCellStyle(null, layout, false)}
                title={group.labelTitle}
              >
                <EdgeShadow side={layout.shadow} />
                {group.label}
              </th>
            );
          })}
        </tr>
      )}
      <tr>
        {renderSubRow && (
          <th
            className="sticky z-2 w-10 bg-surface dark:bg-surface-dark"
            data-leading-column="expand"
            ref={expandColumnRef}
            style={getCellStyle(null, layoutOf(LEADING_KEYS.expand), true)}
          >
            <EdgeShadow side={layoutOf(LEADING_KEYS.expand).shadow} />
            <span className="sr-only">{messages.dataTable.expandRow}</span>
          </th>
        )}
        {hasSelection && (
          <th
            className="sticky z-2 bg-surface px-2 py-1 text-start dark:bg-surface-dark"
            data-leading-column="selection"
            ref={selectionColumnRef}
            style={getCellStyle(null, layoutOf(LEADING_KEYS.selection), true)}
          >
            <EdgeShadow side={layoutOf(LEADING_KEYS.selection).shadow} />
            {selectionMode === "multiple" ? (
              <input
                aria-label={messages.dataTable.selectAllRows}
                checked={isAllSelected}
                className="accent-primary-500"
                onChange={toggleSelectAll}
                ref={selectAllRef}
                type="checkbox"
              />
            ) : (
              <span className="sr-only">{messages.dataTable.selectColumn}</span>
            )}
          </th>
        )}
        {actions && (
          <th
            className="sticky z-2 bg-surface px-2 py-1 text-start align-top text-sm font-medium dark:bg-surface-dark"
            data-leading-column="actions"
            ref={actionColumnRef}
            style={getCellStyle(null, layoutOf(LEADING_KEYS.actions), true)}
          >
            <div className="absolute -inset-e-px top-0 h-full border-e border-neutral-200 dark:border-neutral-800" />
            <EdgeShadow side={layoutOf(LEADING_KEYS.actions).shadow} />
            <span className="font-semibold">{messages.dataTable.actions}</span>
          </th>
        )}
        {sortedVisibleColumns.map((column, columnIndex) => {
          const layout = layoutOf(column.key);
          const isPinned = isSticky(layout);
          const clipped = isClipped(column, layout);
          const isSized = !!column.maxWidth || layout.width !== undefined;
          const columnName = column.labelTitle ?? column.label;
          // By the place of the column - a key may have spaces, which split
          // the ids of `aria-describedby`
          const infoId = `${idPrefix}-info-${columnIndex}`;
          const labelId = `${idPrefix}-label-${columnIndex}`;
          // Where the column is in the sorting - the first one is `0`
          const sortIndex = sort.findIndex((item) => item.key === column.key);
          const sorted = sortIndex === -1 ? null : sort[sortIndex];
          // The place of each column shows while several are sorted
          const showsPriority = sorted !== null && sort.length > 1;
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
          const sortTitle = formatMessage(messages.dataTable.sortBy, {
            label: columnName,
          });

          return (
            <th
              aria-describedby={column.labelInfo ? infoId : undefined}
              // Named by the label alone, not also by the resize handle in it
              aria-labelledby={labelId}
              // The direction of the first sorted column - one header at a
              // time has it; the others tell their place in their button
              aria-sort={
                !column.sortable
                  ? undefined
                  : sortIndex === 0 && sorted
                    ? sorted.order === "asc"
                      ? "ascending"
                      : "descending"
                    : sorted
                      ? undefined
                      : "none"
              }
              className={cn(
                "group/th px-2 py-1 text-start align-top text-sm font-medium",
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
                      "cui-link flex items-center gap-1 text-start",
                      isSized && "min-w-0",
                    )}
                    onClick={(event) => onSort(column.key, event.shiftKey)}
                    onKeyDown={(event) => {
                      // Shift + Enter adds the column like Shift + click -
                      // not every browser tells the click of a key its
                      // modifiers
                      if (
                        multiSort &&
                        event.shiftKey &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        if (!event.repeat) onSort(column.key, true);
                      }
                    }}
                    onKeyUp={(event) => {
                      // A Space would click the button once released
                      if (multiSort && event.shiftKey && event.key === " ") {
                        event.preventDefault();
                      }
                    }}
                    onMouseDown={(event) => {
                      // Shift + click would select the text up to here
                      if (multiSort && event.shiftKey) event.preventDefault();
                    }}
                    title={
                      multiSort
                        ? `${sortTitle} (${messages.dataTable.multiSortHint})`
                        : sortTitle
                    }
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
                    {sorted ? (
                      sorted.order === "asc" ? (
                        <ArrowUp size={16} className="shrink-0" />
                      ) : (
                        <ArrowDown size={16} className="shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown size={16} className="shrink-0" />
                    )}
                    {showsPriority && (
                      <>
                        <span
                          aria-hidden="true"
                          className="-ms-1 shrink-0 self-start text-[0.625rem] leading-none font-semibold tabular-nums"
                        >
                          {sortIndex + 1}
                        </span>{" "}
                        <span className="sr-only">
                          {formatMessage(messages.dataTable.sortPriority, {
                            count: String(sort.length),
                            order: messages.dataTable.sortOrder[sorted.order],
                            priority: String(sortIndex + 1),
                          })}
                        </span>
                      </>
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
                      className="shrink-0 rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
                      contentClassName="p-2 text-sm"
                      position="bottom"
                      // A tap opens it on a touch screen; with a mouse it
                      // opens on hover and, reached by Tab, on focus
                      tabIndex={isMobile ? undefined : 0}
                      trigger={
                        <Info
                          aria-label={column.labelInfo}
                          className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                          role="img"
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
                  // A column pinned to the end grows towards the start
                  edge={layout.end === undefined ? "end" : "start"}
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
          {renderSubRow && leadingCell(LEADING_KEYS.expand)}
          {hasSelection && leadingCell(LEADING_KEYS.selection)}
          {actions && (
            <td
              className="sticky z-1 bg-surface px-2 pb-1 align-top dark:bg-surface-dark"
              style={getCellStyle(null, layoutOf(LEADING_KEYS.actions), false)}
            >
              <div className="absolute -inset-e-px top-0 h-full border-e border-neutral-200 dark:border-neutral-800" />
              <EdgeShadow side={layoutOf(LEADING_KEYS.actions).shadow} />
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
            const columnName = column.labelTitle ?? column.label;
            const filterLabel = formatMessage(messages.dataTable.filterColumn, {
              label: columnName,
            });
            const filterPlaceholder = formatMessage(
              messages.dataTable.searchColumn,
              { label: column.label },
            );
            const rawValue = filters[column.key];
            // The value as a text - that of a text, a select or a date filter
            const filterValue = typeof rawValue === "string" ? rawValue : "";
            const changeFilter = (value: DataTableFilterValue) =>
              onFilterChange(column.key, value);

            const filterField = (
              <>
                {column.filter === "input" && (
                  <FilterInput
                    label={filterLabel}
                    onChange={changeFilter}
                    placeholder={filterPlaceholder}
                    resetKey={filterResetKey}
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
                      changeFilter(
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
                {column.filter === "multiSelect" && (
                  <MultiSelectFilter
                    label={filterLabel}
                    onChange={changeFilter}
                    options={column.filterSelectOptions ?? []}
                    placeholder={filterPlaceholder}
                    value={toList(rawValue)}
                  />
                )}
                {(column.filter === "date" ||
                  column.filter === "time" ||
                  column.filter === "datetime") && (
                  <DateTimePicker
                    aria-label={filterLabel}
                    dim="sm"
                    onChange={({ target }) => changeFilter(target.value)}
                    placeholder={filterPlaceholder}
                    type={
                      column.filter === "datetime"
                        ? "datetime-local"
                        : column.filter
                    }
                    value={filterValue}
                  />
                )}
                {column.filter === "numberRange" && (
                  <NumberRangeFilter
                    fromLabel={formatMessage(messages.dataTable.filterFrom, {
                      label: columnName,
                    })}
                    onChange={changeFilter}
                    resetKey={filterResetKey}
                    toLabel={formatMessage(messages.dataTable.filterTo, {
                      label: columnName,
                    })}
                    value={toRange(rawValue)}
                  />
                )}
                {column.filter === "dateRange" && (
                  <DateRangeFilter
                    label={filterLabel}
                    onChange={(range) => changeFilter(range ?? "")}
                    value={toRange(rawValue)}
                  />
                )}
                {column.filter === "custom" &&
                  column.customFilter?.(onFilterChange, filterValue, rawValue)}
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
