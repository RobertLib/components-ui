import type { CalendarEvent, CalendarViewProps } from "./types";
import { addCalendarDays, getSlotStart } from "./date-utils";
import {
  createDayFormat,
  createSlotLabeler,
  formatTimeRange,
  getColorStyles,
  getEventTooltipText,
  getHiddenSide,
  isOnDay,
} from "./utils";
import { useCallback, useMemo, useRef } from "react";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";
import HiddenEvents from "./hidden-events";
import Spinner from "../spinner";
import TimeGrid from "./time-grid";
import TimedEvents from "./timed-events";
import useEventDrag from "./use-event-drag";
import useSlotDrag, { toTimeRange, type SlotRange } from "./use-slot-drag";
import useSlotFocus from "./use-slot-focus";
import {
  formatDate,
  formatPattern,
  getDayPeriods,
  startOfDay,
  usesHour12,
} from "../../utils/date";
import { formatMessage } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";

/**
 * The current date in hour slots - with `resources` a column for each
 * resource.
 */
export default function DayView(props: CalendarViewProps) {
  return props.resources && props.resources.length > 0 ? (
    <ResourceDayView {...props} />
  ) : (
    <SingleDayView {...props} />
  );
}

/** The day in a column for each resource - they scroll sideways. */
function ResourceDayView(props: CalendarViewProps) {
  const { currentDate } = props;
  const days = useMemo(() => [startOfDay(currentDate)], [currentDate]);

  return (
    <TimeGrid
      {...props}
      className="day-view"
      days={days}
      slotDuration={60}
      slotHeight={128}
      tileClassName="px-2 outline-[1.5px] outline-surface dark:outline-surface-dark"
    />
  );
}

