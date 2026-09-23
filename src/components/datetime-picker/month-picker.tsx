import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import cn from "../../utils/cn";
import { isInRange, parseDisplayValue } from "./parse";
import PickerField from "./picker-field";
import usePickerPopup from "./use-picker-popup";
import { formatPattern, getMonthNames } from "../../utils/date";
import { useLocale } from "../../providers/ui-context";
import type { CustomPickerProps } from "./types";

/** Splits `YYYY-MM` into numbers (month 1 - 12). */
const parseMonth = (value: string | undefined) => {
  const match = value?.match(/^(\d{4})-(\d{2})/);
  return match ? { month: Number(match[2]), year: Number(match[1]) } : null;
};

interface MonthGridProps {
  /** Moves the focus to the month - the popup was opened by a key. */
  autoFocus: boolean;
  max: ReturnType<typeof parseMonth>;
  min: ReturnType<typeof parseMonth>;
  onEscape: () => void;
  onSelect: (year: number, month: number) => void;
  selected: ReturnType<typeof parseMonth>;
}

// Months in a row of the grid
const COLUMNS = 3;

function MonthGrid({
  autoFocus,
  max,
  min,
  onEscape,
  onSelect,
  selected,
}: MonthGridProps) {
  const locale = useLocale();
  const messages = locale.messages.dateTimePicker;
  const monthNames = getMonthNames(locale.code);
  const rows = Array.from({ length: 12 / COLUMNS }, (_, row) =>
    Array.from({ length: COLUMNS }, (_, column) => row * COLUMNS + column),
  );

  const [year, setYear] = useState(
    () => selected?.year ?? new Date().getFullYear(),
  );
  // 0 - 11
  const [focusedMonth, setFocusedMonth] = useState(
    () => (selected?.month ?? new Date().getMonth() + 1) - 1,
  );
  const gridRef = useRef<HTMLDivElement>(null);
  // The focused month takes the focus when a key moved it - not when the
  // popup opened by a click, which leaves it in the field for typing
  const moveFocusRef = useRef(autoFocus);

  // Months as comparable keys - `year * 12 + month index`
  const minKey = min ? min.year * 12 + min.month - 1 : -Infinity;
  const maxKey = max ? max.year * 12 + max.month - 1 : Infinity;

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
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    if (tabStop === null) return;

    const frame = requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-month-index="${tabStop}"]`)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [tabStop, year]);

  // The arrow keys move between the months - on into the next or the
  // previous year, and stopping at `min` / `max`. Enter and Space are left
  // to the buttons: on a month they pick it, on the year buttons they page.
  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    const offset = {
      ArrowDown: COLUMNS,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -COLUMNS,
    }[event.key];
    if (offset === undefined) return;

    event.preventDefault();
    if (tabStop === null) return;

    const key = Math.min(
      Math.max(year * 12 + tabStop + offset, minKey),
      maxKey,
    );
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
    <div
      aria-label={messages.selectMonth}
      onKeyDown={handleKeyDown}
      role="group"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          aria-label={messages.previousYear}
          className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => setYear(year - 1)}
          type="button"
        >
          <ChevronLeft size={20} />
        </button>
        <div aria-live="polite" className="text-sm font-semibold">
          {year}
        </div>
        <button
          aria-label={messages.nextYear}
          className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => setYear(year + 1)}
          type="button"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div
        aria-label={messages.selectMonth}
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

              return (
                <div
                  aria-disabled={disabled || undefined}
                  aria-selected={isSelected}
                  key={index}
                  role="gridcell"
                >
                  <button
                    aria-label={`${monthName} ${year}`}
                    className={cn(
                      "w-full rounded p-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700",
                      isSelected &&
                        "bg-primary-500 text-white hover:bg-primary-600 dark:hover:bg-primary-600",
                      isFocused &&
                        !isSelected &&
                        "ring-2 ring-primary-400 outline-none",
                      disabled &&
                        "cursor-not-allowed opacity-40 hover:bg-transparent dark:hover:bg-transparent",
                    )}
                    data-month-index={index}
                    disabled={disabled}
                    onClick={() => onSelect(year, index + 1)}
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
  max,
  min,
  minuteStep: _minuteStep,
  onValueChange,
  placeholder,
  value,
  ...props
}: CustomPickerProps) {
  const locale = useLocale();
  const {
    close,
    contentRef,
    inputRef,
    isOpen,
    onOpenChange,
    openedByKeyboard,
  } = usePickerPopup();

  const selected = parseMonth(value);

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? locale.messages.dateTimePicker.selectMonth}
      contentRef={contentRef}
      displayValue={
        selected ? formatPattern(locale.formats.month, selected) : ""
      }
      icon="calendar"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      panelClassName="w-64"
      parseText={(text) => {
        const typed = parseDisplayValue(text, locale.formats.month, "month");
        return typed && isInRange(typed, min, max) ? typed : null;
      }}
      placeholder={placeholder}
      value={value}
    >
      <MonthGrid
        autoFocus={openedByKeyboard}
        max={parseMonth(max)}
        min={parseMonth(min)}
        onEscape={close}
        onSelect={(year, month) => {
          onValueChange(`${year}-${String(month).padStart(2, "0")}`);
          close();
        }}
        selected={selected}
      />
    </PickerField>
  );
}
