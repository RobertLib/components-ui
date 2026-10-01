import type { CalendarEvent, CalendarViewProps } from "./types";
import { useEffect, useMemo, useRef, useState } from "react";
import cn from "../../utils/cn";
import DateCell from "./date-cell";
import Spinner from "../spinner";
import {
  addCalendarDays,
  daysIntoWeek,
  getCalendarDay,
  getVisibleRange,
  skipHiddenDays,
} from "./date-utils";
import { createDayGeometry, type DayCell } from "./move-geometry";
import { hasBusinessHours } from "./business-hours";
import {
  createDayFormat,
  createTimeLabeler,
  createTimeTextFormatter,
  isOnDay,
  isRtl,
  revealFocus,
} from "./utils";
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
import useEventMove from "./use-event-move";
import useIsApplePlatform from "../../hooks/use-is-apple-platform";
import useToday from "../../hooks/use-today";
import { toAriaKeyShortcuts } from "../../utils/shortcut";
import { useLocale } from "../../providers/ui-context";

/** Days the arrow keys go by - left and right swap in a right-to-left page. */
const DAY_KEYS: Record<string, number> = {
  ArrowDown: 7,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
};

/** The day of a day button (`data-day`). */
const dayOf = (target: EventTarget | null) =>
  target instanceof HTMLElement ? parseISODate(target.dataset.day) : null;

/** A day of the grid of the month. */
interface MonthDay {
  date: Date;
  /** Out of `minDate` - `maxDate`. */
  disabled: boolean;
  /** The events of the day - a moved one on the days it is moved to. */
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isSelected: boolean;
}

