import type { CalendarViewProps } from "./types";
import { useEffect, useMemo, useRef, useState } from "react";
import cn from "../../utils/cn";
import DateCell from "./date-cell";
import Spinner from "../spinner";
import { isOnDay } from "./utils";
import {
  addDays,
  getWeekdayNames,
  isSameDay,
  startOfDay,
  startOfWeek,
  toISODate,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

const DAY_KEYS: Record<string, number> = {
  ArrowDown: 7,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
};

export default function MonthView({
  currentDate,
  events,
  isEventClickable,
  loading,
  maxDate,
  minDate,
  onDateClick,
  onEventClick,
  renderEventActions,
  renderEventIcon,
  stickyHeader = true,
}: CalendarViewProps) {
  const locale = useLocale();
  const weekdayNames = getWeekdayNames(locale.code, locale.weekStartsOn);

  const weeks = useMemo(() => {
    const result = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    let iterationDate = startOfWeek(
      new Date(year, month, 1),
      locale.weekStartsOn,
    );

    for (let i = 0; i < 6; i++) {
      const week = [];
      for (let j = 0; j < 7; j++) {
        const dayStart = startOfDay(iterationDate);
        const dayEnd = addDays(dayStart, 1);

        const isCurrentMonth =
          iterationDate.getMonth() === month &&
          iterationDate.getFullYear() === year;

        const isDisabled =
          (minDate && dayEnd <= minDate) || (maxDate && dayStart > maxDate);

        // On every day an event spans - also a timed one past midnight. The
        // end is exclusive: an event ending at midnight is over before that
        // day starts.
        const date = new Date(iterationDate);
        const dayEvents = (events || []).filter((event) =>
          isOnDay(event, date),
        );

        week.push({
          date,
          disabled: !!isDisabled,
          events: dayEvents,
          isCurrentMonth,
          isSelected: isSameDay(iterationDate, currentDate),
        });

        iterationDate = addDays(iterationDate, 1);
      }
      result.push(week);
    }

    return result;
  }, [currentDate, events, locale.weekStartsOn, maxDate, minDate]);

  const gridStart = weeks[0][0].date;
  const gridEnd = addDays(gridStart, 42);

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

  const handleGridKeyDown = (event: React.KeyboardEvent) => {
    // The day buttons only - not the events in the cells
    if (!(event.target as HTMLElement).dataset.day) return;

    const weekStart = startOfWeek(focusedDate, locale.weekStartsOn);
    const next =
      event.key in DAY_KEYS
        ? addDays(focusedDate, DAY_KEYS[event.key])
        : event.key === "Home"
          ? weekStart
          : event.key === "End"
            ? addDays(weekStart, 6)
            : null;

    if (!next) return;
    event.preventDefault();

    // The grid shows six weeks - the navigation of the header goes further
    if (next < gridStart || next >= gridEnd) return;

    moveFocusRef.current = true;
    setFocusedDate(next);
  };

  const dayLabelFormat = new Intl.DateTimeFormat(locale.code, {
    dateStyle: "full",
  });

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
        className={cn(
          "grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800",
          stickyHeader && "sticky top-0 z-10 bg-surface dark:bg-surface-dark",
        )}
      >
        {weekdayNames.map((day, index) => (
          <div
            className="p-2 text-center font-medium text-neutral-500 dark:text-neutral-400"
            key={index}
          >
            {day}
          </div>
        ))}
      </div>

      <div
        className={cn("grid grid-rows-6", !stickyHeader && "h-full")}
        onKeyDown={handleGridKeyDown}
        ref={gridRef}
      >
        {weeks.map((week, i) => (
          <div
            className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800"
            key={i}
          >
            {week.map((day, j) => (
              <DateCell
                date={day.date}
                disabled={day.disabled}
                events={day.events}
                isCurrentMonth={day.isCurrentMonth}
                isEventClickable={isEventClickable}
                isFocusTarget={isSameDay(day.date, focusedDate)}
                isSelected={day.isSelected}
                key={`${i}-${j}`}
                label={dayLabelFormat.format(day.date)}
                onDateClick={onDateClick}
                onEventClick={onEventClick}
                renderEventActions={renderEventActions}
                renderEventIcon={renderEventIcon}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
