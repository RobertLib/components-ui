import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import cn from "../../utils/cn";
import {
  addDays,
  getMonthDays,
  getMonthNames,
  getWeekdayNames,
  isSameDay,
  startOfDay,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

interface DayGridProps {
  /** Moves the focus to the day - the popup was opened by a key. */
  autoFocus?: boolean;
  /** Latest selectable day. */
  max?: Date | null;
  /** Earliest selectable day. */
  min?: Date | null;
  onEscape: () => void;
  onSelect: (date: Date) => void;
  selected: Date | null;
}

const firstOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

// Years offered around today without `min` / `max` - birth dates included
const YEARS_BACK = 100;
const YEARS_AHEAD = 20;

const selectClassName =
  "cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold hover:border-neutral-300 focus:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 dark:hover:border-neutral-600 dark:focus:border-neutral-600";

/**
 * A month of days with month and year navigation, operated with the mouse
 * or the keyboard. Mounted each time the popup opens, so it starts at the
 * selected day (or today).
 */
export default function DayGrid({
  autoFocus = false,
  max,
  min,
  onEscape,
  onSelect,
  selected,
}: DayGridProps) {
  const locale = useLocale();
  const { messages } = locale;

  const minDay = min ? startOfDay(min) : null;
  const maxDay = max ? startOfDay(max) : null;

  /** `date` moved into [`min`, `max`] - the nearest day that can be picked. */
  const clampToRange = (date: Date) => {
    if (minDay && date < minDay) return minDay;
    if (maxDay && date > maxDay) return maxDay;
    return date;
  };

  // A disabled day cannot take the focus - start inside the allowed range
  const [focusedDate, setFocusedDate] = useState(() =>
    clampToRange(startOfDay(selected ?? new Date())),
  );
  const [month, setMonth] = useState(() => firstOfMonth(focusedDate));
  const gridRef = useRef<HTMLDivElement>(null);
  // The focused day takes the focus when a key moved it - not when the
  // month changed by a click or a select, where the focus stays
  const moveFocusRef = useRef(autoFocus);

  const isDisabled = (day: Date) =>
    (!!minDay && day < minDay) || (!!maxDay && day > maxDay);

  // The one day of the shown month in the tab order: the focused day, or -
  // when the month was paged away from it or it is disabled - the nearest
  // day of the month that can be picked. `null` when none can.
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const firstEnabled = minDay && minDay > month ? minDay : month;
  const lastEnabled = maxDay && maxDay < lastOfMonth ? maxDay : lastOfMonth;
  const tabStop =
    firstEnabled > lastEnabled
      ? null
      : focusedDate < firstEnabled
        ? firstEnabled
        : focusedDate > lastEnabled
          ? lastEnabled
          : focusedDate;

  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;

    const frame = requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>("[data-focused-day='true']")
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedDate]);

  /** Moves the focus to `date` - or the nearest day that can be picked. */
  const moveFocus = (date: Date) => {
    const target = clampToRange(date);
    setFocusedDate(target);
    setMonth(firstOfMonth(target));
  };

  /** Shows another month, with the focused day on the same date of it. */
  const showMonth = (year: number, monthIndex: number) => {
    const target = new Date(year, monthIndex, 1);
    const daysInTarget = new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      0,
    ).getDate();

    setMonth(target);
    setFocusedDate(
      new Date(
        target.getFullYear(),
        target.getMonth(),
        Math.min(focusedDate.getDate(), daysInTarget),
      ),
    );
  };

  const shiftMonth = (offset: number) =>
    showMonth(month.getFullYear(), month.getMonth() + offset);

  /** The focused day moved by months - kept on a day that can be picked. */
  const shiftFocusedMonth = (offset: number) => {
    const target = new Date(
      focusedDate.getFullYear(),
      focusedDate.getMonth() + offset,
      1,
    );
    const daysInTarget = new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      0,
    ).getDate();
    target.setDate(Math.min(focusedDate.getDate(), daysInTarget));
    moveFocus(target);
  };

  // Enter and Space are left to the buttons: on a day they pick it, on the
  // month buttons they page. The selects keep their own arrow keys.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      return;
    }

    // Any day - the keys move from the one in the tab order, never onto a
    // disabled one
    const onDay = "day" in (event.target as HTMLElement).dataset;
    const from = tabStop ?? focusedDate;
    let move: (() => void) | null = null;

    switch (event.key) {
      case "ArrowLeft":
        if (onDay) move = () => moveFocus(addDays(from, -1));
        break;
      case "ArrowRight":
        if (onDay) move = () => moveFocus(addDays(from, 1));
        break;
      case "ArrowUp":
        if (onDay) move = () => moveFocus(addDays(from, -7));
        break;
      case "ArrowDown":
        if (onDay) move = () => moveFocus(addDays(from, 7));
        break;
      case "Home":
        if (onDay) move = () => moveFocus(firstOfMonth(from));
        break;
      case "End":
        if (onDay) {
          move = () =>
            moveFocus(new Date(from.getFullYear(), from.getMonth() + 1, 0));
        }
        break;
      case "PageUp":
      case "PageDown": {
        // Shift pages by years
        const offset =
          (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1);
        // From a day the focus goes along - and stops at `min` / `max`
        move = onDay
          ? () => shiftFocusedMonth(offset)
          : () => shiftMonth(offset);
        break;
      }
    }

    if (!move) return;
    event.preventDefault();
    if (onDay) moveFocusRef.current = true;
    move();
  };

  const today = new Date();
  const days = getMonthDays(month, locale.weekStartsOn);
  // The rows of the grid - whole weeks, the last one padded
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, row) =>
    Array.from({ length: 7 }, (_, column) => days[row * 7 + column] ?? null),
  );
  const weekdayNames = getWeekdayNames(locale.code, locale.weekStartsOn);
  const longWeekdayNames = getWeekdayNames(
    locale.code,
    locale.weekStartsOn,
    "long",
  );
  const monthNames = getMonthNames(locale.code);
  const dayLabelFormat = new Intl.DateTimeFormat(locale.code, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // From `min` to `max`, or a century back and some years ahead - always
  // with the year on screen
  const shownYear = month.getFullYear();
  const firstYear = Math.min(
    min?.getFullYear() ?? today.getFullYear() - YEARS_BACK,
    shownYear,
  );
  const lastYear = Math.max(
    max?.getFullYear() ?? today.getFullYear() + YEARS_AHEAD,
    shownYear,
  );
  const years = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );

  return (
    <div
      aria-label={messages.dateTimePicker.selectDate}
      onKeyDown={handleKeyDown}
      ref={gridRef}
      role="group"
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          aria-label={messages.dateTimePicker.previousMonth}
          className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => shiftMonth(-1)}
          type="button"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center">
          <select
            aria-label={messages.dateTimePicker.month}
            className={selectClassName}
            onChange={(event) =>
              showMonth(shownYear, Number(event.target.value))
            }
            value={month.getMonth()}
          >
            {monthNames.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label={messages.dateTimePicker.year}
            className={selectClassName}
            onChange={(event) =>
              showMonth(Number(event.target.value), month.getMonth())
            }
            value={shownYear}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button
          aria-label={messages.dateTimePicker.nextMonth}
          className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => shiftMonth(1)}
          type="button"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid">
        <div className="contents" role="row">
          {weekdayNames.map((day, index) => (
            <div
              aria-label={longWeekdayNames[index]}
              className="text-center text-xs font-semibold text-neutral-600 dark:text-neutral-400"
              key={day}
              role="columnheader"
            >
              {day}
            </div>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div className="contents" key={weekIndex} role="row">
            {week.map((day, dayIndex) => {
              if (!day) {
                return <div key={`empty-${dayIndex}`} role="gridcell" />;
              }

              const isSelected = !!selected && isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              const isFocused = !!tabStop && isSameDay(day, tabStop);
              const disabled = isDisabled(day);

              return (
                <div
                  aria-disabled={disabled || undefined}
                  aria-selected={isSelected}
                  key={dayIndex}
                  role="gridcell"
                >
                  <button
                    aria-current={isToday ? "date" : undefined}
                    aria-label={dayLabelFormat.format(day)}
                    className={cn(
                      "w-full rounded p-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700",
                      isSelected &&
                        "bg-primary-500 text-white hover:bg-primary-600 dark:hover:bg-primary-600",
                      isToday && !isSelected && "font-bold text-primary-500",
                      isFocused &&
                        !isSelected &&
                        "ring-2 ring-primary-400 outline-none",
                      disabled &&
                        "cursor-not-allowed opacity-40 hover:bg-transparent dark:hover:bg-transparent",
                    )}
                    data-day=""
                    data-focused-day={isFocused ? "true" : undefined}
                    disabled={disabled}
                    onClick={() => onSelect(day)}
                    onFocus={() => setFocusedDate(day)}
                    tabIndex={isFocused ? 0 : -1}
                    type="button"
                  >
                    {day.getDate()}
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
