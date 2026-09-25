import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import cn from "../../utils/cn";
import { toIntlLocale } from "../../i18n/format";
import {
  addMonths,
  dateOf,
  formatMonthYear,
  getMonthDays,
  getMonthNames,
  getWeekdayNames,
  isSameDay,
  shiftDay,
  startOfDay,
  toISODate,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

/** The days from `start` to `end`, both included - `start` is not after `end`. */
export interface DayRange {
  end: Date;
  start: Date;
}

interface DayGridProps {
  /** Moves the focus to the day - the popup was opened by a key. */
  autoFocus?: boolean;
  /**
   * Days that can take the focus but not be picked - e.g. those that would
   * make a range too short or too long. The arrow keys move over them,
   * unlike over the days out of `min` / `max`.
   */
  isUnavailable?: (day: Date) => boolean;
  /** Latest selectable day. */
  max?: Date | null;
  /** Earliest selectable day. */
  min?: Date | null;
  /** Months shown side by side - the keys move on from one to the next. */
  months?: 1 | 2;
  /** Escape was pressed in the grid. */
  onEscape: () => void;
  /** The pointer moved onto a day, or a day took the focus. */
  onHighlight?: (day: Date) => void;
  /** A day was picked. */
  onSelect: (date: Date) => void;
  /**
   * Range mode: the days shown as selected - the ends in the primary color,
   * a band between them. `null` for none. `selected` then only tells where
   * the grid starts.
   */
  range?: DayRange | null;
  /** The selected day - the grid starts at it (or today). */
  selected: Date | null;
}

// `dateOf` - `new Date(year, …)` would take the years 0 - 99 for 19xx
const firstOfMonth = (date: Date) =>
  dateOf(date.getFullYear(), date.getMonth(), 1);

const lastOfMonth = (date: Date) =>
  dateOf(date.getFullYear(), date.getMonth() + 1, 0);

/** The first day of the month `offset` months from the month of `date`. */
const shiftMonth = (date: Date, offset: number) =>
  dateOf(date.getFullYear(), date.getMonth() + offset, 1);

// Years offered around today without `min` / `max` - birth dates included
const YEARS_BACK = 100;
const YEARS_AHEAD = 20;

// The most years the year select offers before and after the shown one -
// limits like `0001-01-01` - `9999-12-31` would give it thousands
const MAX_YEARS_AROUND = 100;

const selectClassName =
  "cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold hover:border-neutral-300 focus:border-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:border-neutral-600 dark:focus:border-neutral-600";

const navButtonClassName =
  "rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700";

/**
 * A month of days - or two side by side - with month and year navigation,
 * operated with the mouse or the keyboard. Mounted each time the popup
 * opens, so it starts at the selected day (or today) - and follows a day
 * selected while it is open.
 */
export default function DayGrid({
  autoFocus = false,
  isUnavailable,
  max,
  min,
  months = 1,
  onEscape,
  onHighlight,
  onSelect,
  range,
  selected,
}: DayGridProps) {
  const locale = useLocale();
  const { messages } = locale;
  const isRangeMode = range !== undefined;

  const minDay = min ? startOfDay(min) : null;
  const maxDay = max ? startOfDay(max) : null;

  /** `date` moved into [`min`, `max`] - the nearest day that can be picked. */
  const clampToRange = (date: Date) => {
    if (minDay && date < minDay) return minDay;
    if (maxDay && date > maxDay) return maxDay;
    return date;
  };

  // The first of the months shown with `date` - its own one, or with two
  // months the one before when the next could offer nothing (after `max`)
  const getFirstShownMonth = (date: Date) => {
    const first = firstOfMonth(date);
    if (months === 1 || !maxDay || shiftMonth(first, 1) <= maxDay) {
      return first;
    }

    const previous = shiftMonth(first, -1);
    return minDay && lastOfMonth(previous) < minDay ? first : previous;
  };

  // A disabled day cannot take the focus - start inside the allowed range
  const [focusedDate, setFocusedDate] = useState(() =>
    clampToRange(startOfDay(selected ?? new Date())),
  );
  // The first month shown
  const [month, setMonth] = useState(() => getFirstShownMonth(focusedDate));
  const gridRef = useRef<HTMLDivElement>(null);
  // The focused day takes the focus when a key moved it - not when the
  // month changed by a click or a select, where the focus stays
  const moveFocusRef = useRef(autoFocus);

  // The months shown - said to screen readers when the buttons or the
  // selects change them. A key moving the focus to another month is not:
  // the day it focuses says its month.
  const [announcement, setAnnouncement] = useState("");

  // A day selected while the grid is open - picked, or typed into the
  // field - becomes the focused one, in its month
  const selectedDay = selected ? toISODate(selected) : null;
  const [shownSelectedDay, setShownSelectedDay] = useState(selectedDay);

  if (selectedDay !== shownSelectedDay) {
    setShownSelectedDay(selectedDay);

    if (selected) {
      const target = clampToRange(startOfDay(selected));
      setFocusedDate(target);
      setMonth(getFirstShownMonth(target));
    }
  }

  const isDisabled = (day: Date) =>
    (!!minDay && day < minDay) || (!!maxDay && day > maxDay);

  const shownMonths = Array.from({ length: months }, (_, index) =>
    shiftMonth(month, index),
  );
  const lastShownMonth = shiftMonth(month, months - 1);

  // The one day of the shown months in the tab order: the focused day, or -
  // when the months were paged away from it or it is disabled - the
  // nearest day shown that can be picked. `null` when none can.
  const shownEnd = lastOfMonth(lastShownMonth);
  const firstEnabled = minDay && minDay > month ? minDay : month;
  const lastEnabled = maxDay && maxDay < shownEnd ? maxDay : shownEnd;
  const tabStop =
    firstEnabled > lastEnabled
      ? null
      : focusedDate < firstEnabled
        ? firstEnabled
        : focusedDate > lastEnabled
          ? lastEnabled
          : focusedDate;

  useEffect(() => {
    // Also when a day has the focus that now shows another one - a date
    // typed while the grid was open moved the focused day
    const grid = gridRef.current;
    const active = document.activeElement;
    const dayHasFocus =
      active instanceof HTMLElement &&
      !!grid?.contains(active) &&
      "day" in active.dataset;
    const moveFocus = moveFocusRef.current || dayHasFocus;
    moveFocusRef.current = false;
    if (!moveFocus) return;

    const frame = requestAnimationFrame(() => {
      grid
        ?.querySelector<HTMLButtonElement>("[data-focused-day='true']")
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedDate]);

  /** Shows another first month, with the focused day on the same date of it. */
  const showMonth = (year: number, monthIndex: number) => {
    const target = dateOf(year, monthIndex, 1);
    setMonth(target);
    setAnnouncement(
      Array.from({ length: months }, (_, index) =>
        formatMonthYear(shiftMonth(target, index), locale.code),
      ).join(" – "),
    );
    setFocusedDate(
      dateOf(
        target.getFullYear(),
        target.getMonth(),
        Math.min(focusedDate.getDate(), lastOfMonth(target).getDate()),
      ),
    );
  };

  const pageMonths = (offset: number) =>
    showMonth(month.getFullYear(), month.getMonth() + offset);

  /**
   * The first month shown once `day` is shown - the months move as little
   * as they must: from the last shown month on to the next one, the second
   * month becomes the first.
   */
  const getFirstMonthShowing = (day: Date) => {
    const dayMonth = firstOfMonth(day);
    if (dayMonth < month) return dayMonth;
    if (dayMonth > lastShownMonth) return shiftMonth(dayMonth, 1 - months);
    return month;
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
    // disabled one, and over a day the time zone skips
    const onDay = "day" in (event.target as HTMLElement).dataset;
    const from = tabStop ?? focusedDate;
    // Home / End go to the ends of the week, like in the month view of the
    // calendar - over a day the time zone skips, towards `from`
    const intoWeek = (from.getDay() - locale.weekStartsOn + 7) % 7;
    let target: Date | null = null;

    switch (event.key) {
      case "ArrowLeft":
        if (onDay) target = shiftDay(from, -1);
        break;
      case "ArrowRight":
        if (onDay) target = shiftDay(from, 1);
        break;
      case "ArrowUp":
        if (onDay) target = shiftDay(from, -7);
        break;
      case "ArrowDown":
        if (onDay) target = shiftDay(from, 7);
        break;
      case "Home":
        if (onDay) target = shiftDay(from, -intoWeek, 1);
        break;
      case "End":
        if (onDay) target = shiftDay(from, 6 - intoWeek, -1);
        break;
      case "PageUp":
      case "PageDown": {
        // Shift pages by years
        const offset =
          (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1);
        // From a day the focus goes along - and stops at `min` / `max`;
        // elsewhere the months change and the focus stays
        if (onDay) {
          target = addMonths(from, offset);
        } else {
          event.preventDefault();
          pageMonths(offset);
          return;
        }
        break;
      }
    }

    if (!target) return;
    event.preventDefault();

    const next = clampToRange(target);
    // Stopped at `min` / `max` - nothing moves, so nothing may take the
    // focus later on either
    if (isSameDay(next, from)) return;

    moveFocusRef.current = true;
    setFocusedDate(next);
    setMonth(getFirstMonthShowing(next));
  };

  const today = new Date();
  const weekdayNames = getWeekdayNames(locale.code, locale.weekStartsOn);
  const longWeekdayNames = getWeekdayNames(
    locale.code,
    locale.weekStartsOn,
    "long",
  );
  const monthNames = getMonthNames(locale.code);
  const dayLabelFormat = new Intl.DateTimeFormat(toIntlLocale(locale.code), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // From `min` to `max`, or a century back and some years ahead - always
  // with the year on screen, and at most a century on either side of it
  const shownYear = month.getFullYear();
  const firstYear = Math.min(
    Math.max(
      min?.getFullYear() ?? today.getFullYear() - YEARS_BACK,
      shownYear - MAX_YEARS_AROUND,
    ),
    shownYear,
  );
  const lastYear = Math.max(
    Math.min(
      max?.getFullYear() ?? today.getFullYear() + YEARS_AHEAD,
      shownYear + MAX_YEARS_AROUND,
    ),
    shownYear,
  );
  const years = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );

  const renderDay = (day: Date, column: number) => {
    const isToday = isSameDay(day, today);
    const isFocused = !!tabStop && isSameDay(day, tabStop);
    const disabled = isDisabled(day);
    const unavailable = !disabled && !!isUnavailable?.(day);
    const inRange = !!range && day >= range.start && day <= range.end;
    const isRangeStart = !!range && isSameDay(day, range.start);
    const isRangeEnd = !!range && isSameDay(day, range.end);
    // In the primary color: the selected day, or the ends of a range
    const isMarked = isRangeMode
      ? isRangeStart || isRangeEnd
      : !!selected && isSameDay(day, selected);
    const canPick = !disabled && !unavailable;

    return (
      <div
        aria-disabled={!canPick || undefined}
        aria-selected={isRangeMode ? inRange : isMarked}
        className={cn(
          // The band of a range - rounded at its ends, and where a week or
          // the month breaks it
          inRange && "bg-primary-100 dark:bg-primary-900/50",
          inRange &&
            (isRangeStart || column === 0 || day.getDate() === 1) &&
            "rounded-l",
          inRange &&
            (isRangeEnd || column === 6 || isSameDay(day, lastOfMonth(day))) &&
            "rounded-r",
        )}
        key={column}
        role="gridcell"
      >
        <button
          aria-current={isToday ? "date" : undefined}
          aria-disabled={unavailable || undefined}
          aria-label={dayLabelFormat.format(day)}
          className={cn(
            "w-full rounded p-1 text-sm",
            isToday && !isMarked && "font-bold",
            // One text color: an unavailable day can take the focus, so it
            // is grayed by its color - its focus ring stays as strong
            isMarked
              ? "bg-primary-600 text-white"
              : unavailable
                ? "text-neutral-500 dark:text-neutral-400"
                : isToday && "text-primary-600 dark:text-primary-400",
            canPick &&
              (isMarked
                ? "hover:bg-primary-600 dark:hover:bg-primary-600"
                : inRange
                  ? "hover:bg-primary-200 dark:hover:bg-primary-800"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-700"),
            isFocused && !isMarked && "ring-2 ring-primary-500 outline-none",
            !canPick && "cursor-not-allowed",
            disabled && "opacity-40",
          )}
          data-day=""
          data-focused-day={isFocused ? "true" : undefined}
          disabled={disabled}
          onClick={() => {
            if (unavailable) return;
            // The keys go on from the picked day - a click leaves the focus
            // in the field, and the popup of a range stays open
            setFocusedDate(day);
            onSelect(day);
          }}
          onFocus={() => {
            setFocusedDate(day);
            onHighlight?.(day);
          }}
          // A tap is no hover - it picks the day right away
          onPointerEnter={(event) => {
            if (event.pointerType !== "touch") onHighlight?.(day);
          }}
          tabIndex={isFocused ? 0 : -1}
          type="button"
        >
          {day.getDate()}
        </button>
      </div>
    );
  };

  const renderMonth = (shownMonth: Date) => {
    const days = getMonthDays(shownMonth, locale.weekStartsOn);
    // The rows of the grid - whole weeks, the last one padded
    const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, row) =>
      Array.from({ length: 7 }, (_, column) => days[row * 7 + column] ?? null),
    );

    return (
      <div
        aria-label={formatMonthYear(shownMonth, locale.code)}
        // A range is a band without gaps between the days
        className={cn("grid grid-cols-7", isRangeMode ? "gap-y-1" : "gap-1")}
        role="grid"
      >
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
            {week.map((day, column) =>
              day ? (
                renderDay(day, column)
              ) : (
                <div key={`empty-${column}`} role="gridcell" />
              ),
            )}
          </div>
        ))}
      </div>
    );
  };

  const previousButton = (
    <button
      aria-label={messages.dateTimePicker.previousMonth}
      className={navButtonClassName}
      onClick={() => pageMonths(-1)}
      type="button"
    >
      <ChevronLeft size={20} />
    </button>
  );

  const nextButton = (
    <button
      aria-label={messages.dateTimePicker.nextMonth}
      className={navButtonClassName}
      onClick={() => pageMonths(1)}
      type="button"
    >
      <ChevronRight size={20} />
    </button>
  );

  // Where a month has no navigation button - keeps its title centered
  const buttonSpace = <span aria-hidden="true" className="size-7" />;
  // Each month as wide as the popup, or two of the same width
  const columnClassName = months > 1 ? "w-64" : "flex-1";

  // The navigation of all months in one row above them - Tab reaches every
  // button before the days, whichever month has the tab stop
  return (
    <div onKeyDown={handleKeyDown} ref={gridRef}>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="mb-2 flex gap-4">
        {shownMonths.map((shownMonth, index) => (
          <div
            className={cn(
              "flex items-center justify-between gap-1",
              columnClassName,
            )}
            key={index}
          >
            {index === 0 ? previousButton : buttonSpace}
            {index === 0 ? (
              // The selects of the first month jump far, e.g. to a birth date
              <div className="flex items-center">
                <select
                  aria-label={messages.dateTimePicker.month}
                  className={selectClassName}
                  onChange={(event) =>
                    showMonth(shownYear, Number(event.target.value))
                  }
                  value={month.getMonth()}
                >
                  {monthNames.map((name, monthIndex) => (
                    <option key={name} value={monthIndex}>
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
            ) : (
              <div className="text-sm font-semibold">
                {formatMonthYear(shownMonth, locale.code)}
              </div>
            )}
            {index === months - 1 ? nextButton : buttonSpace}
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        {shownMonths.map((shownMonth, index) => (
          <div className={columnClassName} key={index}>
            {renderMonth(shownMonth)}
          </div>
        ))}
      </div>
    </div>
  );
}
