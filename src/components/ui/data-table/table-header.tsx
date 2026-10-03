import {
  Check,
  Columns3,
  Download,
  GripVertical,
  Maximize,
  Minimize,
  PanelLeft,
  PanelRight,
  Rows3,
  Search,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import ClearFiltersButton from "./clear-filters-button";
import cn from "../../../utils/cn";
import IconButton from "../icon-button";
import Popover from "../popover";
import Switch from "../switch";
import { formatMessage } from "../../../i18n/ui/format";
import { attachRef } from "../../../hooks/use-form-control";
import { isEscapeKey } from "../overlay-stack";
import { useMessages } from "../../../providers/ui-context";
import type { Column, ColumnGroup, DataTableDensity } from "./types";
import useDebouncedField from "./use-debounced-field";

const DENSITIES: DataTableDensity[] = ["compact", "normal", "comfortable"];

const PIN_BUTTON_CLASSES =
  "me-2 cursor-pointer rounded opacity-50 hover:opacity-100 focus:outline-hidden focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500";
// Pressed, the pin is in full color - a system color in forced colors mode,
// which would draw it as the others
const PIN_BUTTON_PRESSED_CLASSES =
  "text-primary-500 opacity-100 forced-colors:text-[Highlight]";

interface TableHeaderProps<T> {
  /** The groups of the columns by key - the settings list them. */
  columnGroups: Readonly<Record<string, ColumnGroup<T>>>;
  /** Keys of all columns in the order the user arranged them. */
  columnOrder: string[];
  /** All columns of the table, also the hidden ones. */
  columns: Column<T>[];
  /** Whether each column is shown, by column key. */
  columnVisibility: Record<string, boolean>;
  /** Opens the search field right away. */
  defaultSearchOpen?: boolean;
  /** Height of the rows - the density control shows it. */
  density: DataTableDensity;
  /** Shows the row density control. */
  densityControl: boolean;
  /** Shows the global search field and its toggle. */
  enableGlobalSearch?: boolean;
  /** The key of the group of each grouped column. */
  groupOf: Readonly<Record<string, string>>;
  /** Lets a row of the column settings be a drop target. */
  handleDragOver: (event: React.DragEvent<HTMLElement>) => void;
  /** Starts dragging a column by its handle in the column settings. */
  handleDragStart: (
    event: React.DragEvent<HTMLElement>,
    columnKey: string,
  ) => void;
  /** Moves the dragged column in front of the one it is dropped on. */
  handleDrop: (event: React.DragEvent<HTMLElement>, columnKey: string) => void;
  /** Pins a column to an edge, or unpins it. */
  handlePinColumn: (columnKey: string, position: "left" | "right") => void;
  /** Some filter has a value - the "Clear filters" button is enabled. */
  hasActiveFilters: boolean;
  /** The columns differ from their definitions - "Reset columns" is enabled. */
  hasCustomSettings: boolean;
  /** A CSV export is running - its button shows a spinner. */
  isExporting: boolean;
  /** The table covers the page - the toggle shows "exit full screen". */
  isFullScreen: boolean;
  /** Moves a column one place up or down in the order (the arrow keys). */
  onMoveColumn: (columnKey: string, offset: -1 | 1) => void;
  /** Empties all filters. */
  onClearFilters: () => void;
  /** Sets the row density. */
  onDensityChange: (density: DataTableDensity) => void;
  /** Exports the rows as CSV - the export button shows with it. */
  onExport?: () => void;
  /** Brings back the columns' default order, visibility, pinning and widths. */
  onResetSettings: () => void;
  /** Called with the typed search once typing pauses. */
  onSearchChange: (search: string) => void;
  /** Keys of the columns pinned to the left and right edge. */
  pinnedColumns: { left: string[]; right: string[] };
  /** The header element - its height is measured. */
  ref?: React.Ref<HTMLElement>;
  /** The search term of the query. */
  search: string;
  /** Shows or hides columns. */
  setColumnVisibility: (
    visibility:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  /** Enters or leaves full screen. */
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * The toolbar shows the "Clear filters" button - the table has filters but
   * no actions column, whose header holds it otherwise, or the filters are
   * of hidden columns only.
   */
  showClearFilters: boolean;
  /** Content left of the table controls. */
  toolbar: React.ReactNode;
}

export function TableHeader<T>({
  columnGroups,
  columnOrder,
  columns,
  columnVisibility,
  defaultSearchOpen = false,
  density,
  densityControl,
  enableGlobalSearch = false,
  groupOf,
  handleDragOver,
  handleDragStart,
  handleDrop,
  handlePinColumn,
  hasActiveFilters,
  hasCustomSettings,
  isExporting,
  isFullScreen,
  onClearFilters,
  onDensityChange,
  onExport,
  onMoveColumn,
  onResetSettings,
  onSearchChange,
  pinnedColumns,
  ref,
  search,
  setColumnVisibility,
  setIsFullScreen,
  showClearFilters,
  toolbar,
}: TableHeaderProps<T>) {
  const messages = useMessages().ui;

  const [isSearchOpen, setIsSearchOpen] = useState(
    defaultSearchOpen || Boolean(search),
  );

  // A search that comes from outside (the URL, the back button) shows its field
  const [previousSearch, setPreviousSearch] = useState(search);

  if (search !== previousSearch) {
    setPreviousSearch(search);
    if (search && !isSearchOpen) setIsSearchOpen(true);
  }

  // The field shows what is typed right away; the query follows debounced
  const searchField = useDebouncedField(search, onSearchChange);

  const [isDensityOpen, setIsDensityOpen] = useState(false);
  // "Reset columns" with the focus - once pressed there is nothing to reset,
  // but a disabled button would drop the focus and close the panel
  const [isResetFocused, setIsResetFocused] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const shouldFocusRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  // The table is laid out right to left - its start, where `left` pins a
  // column, is on the right, and the pin buttons are named after that side.
  // Read as the column settings open.
  const [isRtl, setIsRtl] = useState(false);
  const startPin = isRtl
    ? { Icon: PanelRight, label: messages.dataTable.pinRight }
    : { Icon: PanelLeft, label: messages.dataTable.pinLeft };
  const endPin = isRtl
    ? { Icon: PanelLeft, label: messages.dataTable.pinLeft }
    : { Icon: PanelRight, label: messages.dataTable.pinRight };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      shouldFocusRef.current = true;
    }
    if (isSearchOpen && searchField.value) {
      searchField.commitNow("");
    }
  };

  // Focus search input when it opens via user click
  useEffect(() => {
    if (isSearchOpen && shouldFocusRef.current && searchInputRef.current) {
      // Small delay to ensure the input is visible after animation
      const timeout = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      shouldFocusRef.current = false;
      return () => clearTimeout(timeout);
    }
  }, [isSearchOpen]);

  // The arrow keys on a handle move its column - the row moves in the DOM,
  // so its handle gets the focus back
  const handleMoveKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    columnKey: string,
  ) => {
    const offset =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!offset) return;

    event.preventDefault();
    onMoveColumn(columnKey, offset);
    // Found by comparing the keys - a key with a quote or a backslash would
    // break a selector
    requestAnimationFrame(() =>
      Array.from(
        settingsRef.current?.querySelectorAll<HTMLElement>(
          "[data-column-handle]",
        ) ?? [],
      )
        .find((handle) => handle.dataset.columnHandle === columnKey)
        ?.focus(),
    );
  };

  const orderedColumns = [...columns].sort(
    (a, b) => columnOrder.indexOf(a.key) - columnOrder.indexOf(b.key),
  );

  return (
    <header
      className="sticky inset-s-0 top-0 z-3 flex min-h-10 flex-wrap items-start justify-between gap-2 bg-surface p-2 pb-0 dark:bg-surface-dark"
      ref={(element) => {
        headerRef.current = element;
        const detachRef = attachRef(ref, element);
        return () => {
          headerRef.current = null;
          detachRef();
        };
      }}
    >
      <div className="min-w-0 flex-1">{toolbar}</div>
      <div className="flex shrink-0 items-center gap-2">
        {enableGlobalSearch && (
          <div className="flex items-center">
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none",
                isSearchOpen
                  ? "me-2 w-[calc(100vw-80px)] opacity-100 sm:w-64"
                  : "w-0 opacity-0",
              )}
              // Closed, the field is out of reach of Tab, clicks and screen
              // readers - it only has no width
              inert={!isSearchOpen}
            >
              <input
                aria-label={messages.dataTable.search}
                className="h-6.5 w-full rounded-md border border-neutral-200 bg-surface px-3 py-1.5 text-sm text-neutral-900 placeholder-neutral-500 focus:border-primary-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-400"
                onChange={({ target }) => searchField.change(target.value)}
                onKeyDown={(e) => {
                  // Not an Escape ending a composition - also Safari's,
                  // which comes after it
                  if (isEscapeKey(e.nativeEvent)) {
                    // Closes the search only, not a dialog around the table
                    e.preventDefault();
                    toggleSearch();
                    // The focus would stay in the closed field, unseen
                    searchToggleRef.current?.focus();
                  }
                }}
                placeholder={messages.dataTable.search}
                ref={searchInputRef}
                type="text"
                value={searchField.value}
              />
            </div>

            <IconButton
              aria-expanded={isSearchOpen}
              aria-label={
                isSearchOpen
                  ? messages.dataTable.closeSearch
                  : messages.dataTable.openSearch
              }
              className={cn(
                "transition-colors duration-200",
                isSearchOpen && "text-primary-600 dark:text-primary-400",
              )}
              onClick={toggleSearch}
              ref={searchToggleRef}
            >
              <Search size={18} />
            </IconButton>
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-2 transition-all duration-300 motion-reduce:transition-none",
            isSearchOpen && "hidden sm:flex",
          )}
        >
          {showClearFilters && (
            <ClearFiltersButton
              hasActiveFilters={hasActiveFilters}
              onClear={onClearFilters}
            />
          )}

          {onExport && (
            // An IconButton, but not disabled while the export runs - a
            // disabled button would drop the focus
            <button
              aria-busy={isExporting || undefined}
              aria-disabled={isExporting || undefined}
              aria-label={messages.dataTable.exportCsv}
              className={cn(
                "-m-1 rounded-md p-1 leading-none transition-colors hover:bg-neutral-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800",
                isExporting ? "cursor-progress" : "cursor-pointer",
              )}
              onClick={isExporting ? undefined : onExport}
              type="button"
            >
              {isExporting ? (
                <svg
                  aria-hidden="true"
                  className="h-4.5 w-4.5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <Download aria-hidden="true" size={18} />
              )}
            </button>
          )}

          {densityControl && (
            <Popover
              align="end"
              buttonTrigger
              // Around the button, laid out as the other buttons - a block
              // would put it on the baseline of a line, 3px higher
              className="flex"
              contentClassName="mt-2.5 p-1"
              contentLabel={messages.dataTable.density.label}
              onOpenChange={setIsDensityOpen}
              open={isDensityOpen}
              position="bottom"
              trigger={
                <IconButton aria-label={messages.dataTable.density.label}>
                  <Rows3 aria-hidden="true" size={18} />
                </IconButton>
              }
              triggerType="click"
              width="auto"
            >
              {/* Toggle buttons, one tab stop each - the panel moves Tab
                  through its controls, which a radio group would leave */}
              <div
                aria-label={messages.dataTable.density.label}
                className="flex min-w-36 flex-col gap-0.5"
                role="group"
              >
                {DENSITIES.map((value) => (
                  <button
                    aria-pressed={density === value}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-start text-sm transition-colors hover:bg-neutral-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 aria-pressed:font-medium motion-reduce:transition-none dark:hover:bg-neutral-800"
                    key={value}
                    onClick={() => {
                      onDensityChange(value);
                      setIsDensityOpen(false);
                    }}
                    type="button"
                  >
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "shrink-0 text-primary-500",
                        density !== value && "invisible",
                      )}
                      size={14}
                    />
                    {messages.dataTable.density[value]}
                  </button>
                ))}
              </div>
            </Popover>
          )}

          {/* A panel of controls, not a menu - Tab moves through it */}
          <Popover
            align="end"
            aria-label={messages.dataTable.columns}
            contentClassName="mt-2.5 p-1"
            onOpenChange={(open) => {
              const header = headerRef.current;
              if (open && header) {
                setIsRtl(getComputedStyle(header).direction === "rtl");
              }
            }}
            position="bottom"
            trigger={
              <div className="rounded-md p-1 leading-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <Columns3 aria-hidden="true" size={18} />
              </div>
            }
            triggerType="click"
            width="auto"
          >
            <div className="min-w-48" ref={settingsRef}>
              <div className="m-1 border-b border-neutral-200 pb-1 dark:border-neutral-800">
                <button
                  aria-disabled={!hasCustomSettings || undefined}
                  className="w-full cursor-pointer rounded p-1.5 text-start text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  disabled={!hasCustomSettings && !isResetFocused}
                  onBlur={() => setIsResetFocused(false)}
                  onClick={hasCustomSettings ? onResetSettings : undefined}
                  onFocus={() => setIsResetFocused(true)}
                  type="button"
                >
                  {messages.dataTable.resetColumns}
                </button>
              </div>
              {orderedColumns.map((column, index) => {
                const columnName = column.labelTitle ?? column.label;
                const groupKey = groupOf[column.key];
                // The first column of a group comes under its name - its
                // columns move within it
                const groupName =
                  groupKey !== undefined &&
                  groupOf[orderedColumns[index - 1]?.key] !== groupKey
                    ? (columnGroups[groupKey]?.labelTitle ??
                      columnGroups[groupKey]?.label)
                    : undefined;

                return (
                  <Fragment key={column.key}>
                    {groupName && (
                      <div className="mx-1 mt-2 px-1 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                        {groupName}
                      </div>
                    )}
                    <div
                      className={cn(
                        "m-1 flex items-center p-1",
                        groupKey !== undefined && "ms-3",
                      )}
                      onDragOver={handleDragOver}
                      onDrop={(event) => handleDrop(event, column.key)}
                    >
                      <button
                        aria-label={formatMessage(
                          messages.dataTable.moveColumn,
                          {
                            label: columnName,
                          },
                        )}
                        className="me-2 cursor-grab rounded opacity-50 hover:opacity-100 focus:outline-hidden focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500"
                        data-column-handle={column.key}
                        draggable
                        onDragStart={(event) => {
                          handleDragStart(event, column.key);
                          event.dataTransfer.setDragImage(
                            event.currentTarget.closest("div") as Element,
                            0,
                            0,
                          );
                        }}
                        onKeyDown={(event) =>
                          handleMoveKeyDown(event, column.key)
                        }
                        type="button"
                      >
                        <GripVertical aria-hidden="true" size={16} />
                      </button>
                      {/* `left` pins to the start, `right` to the end */}
                      <button
                        aria-label={formatMessage(startPin.label, {
                          label: columnName,
                        })}
                        aria-pressed={pinnedColumns.left.includes(column.key)}
                        className={cn(
                          PIN_BUTTON_CLASSES,
                          pinnedColumns.left.includes(column.key) &&
                            PIN_BUTTON_PRESSED_CLASSES,
                        )}
                        onClick={() => handlePinColumn(column.key, "left")}
                        type="button"
                      >
                        <startPin.Icon aria-hidden="true" size={16} />
                      </button>
                      <button
                        aria-label={formatMessage(endPin.label, {
                          label: columnName,
                        })}
                        aria-pressed={pinnedColumns.right.includes(column.key)}
                        className={cn(
                          PIN_BUTTON_CLASSES,
                          pinnedColumns.right.includes(column.key) &&
                            PIN_BUTTON_PRESSED_CLASSES,
                        )}
                        onClick={() => handlePinColumn(column.key, "right")}
                        type="button"
                      >
                        <endPin.Icon aria-hidden="true" size={16} />
                      </button>
                      <Switch
                        aria-label={columnName}
                        checked={columnVisibility[column.key] ?? true}
                        className="ms-1"
                        onChange={({ target }) =>
                          setColumnVisibility((prev) => ({
                            ...prev,
                            [column.key]: target.checked,
                          }))
                        }
                      />
                      <span className="ms-3 text-sm font-medium whitespace-nowrap">
                        {columnName}
                      </span>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </Popover>

          <IconButton
            aria-label={messages.dataTable.toggleFullScreen}
            aria-pressed={isFullScreen}
            onClick={() => setIsFullScreen((prev) => !prev)}
          >
            {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </IconButton>
        </div>
      </div>
    </header>
  );
}