export default function MonthView({
  announce,
  businessHours,
  currentDate,
  events,
  getEventColor,
  getEventLabel,
  hiddenDays,
  isEventClickable,
  loading,
  maxDate,
  minDate,
  onDateClick,
  onEventClick,
  onEventDrop,
  onNavigate,
  renderEvent,
  renderEventActions,
  renderEventIcon,
  resources,
  restrictToBusinessHours,
  stickyHeader = true,
  view,
}: CalendarViewProps) {
  const locale = useLocale();
  // The columns - the days of the week in its order, without the hidden
  // ones
  const shownColumns = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => index).filter(
        (index) => !hiddenDays.has((locale.weekStartsOn + index) % 7),
      ),
    [hiddenDays, locale.weekStartsOn],
  );
  const weekdayNames = getWeekdayNames(locale.code, locale.weekStartsOn);
  const longWeekdayNames = getWeekdayNames(
    locale.code,
    locale.weekStartsOn,
    "long",
  );
  const columnCount = shownColumns.length;
  // Seven columns by the class, fewer by their style
  const columnsStyle =
    columnCount === 7
      ? undefined
      : { gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` };

  const gridRef = useRef<HTMLDivElement>(null);
  // The weekdays stay on top of the scrolling month - the focus below them
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const timeLabel = useMemo(
    () => createTimeLabeler(locale, resources),
    [locale, resources],
  );
  const timeText = useMemo(() => createTimeTextFormatter(locale), [locale]);

  const move = useEventMove({
    announce,
    describe: (event, display) =>
      timeLabel({ allDay: event.allDay, ...display }),
    events,
    geometryKey: JSON.stringify([
      currentDate.getFullYear(),
      currentDate.getMonth(),
      locale.weekStartsOn,
      shownColumns,
      minDate,
      maxDate,
    ]),
    onEventDrop,
    scrollRef,
  });
  const { dragState, getEventDisplayTimes } = move;

  // The key that picks an event up - for `aria-keyshortcuts`
  const isApple = useIsApplePlatform();
  const moveShortcut = toAriaKeyShortcuts("mod+x", isApple);

  const weeks = useMemo(() => {
    const result: (MonthDay | null)[][] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Counted from the 1st, a day no time zone skips - and the days before
    // it in its week
    const firstOfMonth = dateOf(year, month, 1);
    const leading = daysIntoWeek(firstOfMonth, locale.weekStartsOn);

    // Where the events are shown - a moved one where it would go
    const displayOf = (event: CalendarEvent) =>
      dragState?.event.id === event.id
        ? { allDay: event.allDay, end: dragState.end, start: dragState.start }
        : event;

    for (let i = 0; i < 6; i++) {
      const week: (MonthDay | null)[] = [];
      for (const j of shownColumns) {
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
          isOnDay(displayOf(event), date),
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
  }, [
    currentDate,
    dragState,
    events,
    locale.weekStartsOn,
    maxDate,
    minDate,
    shownColumns,
  ]);

  // The days an event can be moved to, row by row
  const cells = useMemo<(DayCell | null)[]>(
    () =>
      weeks
        .flat()
        .map((day) => (day ? { day: day.date, disabled: day.disabled } : null)),
    [weeks],
  );

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

  if (
    focusedMonth.getMonth() !== currentDate.getMonth() ||
    focusedMonth.getFullYear() !== currentDate.getFullYear()
  ) {
    setFocusedMonth(currentDate);
    setFocusedDate(startOfDay(currentDate));
  }

  // A hidden day has no button - the next day shown has the tab stop
  const tabStopDate = skipHiddenDays(focusedDate, hiddenDays);

  // The tab stop takes the focus - also after Page Up / Down onto a hidden
  // day, where the button in its place of the grid shows another day
  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;

    gridRef.current
      ?.querySelector<HTMLElement>(`[data-day="${toISODate(tabStopDate)}"]`)
      ?.focus();
  }, [tabStopDate]);

  // A day button focused by a click or a screen reader - the tab stop and
  // the arrow keys go on from it. One focused by the keyboard shows below
  // the weekdays.
  const handleGridFocus = (event: React.FocusEvent) => {
    revealFocus(
      event.target,
      scrollRef.current,
      stickyHeader ? (headerRef.current?.offsetHeight ?? 0) : 0,
    );

    const day = dayOf(event.target);
    if (day && !isSameDay(day, focusedDate)) setFocusedDate(day);
  };

  // The focus left the grid - for the header, the date field. A month that
  // Page Up / Down asked for and a controlled `currentDate` did not take
  // must not pull it back when the month changes another way.
  const handleGridBlur = (event: React.FocusEvent) => {
    if (!(
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    )) {
      moveFocusRef.current = false;
    }
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
      // The day of the new month takes the focus - unless the calendar
      // stays, at `minDate` / `maxDate`
      moveFocusRef.current = true;
      if (!onNavigate(addMonths(day, offset))) moveFocusRef.current = false;
      return;
    }

    // Left and right swap in a right-to-left page
    const step =
      event.key in DAY_KEYS
        ? DAY_KEYS[event.key] *
          ((event.key === "ArrowLeft" || event.key === "ArrowRight") &&
          isRtl(event.currentTarget)
            ? -1
            : 1)
        : 0;
    const direction = step < 0 ? -1 : 1;

    // Over a day the time zone skips - in the week, towards `day` - and
    // over the hidden days, to the next one shown
    const offset = daysIntoWeek(day, locale.weekStartsOn);
    const next =
      step !== 0
        ? skipHiddenDays(shiftDay(day, step), hiddenDays, direction)
        : event.key === "Home"
          ? skipHiddenDays(shiftDay(day, -offset, 1), hiddenDays)
          : event.key === "End"
            ? skipHiddenDays(shiftDay(day, 6 - offset, -1), hiddenDays, -1)
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
  // clock and time zone may differ from the browser's. Another day after
  // midnight, also in a view left open.
  const today = useToday();
  // A grid the arrow keys move in with the day buttons - a table of the
  // days without them
  const isGrid = !!onDateClick;
  const canMove = !!onEventDrop;

  // How an event moves over the days of the month - from its tile in the
  // cell `index`
  const dayGeometry = (event: CalendarEvent, index: number) =>
    createDayGeometry({
      cells,
      columns: columnCount,
      event,
      grid: gridRef.current,
      hasResources: false,
      index,
      maxDate,
      minDate,
      rtl: isRtl(scrollRef.current),
    });

  return (
    <div
      className={cn(
        "relative",
        stickyHeader ? "h-150 overflow-y-auto" : "h-full",
      )}
      ref={scrollRef}
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
          ref={headerRef}
          role="row"
          style={columnsStyle}
        >
          {shownColumns.map((index) => (
            <div
              aria-label={longWeekdayNames[index]}
              className="p-2 text-center font-medium text-neutral-500 dark:text-neutral-400"
              key={index}
              role="columnheader"
            >
              {weekdayNames[index]}
            </div>
          ))}
        </div>

        <div
          className={cn("grid grid-rows-6", !stickyHeader && "h-full")}
          onBlur={handleGridBlur}
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
              style={columnsStyle}
            >
              {week.map((day, j) => {
                if (day === null) {
                  return (
                    <div
                      className="border-e border-neutral-200 dark:border-neutral-800"
                      key={`${i}-${j}`}
                      role={isGrid ? "gridcell" : "cell"}
                    />
                  );
                }

                const index = i * columnCount + j;
                const offHours =
                  !!businessHours && !hasBusinessHours(businessHours, day.date);

                return (
                  <DateCell
                    canMove={canMove}
                    date={day.date}
                    disabled={day.disabled}
                    draggingId={dragState?.event.id ?? null}
                    events={day.events}
                    getEventColor={getEventColor}
                    getEventLabel={getEventLabel}
                    isCurrentMonth={day.isCurrentMonth}
                    isEventClickable={isEventClickable}
                    isFocusTarget={isSameDay(day.date, tabStopDate)}
                    isPointerDragging={move.isPointerDragging}
                    isSelected={day.isSelected}
                    isToday={today !== null && isSameDay(day.date, today)}
                    key={`${i}-${j}`}
                    label={dayLabelFormat.format(day.date)}
                    moveShortcut={moveShortcut}
                    offHours={offHours}
                    onDateClick={onDateClick}
                    onEventClick={onEventClick}
                    onTileBlur={move.handleBlur}
                    onTileKeyDown={(e, event) =>
                      move.handleKeyDown(e, event, {
                        clickable:
                          !!onEventClick && (isEventClickable?.(event) ?? true),
                        day: day.date,
                        getGeometry: (type) =>
                          type === "move" ? dayGeometry(event, index) : null,
                      })
                    }
                    onTilePointerDown={(e, event) =>
                      move.handleDragStart(
                        e,
                        event,
                        "move",
                        dayGeometry(event, index),
                      )
                    }
                    pickable={
                      !day.disabled && !(restrictToBusinessHours && offHours)
                    }
                    renderEvent={renderEvent}
                    renderEventActions={renderEventActions}
                    renderEventIcon={renderEventIcon}
                    role={isGrid ? "gridcell" : "cell"}
                    timeText={(event) =>
                      timeText({
                        allDay: event.allDay,
                        ...getEventDisplayTimes(event),
                      })
                    }
                    view={view}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
