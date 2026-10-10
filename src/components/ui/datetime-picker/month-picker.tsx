import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import cn from "../../../utils/cn";
import {
  getRangeMessage,
  isInRange,
  parseDisplayValue,
  parseMonth,
} from "./parse";
import PickerField from "./picker-field";
import usePickerPopup from "./use-picker-popup";
import { isMonthUnavailable, type DateDisabledPredicate } from "./availability";
import { formatMessage } from "../../../i18n/ui/format";
import {
  formatPattern,
  formatPlaceholder,
  getMonthNames,
  pad2,
  padYear,
} from "../../../utils/date";
import { inTimeZone } from "../../../utils/time-zone";
import { useLocale } from "../../../providers/ui-context";
import type { CustomPickerProps } from "./types";

interface MonthGridProps {
  /** Moves the focus to the month - the popup was opened by a key. */
  autoFocus: boolean;
  /**
   * Days that cannot be picked - a month without any other can take the
   * focus but not be picked.
   */
  isDateDisabled?: DateDisabledPredicate;
  /** Latest selectable month. */
  max: ReturnType<typeof parseMonth>;
  /** Earliest selectable month. */
  min: ReturnType<typeof parseMonth>;
  /** Escape was pressed in the grid. */
  onEscape: () => void;
  /** A month (1 - 12) was picked. */
  onSelect: (year: number, month: number) => void;
  /** The selected month - the grid starts at it (or this month). */
  selected: ReturnType<typeof parseMonth>;
  /** The IANA time zone of today - its month is shown without a selected one. */
  timeZone?: string;
}

// Months in a row of the grid
const COLUMNS = 3;

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

const yearButtonClassName =
  "rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700";

