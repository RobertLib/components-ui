import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import cn from "../../../utils/cn";

/**
 * The periods of a grid - months, quarters or years - as consecutive whole
 * numbers: a month is `year * 12 + month index`, a quarter `year * 4 +
 * quarter index`, a year itself. A page of the grid shows `pageSize` of
 * them.
 */
export interface PeriodGridProps {
  /** Moves the focus to the period - the popup was opened by a key. */
  autoFocus: boolean;
  /** Periods in a row of the grid. */
  columns: keyof typeof gridColumns;
  /** The content of the button of a period - e.g. the name of a month. */
  content: (key: number) => React.ReactNode;
  /**
   * The key of today - the period the grid starts at without a selected
   * one. Called once, as the grid opens.
   */
  getTodayKey: () => number;
  /**
   * Periods that cannot be picked although in `min` / `max` - every day of
   * them is disabled. They take the focus, like an unavailable day.
   */
  isUnavailable?: (key: number) => boolean;
  /** Accessible name of the button of a period - "March 2026". */
  label: (key: number) => string;
  /** The last period the grid can show - the year 9999. */
  lastKey: number;
  /** Latest selectable period - `null` for none. */
  max: number | null;
  /** Earliest selectable period - `null` for none. */
  min: number | null;
  /** The button that shows the next page - "Next year". */
  nextPageLabel: string;
  /** Escape was pressed in the grid. */
  onEscape: () => void;
  /** A period was picked. */
  onSelect: (key: number) => void;
  /** Heading of a page, also the name of its grid - "2026", "2020 – 2031". */
  pageLabel: (start: number) => string;
  /** Periods of a page - also how far the page buttons and Page Up go. */
  pageSize: number;
  /** The first period of the page that shows `key` as the grid opens. */
  pageStartOf: (key: number) => number;
  /** The button that shows the previous page - "Previous year". */
  previousPageLabel: string;
  /** The selected period - the grid starts at it (or today). */
  selected: number | null;
}

// Literal classes - Tailwind finds them in the source
const gridColumns = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

const pageButtonClassName =
  "rounded p-1 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-neutral-700 dark:disabled:hover:bg-transparent";

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

/**
 * The popup of the month, quarter and year pickers: a page of periods with
 * buttons for the previous and the next page, operated with the mouse or
 * the keyboard. Mounted each time a popup opens, so it starts at the
 * selected period (or today) - and follows a period selected while it is
 * open.
 */
