import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import cn from "../../utils/cn";
import { isInRange, parseDisplayValue } from "./parse";
import PickerField from "./picker-field";
import usePickerPopup from "./use-picker-popup";
import { formatMessage } from "../../i18n/format";
import {
  addDays,
  dateOf,
  formatPattern,
  getISOWeek,
  getISOWeeksInYear,
  pad2,
  padYear,
  withoutYear,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";
import type { CustomPickerProps } from "./types";

/** Splits `YYYY-Www` (ISO week) into numbers. */
const parseWeek = (value: string | undefined) => {
  const match = value?.match(/^(\d{4})-W(\d{2})$/);
  return match ? { week: Number(match[2]), year: Number(match[1]) } : null;
};

type ParsedWeek = ReturnType<typeof parseWeek>;

interface WeekGridProps {
  /** Moves the focus to the week - the popup was opened by a key. */
  autoFocus: boolean;
  /** Latest selectable week. */
  max: ParsedWeek;
  /** Earliest selectable week. */
  min: ParsedWeek;
  /** Escape was pressed in the grid. */
  onEscape: () => void;
  /** A week was picked. */
  onSelect: (year: number, week: number) => void;
  /** The selected week - the grid starts at it (or this week). */
  selected: ParsedWeek;
}

/** Monday of the ISO week `week` of `year`. */
const isoWeekStart = (year: number, week: number) => {
  // January 4th always lies in the first week
  const monday = dateOf(year, 0, 4);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return addDays(monday, (week - 1) * 7);
};

/** A comparable key of an ISO week. */
const weekKey = (year: number, week: number) => year * 100 + week;

// Weeks in a row of the grid
const COLUMNS = 4;

function WeekGrid({
  autoFocus,
  max,
  min,
  onEscape,
  onSelect,
  selected,
}: WeekGridProps) {
  const locale = useLocale();
  const messages = locale.messages.dateTimePicker;
  const current = getISOWeek(new Date());
  // The buttons show the week as the week format of the locale does -
  // without the year: "W39", "KW 39"
  const weekPattern = withoutYear(locale.formats.week);

  const [year, setYear] = useState(() => selected?.year ?? current.year);
  const [focusedWeek, setFocusedWeek] = useState(
    () => selected?.week ?? current.week,
  );
  const listRef = useRef<HTMLDivElement>(null);
  // The focused week takes the focus when a key moved it - not when the
  // popup opened by a click, which leaves it in the field for typing
  const moveFocusRef = useRef(autoFocus);

  // A week selected while the grid is open - typed into the field - is
  // shown and focused
  const selectedKey = selected ? weekKey(selected.year, selected.week) : null;
  const [shownSelectedKey, setShownSelectedKey] = useState(selectedKey);

  if (selectedKey !== shownSelectedKey) {
    setShownSelectedKey(selectedKey);

    if (selected) {
      setYear(selected.year);
      setFocusedWeek(selected.week);
    }
  }

  const weeksInYear = getISOWeeksInYear(year);
  const weeks = Array.from({ length: weeksInYear }, (_, index) => index + 1);
  const rows = Array.from(
    { length: Math.ceil(weeksInYear / COLUMNS) },
    (_, row) => weeks.slice(row * COLUMNS, (row + 1) * COLUMNS),
  );

  const isDisabled = (week: number) => {
    const key = weekKey(year, week);
    return (
      (!!min && key < weekKey(min.year, min.week)) ||
      (!!max && key > weekKey(max.year, max.week))
    );
  };

  // The one week of the shown year in the tab order: the focused week, or
  // the nearest one that can be picked. `null` when none can.
  const firstEnabled =
    !min || min.year < year ? 1 : min.year === year ? min.week : Infinity;
  const lastEnabled =
    !max || max.year > year
      ? weeksInYear
      : max.year === year
        ? max.week
        : -Infinity;
  const tabStop =
    firstEnabled > lastEnabled
      ? null
      : Math.min(Math.max(focusedWeek, firstEnabled), lastEnabled);

  // Scroll the focused week into view and give it the keyboard focus
  useEffect(() => {
    // Also when a week has the focus that now shows another one - a week
    // typed while the grid was open moved the focused one
    const list = listRef.current;
    const active = document.activeElement;
    const weekHasFocus =
      active instanceof HTMLElement &&
      !!list?.contains(active) &&
      "week" in active.dataset;
    const moveFocus = moveFocusRef.current || weekHasFocus;
    moveFocusRef.current = false;
    if (tabStop === null) return;

    const frame = requestAnimationFrame(() => {
      const button = list?.querySelector<HTMLButtonElement>(
        `[data-week="${tabStop}"]`,
      );
      button?.scrollIntoView?.({ block: "nearest" });
      if (moveFocus) button?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [tabStop, year]);

  /** The week `offset` weeks from the tab stop - on over the new year. */
  const weekFromTabStop = (from: number, offset: number) =>
    getISOWeek(addDays(isoWeekStart(year, from), offset * 7));

  // The arrow keys move between the weeks - on into the next or the
  // previous year - Home / End to the first / last week of the year, Page
  // Up / Down to the same week of the previous / next year (with Shift by
  // ten), all stopping at `min` / `max`. Enter and Space are left to the
  // buttons: on a week they pick it, on the year buttons they page.
  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    if (tabStop === null) return;

    let target: { week: number; year: number };

    switch (event.key) {
      case "ArrowDown":
        target = weekFromTabStop(tabStop, COLUMNS);
        break;
      case "ArrowLeft":
        target = weekFromTabStop(tabStop, -1);
        break;
      case "ArrowRight":
        target = weekFromTabStop(tabStop, 1);
        break;
      case "ArrowUp":
        target = weekFromTabStop(tabStop, -COLUMNS);
        break;
      case "Home":
        target = { week: 1, year };
        break;
      case "End":
        target = { week: weeksInYear, year };
        break;
      case "PageDown":
      case "PageUp": {
        const targetYear =
          year + (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 10 : 1);
        target = {
          week: Math.min(tabStop, getISOWeeksInYear(targetYear)),
          year: targetYear,
        };
        break;
      }
      default:
        return;
    }

    event.preventDefault();

    if (min && weekKey(target.year, target.week) < weekKey(min.year, min.week))
      target = min;
    if (max && weekKey(target.year, target.week) > weekKey(max.year, max.week))
      target = max;
    // Stopped at `min` / `max` - nothing moves, so nothing may take the
    // focus later on either (a click on a year button)
    if (target.year === year && target.week === tabStop) return;

    moveFocusRef.current = true;
    setYear(target.year);
    setFocusedWeek(target.week);
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

      <div className="max-h-60 overflow-y-auto" ref={listRef}>
        <div
          aria-label={String(year)}
          className="grid grid-cols-4 gap-1.5"
          onKeyDown={handleGridKeyDown}
          role="grid"
        >
          {rows.map((row, rowIndex) => (
            <div className="contents" key={rowIndex} role="row">
              {row.map((week) => {
                const isSelected =
                  selected?.week === week && selected.year === year;
                const isFocused = tabStop === week;
                const disabled = isDisabled(week);

                return (
                  <div
                    aria-disabled={disabled || undefined}
                    aria-selected={isSelected}
                    key={week}
                    role="gridcell"
                  >
                    <button
                      aria-label={formatMessage(messages.week, { week, year })}
                      className={cn(
                        "w-full rounded p-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700",
                        isSelected &&
                          "bg-primary-600 text-white hover:bg-primary-700 dark:hover:bg-primary-700",
                        isFocused &&
                          !isSelected &&
                          "ring-2 ring-primary-500 outline-none",
                        disabled &&
                          "cursor-not-allowed opacity-40 hover:bg-transparent dark:hover:bg-transparent",
                      )}
                      data-week={week}
                      disabled={disabled}
                      onClick={() => onSelect(year, week)}
                      onFocus={() => setFocusedWeek(week)}
                      tabIndex={isFocused ? 0 : -1}
                      type="button"
                    >
                      {formatPattern(weekPattern, { week })}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** `type="week"` - value `YYYY-Www` (ISO 8601 week). */
export default function WeekPicker({
  max,
  min,
  minuteStep: _minuteStep,
  onValueChange,
  placeholder,
  value,
  ...props
}: CustomPickerProps) {
  const locale = useLocale();
  const messages = locale.messages.dateTimePicker;
  const {
    close,
    contentRef,
    inputRef,
    isOpen,
    onOpenChange,
    openedByKeyboard,
  } = usePickerPopup(!props.disabled && !props.readOnly);

  const selected = parseWeek(value);

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? messages.selectWeek}
      contentRef={contentRef}
      displayValue={
        selected ? formatPattern(locale.formats.week, selected) : ""
      }
      icon="calendar"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      panelClassName="w-64"
      parseText={(text) => {
        const typed = parseDisplayValue(text, locale.formats.week, "week");
        return typed && isInRange(typed, min, max) ? typed : null;
      }}
      placeholder={placeholder}
      popupLabel={messages.selectWeek}
      value={value}
    >
      <WeekGrid
        autoFocus={openedByKeyboard}
        max={parseWeek(max)}
        min={parseWeek(min)}
        onEscape={close}
        onSelect={(year, week) => {
          onValueChange(`${padYear(year)}-W${pad2(week)}`);
          close();
        }}
        selected={selected}
      />
    </PickerField>
  );
}
