import type { CalendarEvent, CalendarViewProps } from "./types";
import { getSlotStart, isSameDay, minutesIntoDay } from "./date-utils";
import {
  calculateOverlapPositions,
  clickableTileProps,
  getColorStyles,
  getEventTooltipText,
  getVisibleMinutes,
  isOnDay,
  spansMidnight,
} from "./utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cn from "../../utils/cn";
import EventActions from "./event-actions";
import EventTitle from "./event-title";
import Spinner from "../spinner";
import useEventDrag, { type DragType } from "./use-event-drag";
import useSlotDrag from "./use-slot-drag";
import useSlotFocus from "./use-slot-focus";
import {
  addDays,
  formatPattern,
  getWeekdayNames,
  startOfWeek,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

export default function WeekView({
  currentDate,
  dayEndHour,
  dayStartHour,
  events,
  isEventClickable,
  loading,
  maxDate,
  minDate,
  onDateClick,
  onEventClick,
  onEventDrop,
  onEventResize,
  onSlotDragEnd,
  renderEventActions,
  renderEventIcon,
  stickyHeader = true,
}: CalendarViewProps) {
  const SLOT_HEIGHT = 64; // 64px per 30-minute slot
  const SLOT_DURATION = 30; // 30 minutes per slot
  const START_HOUR = dayStartHour;
  const END_HOUR = dayEndHour;

  const locale = useLocale();
  const weekdayNames = getWeekdayNames(locale.code, locale.weekStartsOn);

  const [dayColumnWidth, setDayColumnWidth] = useState(0);

  // The width of a day column - for dragging an event onto another day. The
  // grid also changes width without the window, e.g. as the drawer collapses.
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measureWidth = () => setDayColumnWidth(grid.offsetWidth / 7);
    measureWidth();

    const observer = new ResizeObserver(measureWidth);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const isClickable = useCallback(
    (event: CalendarEvent) =>
      !!onEventClick && (isEventClickable?.(event) ?? true),
    [isEventClickable, onEventClick],
  );

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      if (!isClickable(event)) return;
      onEventClick?.(event);
    },
    [isClickable, onEventClick],
  );

  const weekDays = useMemo(() => {
    const days = [];
    const firstDayOfWeek = startOfWeek(currentDate, locale.weekStartsOn);

    for (let i = 0; i < 7; i++) {
      const date = addDays(firstDayOfWeek, i);

      const isDisabled =
        (minDate && addDays(date, 1) <= minDate) || (maxDate && date > maxDate);

      days.push({
        date,
        disabled: isDisabled,
        isSelected: isSameDay(date, currentDate),
      });
    }

    return days;
  }, [currentDate, locale.weekStartsOn, maxDate, minDate]);

  // Events can be dropped on the enabled days of the week only
  const dropDays = useMemo(() => {
    const enabledDays = weekDays.filter((day) => !day.disabled);
    if (enabledDays.length === 0) return undefined;
    return {
      first: enabledDays[0].date,
      last: enabledDays[enabledDays.length - 1].date,
    };
  }, [weekDays]);

  const {
    dragState,
    handleDragStart,
    getEventDisplayTimes,
    isDragging,
    isAnyDragging,
    wasDragged,
    resetWasDragged,
  } = useEventDrag({
    slotHeight: SLOT_HEIGHT,
    slotDurationMinutes: SLOT_DURATION,
    startHour: START_HOUR,
    endHour: END_HOUR,
    dayColumnWidth,
    dropDays,
    onEventDrop,
    onEventResize,
  });

  const {
    slotDragState,
    handleSlotDragStart,
    wasSlotDragged,
    resetSlotDragged,
  } = useSlotDrag({
    slotHeight: SLOT_HEIGHT,
    slotDurationMinutes: SLOT_DURATION,
    endHour: END_HOUR,
    onSlotDragEnd,
  });

  const handleEventPointerDown = useCallback(
    (e: React.PointerEvent, event: CalendarEvent, type: DragType) => {
      if (!onEventDrop && !onEventResize) return;
      handleDragStart(e, event, type);
    },
    [handleDragStart, onEventDrop, onEventResize],
  );
  // 30-minute slots from the start hour to the end hour (inclusive)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      slots.push({ hour, minute: 0 });
      slots.push({ hour, minute: 30 });
    }
    // Add the final slot of the end hour
    slots.push({ hour: END_HOUR, minute: 0 });
    return slots;
  }, [END_HOUR, START_HOUR]);

  // The day and time of a slot
  const slotStart = (dayIndex: number, slotIndex: number) =>
    getSlotStart(
      weekDays[dayIndex].date,
      timeSlots[slotIndex].hour,
      timeSlots[slotIndex].minute,
      SLOT_DURATION,
    );

  // The keyboard way to `onDateClick` - one tab stop, arrow keys between the
  // slots and the days
  const slotFocus = useSlotFocus({
    days: 7,
    gridRef,
    initialDay: Math.max(
      weekDays.findIndex((day) => day.isSelected),
      0,
    ),
    onActivate: (dayIndex, slotIndex) => {
      if (weekDays[dayIndex].disabled) return;
      onDateClick?.(slotStart(dayIndex, slotIndex));
    },
    slots: timeSlots.length,
  });

  const slotLabelFormat = new Intl.DateTimeFormat(locale.code, {
    dateStyle: "full",
    timeStyle: "short",
  });
  const dayLabelFormat = new Intl.DateTimeFormat(locale.code, {
    dateStyle: "full",
  });

  // Get events for a specific day, considering drag state
  const getEventsForDay = useCallback(
    (dayDate: Date): CalendarEvent[] => {
      return events.filter((event) => {
        // If this event is being dragged, use the current drag position
        if (dragState && dragState.event.id === event.id) {
          return isOnDay(
            { end: dragState.currentEnd, start: dragState.currentStart },
            dayDate,
          );
        }
        // Also the days a timed event runs into past midnight
        return isOnDay(event, dayDate);
      });
    },
    [events, dragState],
  );

  // Minimum width per day column on mobile (in pixels)
  const MIN_DAY_COLUMN_WIDTH = 100;
  const TOTAL_MIN_WIDTH = MIN_DAY_COLUMN_WIDTH * 7; // 700px minimum for all 7 days

  return (
    <div
      className={cn(
        "week-view relative",
        // No text selected along a drag over the slots
        slotDragState && "select-none",
        stickyHeader ? "h-150 overflow-y-auto" : "overflow-auto",
      )}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      <div
        className="sticky top-0 z-10 grid grid-cols-[60px_1fr] bg-surface dark:bg-surface-dark"
        style={{ minWidth: `${60 + TOTAL_MIN_WIDTH}px` }}
      >
        <div className="sticky left-0 z-11 border-r border-neutral-200 bg-surface dark:border-neutral-800 dark:bg-surface-dark" />
        <div
          className="grid grid-cols-7"
          style={{ minWidth: `${TOTAL_MIN_WIDTH}px` }}
        >
          {weekDays.map((day, index) => {
            const date = day.date.getDate();
            const month = day.date.toLocaleString(locale.code, {
              month: "short",
            });
            // Like the month view: on each day the event spans
            const allDayEvents = events.filter(
              (event) => event.allDay && isOnDay(event, day.date),
            );
            const dateClassName = cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full",
              day.isSelected && "bg-primary-500 text-white",
            );

            return (
              <div
                className={cn(
                  "border-r border-neutral-200 p-2 text-center dark:border-neutral-800",
                  day.isSelected && "bg-primary-50 dark:bg-primary-900/30",
                  day.disabled && "opacity-60",
                  !day.disabled &&
                    onDateClick &&
                    "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
                )}
                key={index}
                onClick={() => !day.disabled && onDateClick?.(day.date)}
              >
                <div className="font-medium">{weekdayNames[index]}</div>
                {onDateClick && !day.disabled ? (
                  // The keyboard way to the day - its click reaches the header
                  <button
                    aria-label={dayLabelFormat.format(day.date)}
                    className={cn(
                      dateClassName,
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    )}
                    type="button"
                  >
                    {date}
                  </button>
                ) : (
                  <div className={dateClassName}>{date}</div>
                )}
                <div className="text-xs text-neutral-500">{month}</div>

                {allDayEvents.length > 0 && (
                  <div className="mt-1 space-y-1 text-left">
                    {allDayEvents.map((event) => (
                      <div
                        className={cn(
                          "group/event relative truncate rounded border-l-2 px-1 py-0.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                          ...getColorStyles(event.color),
                          isClickable(event)
                            ? "cursor-pointer"
                            : "cursor-default",
                        )}
                        key={event.id}
                        onClick={(e) => {
                          // Not a click on the day as well
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                        title={getEventTooltipText(event)}
                        {...(isClickable(event)
                          ? clickableTileProps(() => handleEventClick(event))
                          : {})}
                      >
                        {renderEventActions && (
                          <EventActions>
                            {renderEventActions(event)}
                          </EventActions>
                        )}

                        {/* Optional custom icon renderer */}
                        {renderEventIcon?.(event)}
                        <EventTitle event={event}>{event.title}</EventTitle>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="grid grid-cols-[60px_1fr]"
        style={{ minWidth: `${60 + TOTAL_MIN_WIDTH}px` }}
      >
        <div className="time-column sticky left-0 z-10 bg-surface dark:bg-surface-dark">
          {timeSlots.map((timeSlot, index) => (
            <div
              className="relative h-16 border-r border-b border-neutral-200 bg-surface text-xs text-neutral-500 dark:border-neutral-800 dark:bg-surface-dark"
              key={index}
            >
              <span className="absolute top-1 right-2">
                {formatPattern(locale.formats.time, {
                  hours: timeSlot.hour,
                  minutes: timeSlot.minute,
                })}
              </span>
            </div>
          ))}
        </div>

        <div
          className="grid grid-cols-7"
          onKeyDown={onDateClick ? slotFocus.handleKeyDown : undefined}
          ref={gridRef}
          style={{ minWidth: `${TOTAL_MIN_WIDTH}px` }}
        >
          {weekDays.map((day, dayIndex) => (
            <div className="day-column relative" key={dayIndex}>
              {timeSlots.map((_, index) => {
                const handleSlotClick = () => {
                  // Don't trigger click if we just finished dragging
                  if (wasSlotDragged()) {
                    resetSlotDragged();
                    return;
                  }
                  if (day.disabled) return;
                  onDateClick?.(slotStart(dayIndex, index));
                };

                const handleSlotPointerDown = (e: React.PointerEvent) => {
                  if (day.disabled || !onSlotDragEnd) return;
                  handleSlotDragStart(e, slotStart(dayIndex, index));
                };

                return (
                  <div
                    className={cn(
                      "h-16 border-r border-b border-neutral-200 dark:border-neutral-800",
                      !day.disabled &&
                        (onDateClick || onSlotDragEnd) &&
                        "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
                      onDateClick &&
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-inset",
                    )}
                    key={index}
                    onClick={handleSlotClick}
                    onPointerDown={handleSlotPointerDown}
                    {...(onDateClick && {
                      "aria-disabled": day.disabled || undefined,
                      "aria-label": slotLabelFormat.format(
                        slotStart(dayIndex, index),
                      ),
                      "data-slot": `${dayIndex}-${index}`,
                      role: "button",
                      tabIndex: slotFocus.isFocused(dayIndex, index) ? 0 : -1,
                    })}
                  />
                );
              })}

              {/* Slot drag preview */}
              {slotDragState &&
                isSameDay(slotDragState.startDate, day.date) && (
                  <div
                    className="pointer-events-none absolute right-1 left-1 rounded-md border-2 border-dashed border-primary-500 bg-primary-100/50 dark:bg-primary-900/50"
                    style={{
                      // Wall-clock minutes, like the event tiles - also
                      // over a daylight saving change
                      top: `${((minutesIntoDay(day.date, slotDragState.startDate) - START_HOUR * 60) / SLOT_DURATION) * SLOT_HEIGHT}px`,
                      height: `${((minutesIntoDay(day.date, slotDragState.currentEndDate) - minutesIntoDay(day.date, slotDragState.startDate)) / SLOT_DURATION) * SLOT_HEIGHT}px`,
                    }}
                  />
                )}

              {(() => {
                // Only the events within or overlapping the hour range, cut
                // to it
                const tiles = getEventsForDay(day.date).flatMap((event) => {
                  if (event.allDay) return [];
                  const { start, end } = getEventDisplayTimes(event);
                  const minutes = getVisibleMinutes(
                    start,
                    end,
                    day.date,
                    START_HOUR,
                    END_HOUR,
                  );
                  return minutes ? [{ end, event, minutes, start }] : [];
                });
                // Laid out by the times shown - a dragged event by where it
                // is dragged to
                const overlapPositions = calculateOverlapPositions(
                  tiles.map(({ end, event, start }) => ({
                    ...event,
                    end,
                    start,
                  })),
                );

                return tiles.map(({ event, minutes }) => {
                  const top =
                    ((minutes.from - START_HOUR * 60) / SLOT_DURATION) *
                    SLOT_HEIGHT;
                  const height =
                    ((minutes.to - minutes.from) / SLOT_DURATION) * SLOT_HEIGHT;

                  const eventIsDragging = isDragging(event.id);
                  const eventClickable = isClickable(event);
                  // One day's grid cannot move or resize an event over several
                  const canDrag = !spansMidnight(event);
                  const canMove = !!onEventDrop && canDrag;
                  const canResize = !!onEventResize && canDrag;

                  // Calculate horizontal positioning for overlapping events
                  // First event takes full width, subsequent events are layered on top with offset
                  const overlapInfo = overlapPositions.get(event.id);
                  const index = overlapInfo?.index ?? 0;
                  const totalInGroup = overlapInfo?.totalInGroup ?? 1;

                  // Each subsequent event is offset to the right by a portion of the width
                  // e.g., with 2 events: first is full width, second starts at 50%
                  const leftPercent =
                    totalInGroup > 1 ? (index * 50) / (totalInGroup - 1) : 0;
                  const widthPercent = 100 - leftPercent;

                  return (
                    <div
                      className={cn(
                        "group/event absolute overflow-hidden rounded-md border-l-2 px-1 py-1 text-xs leading-tight outline-[1.5px] outline-surface select-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:outline-surface-dark",
                        ...getColorStyles(event.color),
                        eventIsDragging &&
                          "opacity-80 shadow-lg ring-2 ring-primary-500",
                        canMove
                          ? // A finger on it drags, it does not scroll the view
                            "cursor-move touch-none"
                          : eventClickable
                            ? "cursor-pointer"
                            : "cursor-default",
                        isAnyDragging &&
                          !eventIsDragging &&
                          "pointer-events-none",
                      )}
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Don't trigger click if we just finished dragging
                        if (wasDragged()) {
                          resetWasDragged();
                          return;
                        }
                        handleEventClick(event);
                      }}
                      onPointerDown={(e) => {
                        if (canMove) {
                          handleEventPointerDown(e, event, "move");
                        }
                      }}
                      style={{
                        height: `${height}px`,
                        top: `${top}px`,
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        zIndex: index + 1,
                      }}
                      title={getEventTooltipText(event)}
                      {...(eventClickable
                        ? clickableTileProps(() => handleEventClick(event))
                        : {})}
                    >
                      {/* Resize handle - top */}
                      {canResize && (
                        <div
                          className="absolute top-0 right-0 left-0 z-10 h-2 cursor-ns-resize touch-none hover:bg-black/10"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            handleEventPointerDown(e, event, "resize-top");
                          }}
                        />
                      )}

                      {renderEventActions && (
                        <EventActions>{renderEventActions(event)}</EventActions>
                      )}

                      {/* Optional custom icon renderer */}
                      {renderEventIcon?.(event)}

                      <EventTitle event={event}>
                        <div className="truncate font-medium">
                          {event.title}
                        </div>
                      </EventTitle>

                      {/* Resize handle - bottom */}
                      {canResize && (
                        <div
                          className="absolute right-0 bottom-0 left-0 z-10 h-2 cursor-ns-resize touch-none hover:bg-black/10"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            handleEventPointerDown(e, event, "resize-bottom");
                          }}
                        />
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