export default function PeriodGrid({
  autoFocus,
  columns,
  content,
  getTodayKey,
  isUnavailable,
  label,
  lastKey,
  max,
  min,
  nextPageLabel,
  onEscape,
  onSelect,
  pageLabel,
  pageSize,
  pageStartOf,
  previousPageLabel,
  selected,
}: PeriodGridProps) {
  const rows = Array.from({ length: Math.ceil(pageSize / columns) }, (_, row) =>
    Array.from(
      { length: Math.min(columns, pageSize - row * columns) },
      (_, column) => row * columns + column,
    ),
  );

  // Within the periods the grid can show at all - no year before 0 or
  // after 9999, which the values cannot write
  const minKey = Math.max(min ?? 0, 0);
  const maxKey = Math.min(max ?? lastKey, lastKey);

  const [openedAt] = useState(() =>
    clamp(selected ?? getTodayKey(), 0, lastKey),
  );
  const [pageStart, setPageStart] = useState(() => pageStartOf(openedAt));
  // The focused period as its place on the page - the page buttons keep
  // it: March stays focused in the next year
  const [focusedIndex, setFocusedIndex] = useState(openedAt - pageStart);
  const gridRef = useRef<HTMLDivElement>(null);
  // The focused period takes the focus when a key moved it - not when the
  // popup opened by a click, which leaves it in the field for typing
  const moveFocusRef = useRef(autoFocus);

  // A period selected while the grid is open - typed into the field - is
  // shown and focused
  const [shownSelected, setShownSelected] = useState(selected);

  if (selected !== shownSelected) {
    setShownSelected(selected);

    if (selected !== null) {
      const start = pageStartOf(selected);
      setPageStart(start);
      setFocusedIndex(selected - start);
    }
  }

  // The one period of the page in the tab order: the focused one, or the
  // nearest one that can be picked. `null` when none can.
  const firstEnabled = Math.max(minKey - pageStart, 0);
  const lastEnabled = Math.min(maxKey - pageStart, pageSize - 1);
  const tabStop =
    firstEnabled > lastEnabled
      ? null
      : clamp(focusedIndex, firstEnabled, lastEnabled);

  useEffect(() => {
    // Also when a period has the focus that now shows another one - a
    // period typed while the grid was open moved the focused one
    const grid = gridRef.current;
    const active = document.activeElement;
    const periodHasFocus =
      active instanceof HTMLElement &&
      !!grid?.contains(active) &&
      "periodIndex" in active.dataset;
    const moveFocus = moveFocusRef.current || periodHasFocus;
    moveFocusRef.current = false;
    if (!moveFocus || tabStop === null) return;

    const frame = requestAnimationFrame(() => {
      grid
        ?.querySelector<HTMLButtonElement>(`[data-period-index="${tabStop}"]`)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pageStart, tabStop]);

  /** The page from `start` on, moved by whole pages until it shows `key`. */
  const pageShowing = (start: number, key: number) =>
    start + Math.floor((key - start) / pageSize) * pageSize;

  // The arrow keys move between the periods - on into the next or the
  // previous page - Home / End to the first / last period of the page, Page
  // Up / Down by a page (with Shift by ten), all stopping at `min` / `max`.
  // Enter and Space are left to the buttons: on a period they pick it, on
  // the page buttons they page.
  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    if (tabStop === null) return;

    const current = pageStart + tabStop;
    const pageOffset = pageSize * (event.shiftKey ? 10 : 1);
    // Left is forward in a right-to-left page - the periods run from the
    // right
    const forward = isRtl(event.currentTarget) ? -1 : 1;
    const target = {
      ArrowDown: current + columns,
      ArrowLeft: current - forward,
      ArrowRight: current + forward,
      ArrowUp: current - columns,
      End: pageStart + pageSize - 1,
      Home: pageStart,
      PageDown: current + pageOffset,
      PageUp: current - pageOffset,
    }[event.key];
    if (target === undefined) return;

    event.preventDefault();
    const key = clamp(target, minKey, maxKey);
    // Stopped at `min` / `max` - nothing moves, so nothing may take the
    // focus later on either (a click on a page button)
    if (key === current) return;

    const start = pageShowing(pageStart, key);
    moveFocusRef.current = true;
    setPageStart(start);
    setFocusedIndex(key - start);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onEscape();
  };

  const pageName = pageLabel(pageStart);

  return (
    <div onKeyDown={handleKeyDown}>
      <div className="mb-2 flex items-center justify-between">
        <button
          aria-label={previousPageLabel}
          className={pageButtonClassName}
          // No page before the year 0
          disabled={pageStart <= 0}
          onClick={() => setPageStart(pageStart - pageSize)}
          type="button"
        >
          {/* Pointing the other way in a right-to-left page */}
          <ChevronLeft className="rtl:-scale-x-100" size={20} />
        </button>
        <div aria-live="polite" className="text-sm font-semibold">
          {pageName}
        </div>
        <button
          aria-label={nextPageLabel}
          className={pageButtonClassName}
          // No page after the year 9999
          disabled={pageStart + pageSize > lastKey}
          onClick={() => setPageStart(pageStart + pageSize)}
          type="button"
        >
          <ChevronRight className="rtl:-scale-x-100" size={20} />
        </button>
      </div>

      <div
        aria-label={pageName}
        className={cn("grid gap-1.5", gridColumns[columns])}
        onKeyDown={handleGridKeyDown}
        ref={gridRef}
        role="grid"
      >
        {rows.map((row, rowIndex) => (
          <div className="contents" key={rowIndex} role="row">
            {row.map((index) => {
              const key = pageStart + index;
              const isSelected = selected === key;
              const isFocused = tabStop === index;
              const disabled = key < minKey || key > maxKey;
              // Every day of it disabled - it takes the focus, like an
              // unavailable day
              const unavailable = !disabled && !!isUnavailable?.(key);
              const canPick = !disabled && !unavailable;

              return (
                <div
                  aria-disabled={!canPick || undefined}
                  aria-selected={isSelected}
                  data-disabled={!canPick ? "" : undefined}
                  data-highlighted={isFocused ? "" : undefined}
                  data-selected={isSelected ? "" : undefined}
                  key={index}
                  role="gridcell"
                >
                  <button
                    aria-disabled={unavailable || undefined}
                    aria-label={label(key)}
                    className={cn(
                      "w-full rounded p-1.5 text-sm",
                      // Forced colors (Windows High Contrast) draw no
                      // background - the system's highlight colors then
                      isSelected
                        ? "bg-primary-600 text-white forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
                        : unavailable &&
                            "text-neutral-500 dark:text-neutral-400",
                      !canPick && "forced-colors:text-[GrayText]",
                      canPick &&
                        (isSelected
                          ? "hover:bg-primary-700 dark:hover:bg-primary-700"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-700"),
                      // The ring is a shadow - forced colors show the
                      // outline of `outline-hidden` instead
                      isFocused &&
                        !isSelected &&
                        "ring-2 ring-primary-500 outline-hidden",
                      unavailable && "line-through",
                      !canPick && "cursor-not-allowed",
                      disabled && "opacity-40",
                    )}
                    data-period-index={index}
                    disabled={disabled}
                    onClick={() => {
                      if (!unavailable) onSelect(key);
                    }}
                    onFocus={() => setFocusedIndex(index)}
                    tabIndex={isFocused ? 0 : -1}
                    type="button"
                  >
                    {content(key)}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