/** The day in one column, its all-day events above it. */
function SingleDayView({
  currentDate,
  dayEndHour,
  dayStartHour,
  events,
  getEventColor,
  getEventLabel,
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
  // The slots - drags measure the pointer in them
  const gridRef = useRef<HTMLDivElement>(null);
  // The view scrolls - a drag scrolls it along at its edges
  const scrollRef = useRef<HTMLDivElement>(null);
  // How the last slot was pressed - a tap or a click of a screen reader
  // picks a slot, a mouse or a pen drags a range
  const pressTypeRef = useRef<string | null>(null);

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

  const { getEventDisplayTimes, handleDragStart, isAnyDragging, isDragging } =
    useEventDrag({
      endHour: END_HOUR,
      gridRef,
      onEventDrop,
      onEventResize,
      scrollRef,
      slotDurationMinutes: SLOT_DURATION,
      slotHeight: SLOT_HEIGHT,
      startHour: START_HOUR,
    });

  const { handleSlotDragStart, slotDragState } = useSlotDrag({
    endHour: END_HOUR,
    gridRef,
    onSlotDragEnd,
    scrollRef,
    slotDurationMinutes: SLOT_DURATION,
    slotHeight: SLOT_HEIGHT,
    startHour: START_HOUR,
  });

  // Rows from the start hour to the end hour (inclusive)
  const hours = Array.from(
    { length: END_HOUR - START_HOUR + 1 },
    (_, i) => i + START_HOUR,
  );

  const dayStart = startOfDay(currentDate);
  const isDisabled = !!(
    (minDate && addCalendarDays(dayStart, 1) <= minDate) ||
    (maxDate && dayStart > maxDate)
  );

  // Also the events that began on an earlier day and run into this one
  const dayEvents = useMemo(
    () => events.filter((event) => isOnDay(event, currentDate)),
    [currentDate, events],
  );

  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const timedEvents = dayEvents.filter((event) => !event.allDay);
  // Timed events no part of which the hours shown have a row for - the
  // header offers them
  const hasHiddenEvents = timedEvents.some((event) => {
    const { end, start } = getEventDisplayTimes(event);
    return (
      getHiddenSide(start, end, currentDate, START_HOUR, END_HOUR) !== null
    );
  });

  const formattedDate = formatDate(currentDate, locale.formats.date);

  // The time of the row of `hour` - the row of the end hour stands for the
  // last hour before it
  const slotStart = (hour: number) =>
    getSlotStart(currentDate, hour, 0, SLOT_DURATION, END_HOUR);

  // The hour rows `first` - `last` as a range - the row of the end hour
  // stands for the last hour before it
  const slotRange = (first: number, last: number): SlotRange => {
    const lastStart = END_HOUR * 60 - SLOT_DURATION;
    return {
      day: dayStart,
      from: Math.min(hours[first] * 60, lastStart),
      to: Math.min(hours[last] * 60, lastStart) + SLOT_DURATION,
    };
  };

  // Slots are picked with `onDateClick`, or they start a range
  const slotsFocusable = !!onDateClick || !!onSlotDragEnd;

  // The keyboard way to the slots - the hours are one tab stop, the arrow
  // keys move between them; Shift + arrow keys select a range
  const slotFocus = useSlotFocus({
    days: 1,
    gridRef,
    initialDay: 0,
    onActivate: (_, slot) => {
      if (isDisabled) return;
      if (onDateClick) {
        onDateClick(slotStart(hours[slot]));
      } else {
        onSlotDragEnd?.(toTimeRange(slotRange(slot, slot)));
      }
    },
    onSelectRange: onSlotDragEnd
      ? (_, first, last) => {
          if (isDisabled) return;
          onSlotDragEnd(toTimeRange(slotRange(first, last)));
        }
      : undefined,
    slots: hours.length,
  });

  const keyboardRange =
    slotFocus.selection && !isDisabled
      ? slotRange(slotFocus.selection.first, slotFocus.selection.last)
      : null;
  const keyboardTimes = keyboardRange && toTimeRange(keyboardRange);
  // The range dragged over the slots or selected with the keyboard
  const selectedRange = slotDragState ?? keyboardRange;

  // On the clock of the time column - also a time the clocks skip
  const getSlotLabel = createSlotLabeler(locale);

  return (
    <div
      className={cn(
        "day-view relative",
        // No text selected along a drag over the slots
        slotDragState && "select-none",
        stickyHeader ? "h-150 overflow-y-auto" : "overflow-auto",
      )}
      ref={scrollRef}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {(allDayEvents.length > 0 || hasHiddenEvents) && (
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
                <EventTile
                  actions={renderEventActions?.(event)}
                  className={cn(
                    "relative rounded border-l-2 px-2 py-1 text-sm",
                    ...getColorStyles(getEventColor(event)),
                    isClickable(event) ? "cursor-pointer" : "cursor-default",
                  )}
                  clickable={isClickable(event)}
                  key={event.id}
                  label={getEventLabel(event)}
                  onOpen={() => handleEventClick(event)}
                  title={getEventTooltipText(event)}
                >
                  {/* Optional custom icon renderer */}
                  {renderEventIcon?.(event)}
                  <EventTitle event={event}>{event.title}</EventTitle>{" "}
                  {/* Also after an `htmlTitle` - in the label for screen
                      readers */}
                  <span aria-hidden="true">
                    ({locale.messages.calendar.allDay})
                  </span>
                </EventTile>
              ))}
            </div>
            <HiddenEvents
              day={currentDate}
              endHour={END_HOUR}
              events={timedEvents}
              getDisplayTimes={getEventDisplayTimes}
              label={createDayFormat(locale).format(currentDate)}
              getEventColor={getEventColor}
              getEventLabel={getEventLabel}
              isClickable={isClickable}
              onEventOpen={handleEventClick}
              renderEventActions={renderEventActions}
              renderEventIcon={renderEventIcon}
              startHour={START_HOUR}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-[60px_1fr]">
        <div className="time-column">
          {hours.map((hour) => (
            <div
              className="relative h-32 border-r border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
              key={hour}
            >
              {/* On one line - "10:00 AM" fits the column this way */}
              <span className="absolute top-1 right-1.5 whitespace-nowrap">
                {formatPattern(
                  locale.formats.time,
                  {
                    // The end hour 24 is the midnight ending the day - 12:00 AM
                    // (not PM) on the 12-hour clock, 24:00 on the 24-hour one
                    hours: usesHour12(locale.formats.time) ? hour % 24 : hour,
                    minutes: 0,
                  },
                  getDayPeriods(locale.code),
                )}
              </span>
            </div>
          ))}
        </div>

        {/* A layer of its own - its crowded tiles stay under the sticky
            header */}
        <div
          className="relative isolate"
          onBlur={slotsFocusable ? slotFocus.handleBlur : undefined}
          onFocus={slotsFocusable ? slotFocus.handleFocus : undefined}
          onKeyDown={slotsFocusable ? slotFocus.handleKeyDown : undefined}
          ref={gridRef}
        >
          {hours.map((hour, index) => {
            const handleSlotClick = () => {
              const pressType = pressTypeRef.current;
              pressTypeRef.current = null;
              if (isDisabled) return;

              if (onDateClick) {
                onDateClick(slotStart(hour));
              } else if (
                onSlotDragEnd &&
                pressType !== "mouse" &&
                pressType !== "pen"
              ) {
                onSlotDragEnd(toTimeRange(slotRange(index, index)));
              }
            };

            const handleSlotPointerDown = (e: React.PointerEvent) => {
              pressTypeRef.current = e.pointerType;
              if (isDisabled) return;
              handleSlotDragStart(e, dayStart, hour * 60);
            };

            return (
              <div
                className={cn(
                  "h-32 border-r border-b border-neutral-200 dark:border-neutral-800",
                  !isDisabled &&
                    slotsFocusable &&
                    "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
                  slotsFocusable &&
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset",
                )}
                key={hour}
                onClick={handleSlotClick}
                onPointerDown={handleSlotPointerDown}
                {...(slotsFocusable && {
                  "aria-disabled": isDisabled || undefined,
                  "aria-label": getSlotLabel(
                    dayStart,
                    Math.min(hour, END_HOUR - 1) * 60,
                  ),
                  "data-slot": `0-${index}`,
                  role: "button",
                  tabIndex: slotFocus.isFocused(0, index) ? 0 : -1,
                })}
              />
            );
          })}

          {/* The range being picked */}
          {selectedRange && (
            <div
              className="pointer-events-none absolute right-1 left-1 rounded-md border-2 border-dashed border-primary-500 bg-primary-100/50 dark:bg-primary-900/50"
              style={{
                // Clock minutes, like the event tiles - also over a
                // daylight saving change
                top: `${((selectedRange.from - START_HOUR * 60) / SLOT_DURATION) * SLOT_HEIGHT}px`,
                height: `${((selectedRange.to - selectedRange.from) / SLOT_DURATION) * SLOT_HEIGHT}px`,
              }}
            />
          )}

          <TimedEvents
            canMove={!!onEventDrop}
            canResize={!!onEventResize}
            day={currentDate}
            disabled={isDisabled}
            endHour={END_HOUR}
            events={timedEvents}
            getColor={getEventColor}
            getDisplayTimes={getEventDisplayTimes}
            getLabel={getEventLabel}
            isAnyDragging={isAnyDragging}
            isClickable={isClickable}
            isDragging={isDragging}
            onDragStart={handleDragStart}
            onEventClick={handleEventClick}
            renderEventActions={renderEventActions}
            renderEventIcon={renderEventIcon}
            slotDurationMinutes={SLOT_DURATION}
            slotHeight={SLOT_HEIGHT}
            startHour={START_HOUR}
            tileClassName="px-2"
          />
        </div>
      </div>

      {/* The range selected with the keyboard, for screen readers */}
      {onSlotDragEnd && (
        <div aria-live="polite" className="sr-only">
          {keyboardTimes &&
            formatMessage(locale.messages.calendar.rangeSelected, {
              range: formatTimeRange(
                keyboardTimes.start,
                keyboardTimes.end,
                locale,
              ),
            })}
        </div>
      )}
    </div>
  );
}
