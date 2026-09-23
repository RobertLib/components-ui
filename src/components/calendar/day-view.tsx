import type { CalendarEvent, CalendarViewProps } from "./types";
import { getSlotStart, minutesIntoDay } from "./date-utils";
import {
  calculateOverlapPositions,
  clickableTileProps,
  getColorStyles,
  getEventTooltipText,
  getVisibleMinutes,
  isOnDay,
  spansMidnight,
} from "./utils";
import { useCallback, useMemo, useRef } from "react";
import cn from "../../utils/cn";
import EventActions from "./event-actions";
import EventTitle from "./event-title";
import Spinner from "../spinner";
import useEventDrag, { type DragType } from "./use-event-drag";
import useSlotDrag from "./use-slot-drag";
import useSlotFocus from "./use-slot-focus";
import {
  addDays,
  formatDate,
  formatPattern,
  startOfDay,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

export default function DayView({
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
  const SLOT_HEIGHT = 128; // 128px per hour
  const SLOT_DURATION = 60; // 60 minutes per slot (1 hour)
  const START_HOUR = dayStartHour;
  const END_HOUR = dayEndHour;

  const locale = useLocale();
  const gridRef = useRef<HTMLDivElement>(null);

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

  const {
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

  // Rows from the start hour to the end hour (inclusive)
  const hours = Array.from(
    { length: END_HOUR - START_HOUR + 1 },
    (_, i) => i + START_HOUR,
  );

  const dayStart = startOfDay(currentDate);
  const isDisabled =
    (minDate && addDays(dayStart, 1) <= minDate) ||
    (maxDate && dayStart > maxDate);

  // Also the events that began on an earlier day and run into this one
  const dayEvents = useMemo(
    () => events.filter((event) => isOnDay(event, currentDate)),
    [currentDate, events],
  );

  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const timedEvents = dayEvents.filter((event) => !event.allDay);

  const formattedDate = formatDate(currentDate, locale.formats.date);

  // The keyboard way to `onDateClick` - the hours are one tab stop, the
  // arrow keys move between them
  const slotFocus = useSlotFocus({
    days: 1,
    gridRef,
    initialDay: 0,
    onActivate: (_, slot) => {
      if (isDisabled) return;
      onDateClick?.(getSlotStart(currentDate, hours[slot], 0, SLOT_DURATION));
    },
    slots: hours.length,
  });

  const slotLabelFormat = new Intl.DateTimeFormat(locale.code, {
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <div
      className={cn(
        "day-view relative",
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

      {allDayEvents.length > 0 && (
        <div className="sticky top-0 z-10 flex items-center border-b border-neutral-200 bg-surface p-2 dark:border-neutral-800 dark:bg-surface-dark">
          <div
            className={cn(
              "bg-primary-50 p-2 text-center dark:bg-primary-900/30",
              isDisabled && "opacity-60",
            )}
          >
            <div className="font-medium">{formattedDate}</div>
            <div className="mt-2 space-y-1">
              {allDayEvents.map((event) => (
                <div
                  className={cn(
                    "group/event relative rounded border-l-2 px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    ...getColorStyles(event.color),
                    isClickable(event) ? "cursor-pointer" : "cursor-default",
                  )}
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  title={getEventTooltipText(event)}
                  {...(isClickable(event)
                    ? clickableTileProps(() => handleEventClick(event))
                    : {})}
                >
                  {renderEventActions && (
                    <EventActions>{renderEventActions(event)}</EventActions>
                  )}

                  {/* Optional custom icon renderer */}
                  {renderEventIcon?.(event)}
                  <EventTitle event={event}>
                    {`${event.title} (${locale.messages.calendar.allDay})`}
                  </EventTitle>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[60px_1fr]">
        <div className="time-column">
          {hours.map((hour) => (
            <div
              className="relative h-32 border-r border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800"
              key={hour}
            >
              <span className="absolute top-1 right-2">
                {formatPattern(locale.formats.time, {
                  hours: hour,
                  minutes: 0,
                })}
              </span>
            </div>
          ))}
        </div>

        <div
          className="relative"
          onKeyDown={onDateClick ? slotFocus.handleKeyDown : undefined}
          ref={gridRef}
        >
          {hours.map((hour, index) => {
            const handleSlotClick = () => {
              // Don't trigger click if we just finished dragging
              if (wasSlotDragged()) {
                resetSlotDragged();
                return;
              }
              if (isDisabled) return;
              onDateClick?.(getSlotStart(currentDate, hour, 0, SLOT_DURATION));
            };

            const handleSlotPointerDown = (e: React.PointerEvent) => {
              if (isDisabled || !onSlotDragEnd) return;
              handleSlotDragStart(
                e,
                getSlotStart(currentDate, hour, 0, SLOT_DURATION),
              );
            };

            return (
              <div
                className={cn(
                  "h-32 border-r border-b border-neutral-200 dark:border-neutral-800",
                  !isDisabled &&
                    (onDateClick || onSlotDragEnd) &&
                    "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
                  onDateClick &&
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-inset",
                )}
                key={hour}
                onClick={handleSlotClick}
                onPointerDown={handleSlotPointerDown}
                {...(onDateClick && {
                  "aria-disabled": isDisabled || undefined,
                  "aria-label": slotLabelFormat.format(
                    getSlotStart(currentDate, hour, 0, SLOT_DURATION),
                  ),
                  "data-slot": `0-${index}`,
                  role: "button",
                  tabIndex: slotFocus.isFocused(0, index) ? 0 : -1,
                })}
              />
            );
          })}

          {/* Slot drag preview */}
          {slotDragState && (
            <div
              className="pointer-events-none absolute right-1 left-1 rounded-md border-2 border-dashed border-primary-500 bg-primary-100/50 dark:bg-primary-900/50"
              style={{
                // Wall-clock minutes, like the event tiles - also over a
                // daylight saving change
                top: `${((minutesIntoDay(currentDate, slotDragState.startDate) - START_HOUR * 60) / SLOT_DURATION) * SLOT_HEIGHT}px`,
                height: `${((minutesIntoDay(currentDate, slotDragState.currentEndDate) - minutesIntoDay(currentDate, slotDragState.startDate)) / SLOT_DURATION) * SLOT_HEIGHT}px`,
              }}
            />
          )}

          {(() => {
            // Only the events within or overlapping the hour range, cut to it
            const tiles = timedEvents.flatMap((event) => {
              const { start, end } = getEventDisplayTimes(event);
              const minutes = getVisibleMinutes(
                start,
                end,
                currentDate,
                START_HOUR,
                END_HOUR,
              );
              return minutes ? [{ end, event, minutes, start }] : [];
            });
            // Laid out by the times shown - a dragged event by where it is
            // dragged to
            const overlapPositions = calculateOverlapPositions(
              tiles.map(({ end, event, start }) => ({ ...event, end, start })),
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
                    "group/event absolute overflow-hidden rounded-md border-l-2 px-2 py-1 text-xs leading-tight select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    ...getColorStyles(event.color),
                    eventIsDragging &&
                      "opacity-80 shadow-lg ring-2 ring-primary-500",
                    canMove
                      ? // A finger on it drags, it does not scroll the view
                        "cursor-move touch-none"
                      : eventClickable
                        ? "cursor-pointer"
                        : "cursor-default",
                    isAnyDragging && !eventIsDragging && "pointer-events-none",
                  )}
                  key={event.id}
                  onClick={() => {
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
                    <div className="truncate font-medium">{event.title}</div>
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
      </div>
    </div>
  );
}