function MonthGrid({
  autoFocus,
  isDateDisabled,
  max,
  min,
  onEscape,
  onSelect,
  selected,
  timeZone,
}: MonthGridProps) {
  const locale = useLocale();
  const messages = locale.messages.ui.dateTimePicker;
  const monthNames = getMonthNames(locale.code);
  const rows = Array.from({ length: 12 / COLUMNS }, (_, row) =>
    Array.from({ length: COLUMNS }, (_, column) => row * COLUMNS + column),
  );

  const [year, setYear] = useState(
    () => selected?.year ?? inTimeZone(new Date(), timeZone).getFullYear(),
  );
  // 0 - 11
  const [focusedMonth, setFocusedMonth] = useState(
    () =>
      (selected?.month ?? inTimeZone(new Date(), timeZone).getMonth() + 1) - 1,
  );
  const gridRef = useRef<HTMLDivElement>(null);
  // The focused month takes the focus when a key moved it - not when the
  // popup opened by a click, which leaves it in the field for typing
  const moveFocusRef = useRef(autoFocus);

  // Months as comparable keys - `year * 12 + month index`
  const minKey = min ? min.year * 12 + min.month - 1 : -Infinity;
  const maxKey = max ? max.year * 12 + max.month - 1 : Infinity;

  // A month selected while the grid is open - typed into the field - is
  // shown and focused
  const selectedKey = selected ? selected.year * 12 + selected.month - 1 : null;
  const [shownSelectedKey, setShownSelectedKey] = useState(selectedKey);

  if (selectedKey !== shownSelectedKey) {
    setShownSelectedKey(selectedKey);

    if (selected) {
      setYear(selected.year);
      setFocusedMonth(selected.month - 1);
    }
  }

  const isDisabled = (month: number) => {
    const key = year * 12 + month;
    return key < minKey || key > maxKey;
  };

  // The one month of the shown year in the tab order: the focused month,
  // or the nearest one that can be picked. `null` when none can.
  const firstEnabled = Math.max(minKey - year * 12, 0);
  const lastEnabled = Math.min(maxKey - year * 12, 11);
  const tabStop =
    firstEnabled > lastEnabled
      ? null
      : Math.min(Math.max(focusedMonth, firstEnabled), lastEnabled);

  useEffect(() => {
    // Also when a month has the focus that now shows another one - a month
    // typed while the grid was open moved the focused one
    const grid = gridRef.current;
    const active = document.activeElement;
    const monthHasFocus =
      active instanceof HTMLElement &&
      !!grid?.contains(active) &&
      "monthIndex" in active.dataset;
    const moveFocus = moveFocusRef.current || monthHasFocus;
    moveFocusRef.current = false;
    if (!moveFocus || tabStop === null) return;

    const frame = requestAnimationFrame(() => {
      grid
        ?.querySelector<HTMLButtonElement>(`[data-month-index="${tabStop}"]`)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [tabStop, year]);

  // The arrow keys move between the months - on into the next or the
  // previous year - Home / End to the first / last month of the year, Page
  // Up / Down by a year (with Shift by ten), all stopping at `min` / `max`.
  // Enter and Space are left to the buttons: on a month they pick it, on
  // the year buttons they page.
  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    if (tabStop === null) return;

    const current = year * 12 + tabStop;
    const pageOffset = 12 * (event.shiftKey ? 10 : 1);
    // Left is forward in a right-to-left page - the months run from the
    // right
    const forward = isRtl(event.currentTarget) ? -1 : 1;
    const target = {
      ArrowDown: current + COLUMNS,
      ArrowLeft: current - forward,
      ArrowRight: current + forward,
      ArrowUp: current - COLUMNS,
      End: year * 12 + 11,
      Home: year * 12,
      PageDown: current + pageOffset,
      PageUp: current - pageOffset,
    }[event.key];
    if (target === undefined) return;

    event.preventDefault();
    const key = Math.min(Math.max(target, minKey), maxKey);
    // Stopped at `min` / `max` - nothing moves, so nothing may take the
    // focus later on either (a click on a year button)
    if (key === current) return;

    moveFocusRef.current = true;
    setYear(Math.floor(key / 12));
    setFocusedMonth(((key % 12) + 12) % 12);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onEscape();
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <div className="mb-2 flex items-center justify-between">
        <button
          aria-label={messages.previousYear}
          className={yearButtonClassName}
          onClick={() => setYear(year - 1)}
          type="button"
        >
          {/* Pointing the other way in a right-to-left page */}
          <ChevronLeft className="rtl:-scale-x-100" size={20} />
        </button>
        <div aria-live="polite" className="text-sm font-semibold">
          {year}
        </div>
        <button
          aria-label={messages.nextYear}
          className={yearButtonClassName}
          onClick={() => setYear(year + 1)}
          type="button"
        >
          <ChevronRight className="rtl:-scale-x-100" size={20} />
        </button>
      </div>

      <div
        aria-label={String(year)}
        className="grid grid-cols-3 gap-1.5"
        onKeyDown={handleGridKeyDown}
        ref={gridRef}
        role="grid"
      >
        {rows.map((row, rowIndex) => (
          <div className="contents" key={rowIndex} role="row">
            {row.map((index) => {
              const monthName = monthNames[index];
              const isSelected =
                selected?.month === index + 1 && selected.year === year;
              const isFocused = tabStop === index;
              const disabled = isDisabled(index);
              // Every day of it disabled - it takes the focus, like an
              // unavailable day
              const unavailable =
                !disabled &&
                !!isDateDisabled &&
                isMonthUnavailable(year, index + 1, isDateDisabled);
              const canPick = !disabled && !unavailable;

              return (
                <div
                  aria-disabled={disabled || unavailable || undefined}
                  aria-selected={isSelected}
                  data-disabled={!canPick ? "" : undefined}
                  data-highlighted={isFocused ? "" : undefined}
                  data-selected={isSelected ? "" : undefined}
                  key={index}
                  role="gridcell"
                >
                  <button
                    aria-disabled={unavailable || undefined}
                    aria-label={`${monthName} ${year}`}
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
                    data-month-index={index}
                    disabled={disabled}
                    onClick={() => {
                      if (!unavailable) onSelect(year, index + 1);
                    }}
                    onFocus={() => setFocusedMonth(index)}
                    tabIndex={isFocused ? 0 : -1}
                    type="button"
                  >
                    {monthName}
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

/** `type="month"` - value `YYYY-MM`. */
export default function MonthPicker({
  isDateDisabled,
  max,
  min,
  minuteStep: _minuteStep,
  onValueChange,
  placeholder,
  // Of the date popup only
  popupActions: _popupActions,
  presets: _presets,
  timeZone,
  value,
  ...props
}: CustomPickerProps) {
  const locale = useLocale();
  const messages = locale.messages.ui.dateTimePicker;
  const {
    close,
    contentRef,
    inputRef,
    isOpen,
    markPicked,
    onOpenChange,
    openedByKeyboard,
    pickCount,
  } = usePickerPopup(!props.disabled && !props.readOnly);

  const selected = parseMonth(value);

  /** A month (`YYYY-MM`) as the field shows it. */
  const formatValue = (month: string) => {
    const parts = parseMonth(month);
    return parts ? formatPattern(locale.formats.month, parts) : month;
  };

  const getUnavailableMessage = (value: string) => {
    const month = parseMonth(value);
    return month &&
      isDateDisabled &&
      isMonthUnavailable(month.year, month.month, isDateDisabled)
      ? formatMessage(messages.unavailable, { value: formatValue(value) })
      : "";
  };

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? messages.selectMonth}
      contentRef={contentRef}
      displayValue={selected ? formatValue(value) : ""}
      format={formatPlaceholder(
        locale.formats.month,
        messages.placeholderTokens,
      )}
      icon="calendar"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      panelClassName="w-64"
      parseText={(text) => {
        // A year left out is the one of today of `timeZone`
        const typed = parseDisplayValue(
          text,
          locale.formats.month,
          "month",
          undefined,
          inTimeZone(new Date(), timeZone),
        );
        if (!typed) return { error: "format" };
        return isInRange(typed, min, max)
          ? { value: typed, validityMessage: getUnavailableMessage(typed) }
          : { error: "range" };
      }}
      pickCount={pickCount}
      placeholder={placeholder}
      popupLabel={messages.selectMonth}
      validityMessage={
        getRangeMessage(
          messages,
          selected
            ? `${padYear(selected.year)}-${pad2(selected.month)}`
            : undefined,
          { max, min },
          formatValue,
        ) ||
        // A month with no day left - one typed too, which is kept (the form
        // cannot be submitted with it)
        getUnavailableMessage(value)
      }
      value={value}
    >
      <MonthGrid
        autoFocus={openedByKeyboard}
        isDateDisabled={isDateDisabled}
        max={parseMonth(max)}
        min={parseMonth(min)}
        onEscape={close}
        onSelect={(year, month) => {
          markPicked();
          onValueChange(`${padYear(year)}-${pad2(month)}`);
          close();
        }}
        selected={selected}
        timeZone={timeZone}
      />
    </PickerField>
  );
}
