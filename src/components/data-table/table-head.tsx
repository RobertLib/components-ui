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
import DateTimePicker from "../datetime-picker";
import Input from "../input";
import Popover from "../popover";
import { useEffect, useId, useRef } from "react";
import useDebouncedField from "./use-debounced-field";
import useIsMobile from "../../hooks/use-is-mobile";
import { formatMessage } from "../../i18n/format";
import { useMessages } from "../../providers/ui-context";
import type { Column, GroupAction } from "./types";

interface FilterInputProps {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
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
  actionColumnRef: React.RefObject<HTMLTableCellElement | null>;
  actions?: (row: T) => React.ReactNode;
  calculatePosition: (columnKey: string, position: "left" | "right") => string;
  columnRefs: React.RefObject<Record<string, HTMLTableCellElement | null>>;
  filters: Record<string, string>;
  groupActions?: GroupAction<T>[];
  handleDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handleDragStart: (
    event: React.DragEvent<HTMLElement>,
    columnKey: string,
  ) => void;
  handleDrop: (
    event: React.DragEvent<HTMLElement>,
    targetColumnKey: string,
  ) => void;
  isAllSelected: boolean;
  /** Some rows are selected - the select-all checkbox is mixed then. */
  isSomeSelected: boolean;
  onClearFilters: () => void;
  onFilterChange: (columnKey: string, value: string) => void;
  onSort: (columnKey: string) => void;
  order: string;
  pinnedColumns: { left: string[]; right: string[] };
  renderSubRow?: (row: T) => React.ReactNode;
  selectionColumnRef: React.RefObject<HTMLTableCellElement | null>;
  sortBy: string | null;
  sortedVisibleColumns: Column<T>[];
  /** Height of the toolbar above - the header row sticks right under it. */
  stickyTop: number;
  toggleSelectAll: () => void;
}

export function TableHead<T>({
  actionColumnRef,
  actions,
  calculatePosition,
  columnRefs,
  filters,
  groupActions,
  handleDragOver,
  handleDragStart,
  handleDrop,
  isAllSelected,
  isSomeSelected,
  onClearFilters,
  onFilterChange,
  onSort,
  order,
  pinnedColumns,
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
  const hasActiveFilters = Object.keys(filters).length > 0;
  const hasGroupActions = !!groupActions && groupActions.length > 0;

  const selectAllRef = useRef<HTMLInputElement>(null);
  const isMixed = isSomeSelected && !isAllSelected;

  // `indeterminate` exists only as a DOM property
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = isMixed;
  }, [isMixed]);

  const getColumnPlacement = (column: Column<T>) => {
    const isPinnedLeft = pinnedColumns.left.includes(column.key);
    const isPinnedRight = pinnedColumns.right.includes(column.key);

    const style: React.CSSProperties = {
      left: isPinnedLeft ? calculatePosition(column.key, "left") : "auto",
      right: isPinnedRight ? calculatePosition(column.key, "right") : "auto",
    };

    if (column.minWidth !== undefined) {
      style.minWidth = `${column.minWidth}px`;
    }
    if (column.maxWidth !== undefined) {
      style.maxWidth = `${column.maxWidth}px`;
    }

    return { isPinned: isPinnedLeft || isPinnedRight, style };
  };

  return (
    <thead
      className="sticky left-0 z-2 bg-surface shadow dark:bg-surface-dark dark:shadow-neutral-800"
      style={{ top: stickyTop }}
    >
      <tr>
        {renderSubRow && (
          <th className="w-10">
            <span className="sr-only">{messages.dataTable.expandRow}</span>
          </th>
        )}
        {hasGroupActions && (
          <th
            className="sticky left-0 bg-surface px-2 py-1 text-left dark:bg-surface-dark"
            data-column-key="selection"
            ref={selectionColumnRef}
          >
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
            className="sticky z-1 bg-surface px-2 py-1 text-left align-top text-sm font-medium dark:bg-surface-dark"
            data-column-key="actions"
            ref={actionColumnRef}
            style={{ left: calculatePosition("actions", "left") }}
          >
            <div className="absolute top-0 -right-px h-full border-r border-neutral-200 dark:border-neutral-800" />
            <span className="font-semibold">{messages.dataTable.actions}</span>
          </th>
        )}
        {sortedVisibleColumns.map((column) => {
          const { isPinned, style } = getColumnPlacement(column);
          const columnName = column.labelTitle ?? column.label;
          const infoId = `${idPrefix}-info-${column.key}`;

          return (
            <th
              aria-describedby={column.labelInfo ? infoId : undefined}
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
                "px-2 py-1 text-left align-top text-sm font-medium",
                isPinned &&
                  "sticky z-1 bg-surface shadow dark:bg-surface-dark dark:shadow-neutral-800",
                column.maxWidth && !column.disableOverflow && "overflow-hidden",
              )}
              data-column-key={column.key}
              key={column.key}
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, column.key)}
              ref={(el) => {
                columnRefs.current[column.key] = el;
              }}
              style={style}
            >
              {/* The name of the header is its label alone - the drag
                  handle is for the mouse (the column settings move columns
                  from the keyboard) and the info is its description */}
              <div
                className={cn(
                  "flex items-center gap-1",
                  column.maxWidth && "max-w-full min-w-0",
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
                      "link flex items-center gap-1",
                      column.maxWidth && "min-w-0 flex-1",
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
                        column.maxWidth && "min-w-0 flex-1",
                      )}
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
                      column.maxWidth && "block min-w-0",
                    )}
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
                          className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
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
            </th>
          );
        })}
      </tr>
      {/* The filters have a row of their own, so they are no part of the
          names of the column headers */}
      {hasAnyFilters && (
        <tr>
          {renderSubRow && <td />}
          {hasGroupActions && (
            <td className="sticky left-0 bg-surface dark:bg-surface-dark" />
          )}
          {actions && (
            <td
              className="sticky z-1 bg-surface px-2 pb-1 align-top dark:bg-surface-dark"
              style={{ left: calculatePosition("actions", "left") }}
            >
              <div className="absolute top-0 -right-px h-full border-r border-neutral-200 dark:border-neutral-800" />
              <div className="flex justify-end">
                <ClearFiltersButton
                  hasActiveFilters={hasActiveFilters}
                  onClear={onClearFilters}
                />
              </div>
            </td>
          )}
          {sortedVisibleColumns.map((column) => {
            const { isPinned, style } = getColumnPlacement(column);
            const filterLabel = formatMessage(messages.dataTable.filterColumn, {
              label: column.labelTitle ?? column.label,
            });
            const filterPlaceholder = formatMessage(
              messages.dataTable.searchColumn,
              { label: column.label },
            );
            const filterValue = filters[column.key] || "";

            return (
              <td
                className={cn(
                  "px-2 pb-1 align-top text-sm font-medium",
                  isPinned &&
                    "sticky z-1 bg-surface shadow dark:bg-surface-dark dark:shadow-neutral-800",
                  column.maxWidth &&
                    !column.disableOverflow &&
                    "overflow-hidden",
                )}
                key={column.key}
                style={style}
              >
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
              </td>
            );
          })}
        </tr>
      )}
    </thead>
  );
}
