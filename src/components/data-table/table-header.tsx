import {
  Columns3,
  GripVertical,
  Maximize,
  Minimize,
  PanelLeft,
  PanelRight,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ClearFiltersButton from "./clear-filters-button";
import cn from "../../utils/cn";
import IconButton from "../icon-button";
import Popover from "../popover";
import Switch from "../switch";
import { formatMessage } from "../../i18n/format";
import { useMessages } from "../../providers/ui-context";
import type { Column } from "./types";
import useDebouncedField from "./use-debounced-field";

interface TableHeaderProps<T> {
  columnOrder: string[];
  columns: Column<T>[];
  columnVisibility: Record<string, boolean>;
  defaultSearchOpen?: boolean;
  enableGlobalSearch?: boolean;
  handleDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handleDragStart: (
    event: React.DragEvent<HTMLElement>,
    columnKey: string,
  ) => void;
  handleDrop: (event: React.DragEvent<HTMLElement>, columnKey: string) => void;
  handlePinColumn: (columnKey: string, position: "left" | "right") => void;
  /** Some column filter has a value. */
  hasActiveFilters: boolean;
  isFullScreen: boolean;
  /** Moves a column one place up or down in the order (the arrow keys). */
  onMoveColumn: (columnKey: string, offset: -1 | 1) => void;
  onClearFilters: () => void;
  onResetSettings: () => void;
  onSearchChange: (search: string) => void;
  pinnedColumns: { left: string[]; right: string[] };
  ref?: React.Ref<HTMLElement>;
  search: string;
  setColumnVisibility: (
    visibility:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * The table has filters but no actions column, whose header holds the
   * "Clear filters" button - the toolbar shows it instead.
   */
  showClearFilters: boolean;
  toolbar: React.ReactNode;
}

export function TableHeader<T>({
  columnOrder,
  columns,
  columnVisibility,
  defaultSearchOpen = false,
  enableGlobalSearch = false,
  handleDragOver,
  handleDragStart,
  handleDrop,
  handlePinColumn,
  hasActiveFilters,
  isFullScreen,
  onClearFilters,
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
  const messages = useMessages();

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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement>(null);

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

  const hasCustomSettings = () => {
    const defaultColumnOrder = columns.map((col) => col.key);
    const isColumnOrderChanged =
      columnOrder.length !== defaultColumnOrder.length ||
      !columnOrder.every((col, index) => col === defaultColumnOrder[index]);

    const isColumnVisibilityChanged = columns.some(
      (column) => columnVisibility[column.key] !== (column.visible ?? true),
    );

    const isPinnedColumnsChanged =
      pinnedColumns.left.length > 0 || pinnedColumns.right.length > 0;

    return (
      isColumnOrderChanged ||
      isColumnVisibilityChanged ||
      isPinnedColumnsChanged
    );
  };

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
    requestAnimationFrame(() =>
      settingsRef.current
        ?.querySelector<HTMLElement>(`[data-column-handle="${columnKey}"]`)
        ?.focus(),
    );
  };

  const orderedColumns = [...columns].sort(
    (a, b) => columnOrder.indexOf(a.key) - columnOrder.indexOf(b.key),
  );

  return (
    <header
      className="sticky top-0 left-0 z-3 flex min-h-10 flex-wrap items-start justify-between gap-2 bg-surface p-2 pb-0 dark:bg-surface-dark"
      ref={ref}
    >
      <div className="min-w-0 flex-1">{toolbar}</div>
      <div className="flex shrink-0 items-center gap-2">
        {enableGlobalSearch && (
          <div className="flex items-center">
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isSearchOpen
                  ? "mr-2 w-[calc(100vw-80px)] opacity-100 sm:w-64"
                  : "w-0 opacity-0",
              )}
            >
              <input
                aria-label={messages.dataTable.search}
                className="h-6.5 w-full rounded-md border border-neutral-200 bg-surface px-3 py-1.5 text-sm text-neutral-900 placeholder-neutral-500 focus:border-primary-500 focus:outline-none dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-400"
                onChange={({ target }) => searchField.change(target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    // Closes the search only, not a dialog around the table
                    e.preventDefault();
                    toggleSearch();
                  }
                }}
                placeholder={messages.dataTable.search}
                ref={searchInputRef}
                tabIndex={isSearchOpen ? 0 : -1}
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
            >
              <Search size={18} />
            </IconButton>
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-2 transition-all duration-300",
            isSearchOpen && "hidden sm:flex",
          )}
        >
          {showClearFilters && (
            <ClearFiltersButton
              hasActiveFilters={hasActiveFilters}
              onClear={onClearFilters}
            />
          )}

          {/* A panel of controls, not a menu - Tab moves through it */}
          <Popover
            align="right"
            aria-label={messages.dataTable.columns}
            contentClassName="mt-2.5 p-1"
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
                  className="w-full cursor-pointer rounded p-1.5 text-left text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  disabled={!hasCustomSettings()}
                  onClick={onResetSettings}
                  type="button"
                >
                  {messages.dataTable.resetColumns}
                </button>
              </div>
              {orderedColumns.map((column) => {
                const columnName = column.labelTitle ?? column.label;

                return (
                  <div
                    className="m-1 flex items-center p-1"
                    key={column.key}
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleDrop(event, column.key)}
                  >
                    <button
                      aria-label={formatMessage(messages.dataTable.moveColumn, {
                        label: columnName,
                      })}
                      className="mr-2 cursor-grab rounded opacity-50 hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-300"
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
                    <button
                      aria-label={formatMessage(messages.dataTable.pinLeft, {
                        label: columnName,
                      })}
                      aria-pressed={pinnedColumns.left.includes(column.key)}
                      className={cn(
                        "mr-2 cursor-pointer rounded opacity-50 hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-300",
                        pinnedColumns.left.includes(column.key) &&
                          "text-primary-500 opacity-100",
                      )}
                      onClick={() => handlePinColumn(column.key, "left")}
                      type="button"
                    >
                      <PanelLeft aria-hidden="true" size={16} />
                    </button>
                    <button
                      aria-label={formatMessage(messages.dataTable.pinRight, {
                        label: columnName,
                      })}
                      aria-pressed={pinnedColumns.right.includes(column.key)}
                      className={cn(
                        "mr-2 cursor-pointer rounded opacity-50 hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-300",
                        pinnedColumns.right.includes(column.key) &&
                          "text-primary-500 opacity-100",
                      )}
                      onClick={() => handlePinColumn(column.key, "right")}
                      type="button"
                    >
                      <PanelRight aria-hidden="true" size={16} />
                    </button>
                    <Switch
                      aria-label={columnName}
                      checked={columnVisibility[column.key] ?? true}
                      className="ml-1"
                      onChange={({ target }) =>
                        setColumnVisibility((prev) => ({
                          ...prev,
                          [column.key]: target.checked,
                        }))
                      }
                    />
                    <span className="ml-3 text-sm font-medium whitespace-nowrap">
                      {columnName}
                    </span>
                  </div>
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
