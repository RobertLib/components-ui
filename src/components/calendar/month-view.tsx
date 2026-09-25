import type { CalendarViewProps } from "./types";
import { useEffect, useMemo, useRef, useState } from "react";
import cn from "../../utils/cn";
import DateCell from "./date-cell";
import Spinner from "../spinner";
import {
  addCalendarDays,
  daysIntoWeek,
  getCalendarDay,
  getVisibleRange,
} from "./date-utils";
import { createDayFormat, isOnDay } from "./utils";
import {
  addMonths,
  dateOf,
  formatMonthYear,
  getWeekdayNames,
  isSameDay,
  parseISODate,
  shiftDay,
  startOfDay,
  toISODate,
} from "../../utils/date";
import useIsHydrated from "../../hooks/use-is-hydrated";
import { useLocale } from "../../providers/ui-context";

const DAY_KEYS: Record<string, number> = {
  ArrowDown: 7,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
};

/** The day of a day button (`data-day`). */
const dayOf = (target: EventTarget | null) =>
  target instanceof HTMLElement ? parseISODate(target.dataset.day) : null;

export default function MonthView({
  currentDate,
  events,
  getEventColor,
  getEventLabel,
  isEventClickable,
  loading,
  maxDate,
  minDate,
  onDateClick,
  onEventClick,
  onNavigate,
  renderEventActions,
  renderEventIcon,
  stickyHeader = true,
}: CalendarViewProps) {
  const locale = useLocale();
  const weekdayNames = getWeekdayNames(locale.code, locale.weekStartsOn);
  const longWeekdayNames = getWeekdayNames(
    locale.code,
    locale.weekStartsOn,
    "long",
  );

  const weeks = useMemo(() => {
    const result = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Counted from the 1st, a day no time zone skips - and the days before
    // it in its week
    const firstOfMonth = dateOf(year, month, 1);
    const leading = daysIntoWeek(firstOfMonth, locale.weekStartsOn);

    for (let i = 0; i < 6; i++) {
      const week = [];
      for (let j = 0; j < 7; j++) {
        // Each day at its own start - also after one a daylight saving
        // change starts at 1:00 (Santiago, Havana). A day the time zone
        // skips as a whole is an empty cell.
        const date = getCalendarDay(firstOfMonth, i * 7 + j - leading);
        if (!date) {
          week.push(null);
          continue;
        }
        const dayEnd = addCalendarDays(date, 1);

        const isCurrentMonth =
          date.getMonth() === month && date.getFullYear() === year;

        const isDisabled =
          (minDate && dayEnd <= minDate) || (maxDate && date > maxDate);

        // On every day an event spans - also a timed one past midnight. The
        // end is exclusive: an event ending at midnight is over before that
        // day starts.
        const dayEvents = (events || []).filter((event) =>
          isOnDay(event, date),
        );

        week.push({
          date,
          disabled: !!isDisabled,
          events: dayEvents,
          isCurrentMonth,
          isSelected: isSameDay(date, currentDate),
        });
      }
      result.push(week);
    }

    return result;
  }, [currentDate, events, locale.weekStartsOn, maxDate, minDate]);

  // The six weeks of the grid - the keys do not leave them
  const { end: gridEnd, start: gridStart } = getVisibleRange(
    currentDate,
    "month",
    locale.weekStartsOn,
  );

  // The day button with the tab stop - the arrow keys move it, like in a
  // date picker. Another month starts at its selected day again.
  const [focusedDate, setFocusedDate] = useState(() => startOfDay(currentDate));
  const [focusedMonth, setFocusedMonth] = useState(currentDate);
  const moveFocusRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  if (
    focusedMonth.getMonth() !== currentDate.getMonth() ||
    focusedMonth.getFullYear() !== currentDate.getFullYear()
  ) {
    setFocusedMonth(currentDate);
    setFocusedDate(startOfDay(currentDate));
  }

  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;

    gridRef.current
      ?.querySelector<HTMLElement>(`[data-day="${toISODate(focusedDate)}"]`)
      ?.focus();
  }, [focusedDate]);

  // A day button focused by a click or a screen reader - the tab stop and
  // the arrow keys go on from it
  const handleGridFocus = (event: React.FocusEvent) => {
    const day = dayOf(event.target);
    if (day && !isSameDay(day, focusedDate)) setFocusedDate(day);
  };

  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    // The day buttons only - not the events in the cells
    const day = dayOf(event.target);
    if (!day) return;

    // Page Up / Down go to the same day of the previous / next month - with
    // Shift of the year - and the calendar along with it
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      if (!onNavigate) return;
      const offset =
        (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1);
      moveFocusRef.current = true;
      onNavigate(addMonths(day, offset));
      return;
    }

    // Over a day the time zone skips - in the week, towards `day`
    const offset = daysIntoWeek(day, locale.weekStartsOn);
    const next =
      event.key in DAY_KEYS
        ? shiftDay(day, DAY_KEYS[event.key])
        : event.key === "Home"
          ? shiftDay(day, -offset, 1)
          : event.key === "End"
            ? shiftDay(day, 6 - offset, -1)
            : null;

    if (!next) return;
    event.preventDefault();

    // The grid shows six weeks - the navigation of the header goes further
    if (next < gridStart || next >= gridEnd) return;

    moveFocusRef.current = true;
    setFocusedDate(next);
  };

  const dayLabelFormat = createDayFormat(locale);
  // Unknown on the server and while a server-rendered page hydrates - its
  // clock and time zone may differ from the browser's
  const isHydrated = useIsHydrated();
  const today = isHydrated ? new Date() : null;
  // A grid the arrow keys move in with the day buttons - a table of the
  // days without them
  const isGrid = !!onDateClick;

  return (
    <div
      className={cn(
        "relative",
        stickyHeader ? "h-150 overflow-y-auto" : "h-full",
      )}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      <div
        aria-label={formatMonthYear(currentDate, locale.code)}
        className={cn(!stickyHeader && "h-full")}
        role={isGrid ? "grid" : "table"}
      >
        <div
          className={cn(
            "grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800",
            stickyHeader && "sticky top-0 z-10 bg-surface dark:bg-surface-dark",
          )}
          role="row"
        >
          {weekdayNames.map((day, index) => (
            <div
              aria-label={longWeekdayNames[index]}
              className="p-2 text-center font-medium text-neutral-500 dark:text-neutral-400"
              key={index}
              role="columnheader"
            >
              {day}
            </div>
          ))}
        </div>

        <div
          className={cn("grid grid-rows-6", !stickyHeader && "h-full")}
          onFocus={handleGridFocus}
          onKeyDown={handleGridKeyDown}
          ref={gridRef}
          role="rowgroup"
        >
          {weeks.map((week, i) => (
            <div
              className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800"
              key={i}
              role="row"
            >
              {week.map((day, j) =>
                day === null ? (
                  <div
                    className="border-r border-neutral-200 dark:border-neutral-800"
                    key={`${i}-${j}`}
                    role={isGrid ? "gridcell" : "cell"}
                  />
                ) : (
                  <DateCell
                    date={day.date}
                    disabled={day.disabled}
                    events={day.events}
                    getEventColor={getEventColor}
                    getEventLabel={getEventLabel}
                    isCurrentMonth={day.isCurrentMonth}
                    isEventClickable={isEventClickable}
                    isFocusTarget={isSameDay(day.date, focusedDate)}
                    isSelected={day.isSelected}
                    isToday={today !== null && isSameDay(day.date, today)}
                    key={`${i}-${j}`}
                    label={dayLabelFormat.format(day.date)}
                    onDateClick={onDateClick}
                    onEventClick={onEventClick}
                    renderEventActions={renderEventActions}
                    renderEventIcon={renderEventIcon}
                    role={isGrid ? "gridcell" : "cell"}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
