import type {
  CalendarEvent,
  CalendarResource,
  CalendarViewProps,
} from "./types";
import { addCalendarDays, getSlotStart, isSameDay } from "./date-utils";
import {
  createDayFormat,
  createSlotLabeler,
  formatTimeRange,
  getColorStyles,
  getEventTooltipText,
  isOnDay,
  withResource,
} from "./utils";
import { useCallback, useMemo, useRef } from "react";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";
import HiddenEvents from "./hidden-events";
import MoreEvents from "./more-events";
import Spinner from "../spinner";
import TimedEvents from "./timed-events";
import useEventDrag, { type DragColumn } from "./use-event-drag";
import useSlotDrag, { toTimeRange, type SlotRange } from "./use-slot-drag";
import useIsHydrated from "../../hooks/use-is-hydrated";
import useSlotFocus from "./use-slot-focus";
import {
  formatPattern,
  getDayPeriods,
  getWeekdayNames,
  usesHour12,
} from "../../utils/date";
import { formatMessage, toIntlLocale } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";

/** All-day events the header of a column shows before "+N more". */
const MAX_ALL_DAY_EVENTS = 2;

/** Width of the time column in pixels - `grid-cols-[60px_1fr]`. */
const TIME_COLUMN_WIDTH = 60;

/** The narrowest day column of the week - on phones the week scrolls sideways. */
const MIN_DAY_COLUMN_WIDTH = 100;

/**
 * The narrowest column of a resource of the day view - many of them scroll
 * sideways. Those of the week view are as narrow as its days.
 */
const MIN_RESOURCE_COLUMN_WIDTH = 120;

export interface TimeGridProps extends CalendarViewProps {
  /** Classes of the scroll container - `week-view` or `day-view`. */
  className: string;
  /**
   * The days of the grid, local midnights - a column each, or with
   * `resources` a column for each resource of each day.
   */
  days: Date[];
  /** Height of a slot in pixels - 64 (`h-16`) or 128 (`h-32`). */
  slotHeight: number;
  /** Length of a slot in minutes. */
  slotDuration: number;
  /** Classes of the event tiles, e.g. their padding. */
  tileClassName?: string;
}

/** A day of the grid. */
interface GridDay {
  date: Date;
  /** Out of `minDate` - `maxDate` - nothing can be picked or dropped there. */
  disabled: boolean;
  /** The current date of the calendar. */
  isSelected: boolean;
}

/** A column of the grid - a day, or a resource on a day. */
interface GridColumn extends GridDay {
  resource?: CalendarResource;
}

/**
 * The time grid of the week and day views: a column for each day - or for
 * each resource of each day - with the time slots from the start to the end
 * hour, the timed events laid out in them and the all-day events in the
 * sticky header. Events are moved to another time or column (day and
 * resource) and resized by the pointer; slots are picked by a click, a drag
 * or the keyboard.
 */
export default function TimeGrid({
  className,
  currentDate,
  dayEndHour,
  dayStartHour,
  days,
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
  resources,
  slotDuration,
  slotHeight,
  stickyHeader = true,
  tileClassName,
}: TimeGridProps) {
  const SLOT_HEIGHT = slotHeight;
  const SLOT_DURATION = slotDuration;
  const START_HOUR = dayStartHour;
  const END_HOUR = dayEndHour;

  const locale = useLocale();
  // Sunday first, like `Date#getDay()`
  const weekdayNames = getWeekdayNames(locale.code, 0);
  const resourceList = resources && resources.length > 0 ? resources : null;

  // The day columns - drags measure the pointer in them
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

  const gridDays = useMemo<GridDay[]>(
    () =>
      days.map((date) => ({
        date,
        disabled: !!(
          (minDate && addCalendarDays(date, 1) <= minDate) ||
          (maxDate && date > maxDate)
        ),
        isSelected: isSameDay(date, currentDate),
      })),
    [currentDate, days, maxDate, minDate],
  );

  const columns = useMemo<GridColumn[]>(
    () =>
      gridDays.flatMap((day) =>
        resourceList
          ? resourceList.map((resource) => ({ ...day, resource }))
          : [day],
      ),
    [gridDays, resourceList],
  );

  // Events are dropped in the columns of the enabled days only
  const dragColumns = useMemo<DragColumn[]>(
    () =>
      columns.map((column) => ({
        day: column.date,
        disabled: column.disabled,
        resourceId: column.resource?.id,
      })),
    [columns],
  );

  const { getEventDisplayTimes, handleDragStart, isAnyDragging, isDragging } =
    useEventDrag({
      columns: dragColumns,
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

  // The slots from the start hour to the end hour (inclusive)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (
      let minutes = START_HOUR * 60;
      minutes < END_HOUR * 60;
      minutes += SLOT_DURATION
    ) {
      slots.push({ hour: Math.floor(minutes / 60), minute: minutes % 60 });
    }
    // Add the final slot of the end hour
    slots.push({ hour: END_HOUR, minute: 0 });
    return slots;
  }, [END_HOUR, SLOT_DURATION, START_HOUR]);

  // The clock time of a slot row in minutes since midnight
  const slotMinutes = (slotIndex: number) =>
    timeSlots[slotIndex].hour * 60 + timeSlots[slotIndex].minute;

  // The day and time of a slot - the row of the end hour stands for the
  // last slot before it
  const slotStart = (columnIndex: number, slotIndex: number) =>
    getSlotStart(
      columns[columnIndex].date,
      timeSlots[slotIndex].hour,
      timeSlots[slotIndex].minute,
      SLOT_DURATION,
      END_HOUR,
    );

  // The slots `first` - `last` of a column as a range - the row of the end
  // hour stands for the last slot before it
  const slotRange = (
    columnIndex: number,
    first: number,
    last: number,
  ): SlotRange => {
    const lastStart = END_HOUR * 60 - SLOT_DURATION;
    return {
      day: columns[columnIndex].date,
      from: Math.min(slotMinutes(first), lastStart),
      resourceId: columns[columnIndex].resource?.id,
      to: Math.min(slotMinutes(last), lastStart) + SLOT_DURATION,
    };
  };

  // A picked slot - with the resource of its column
  const pickSlot = (columnIndex: number, slotIndex: number) => {
    const date = slotStart(columnIndex, slotIndex);
    const resource = columns[columnIndex].resource;
    if (resource) {
      onDateClick?.(date, resource.id);
    } else {
      onDateClick?.(date);
    }
  };

  // Slots are picked with `onDateClick`, or they start a range
  const slotsFocusable = !!onDateClick || !!onSlotDragEnd;

  // The keyboard way to the slots - one tab stop, arrow keys between the
  // slots and the columns; Shift + arrow keys select a range
  const slotFocus = useSlotFocus({
    days: columns.length,
    gridRef,
    initialDay: Math.max(
      columns.findIndex((column) => column.isSelected),
      0,
    ),
    onActivate: (columnIndex, slotIndex) => {
      if (columns[columnIndex].disabled) return;
      if (onDateClick) {
        pickSlot(columnIndex, slotIndex);
      } else {
        onSlotDragEnd?.(
          toTimeRange(slotRange(columnIndex, slotIndex, slotIndex)),
        );
      }
    },
    onSelectRange: onSlotDragEnd
      ? (columnIndex, first, last) => {
          if (columns[columnIndex].disabled) return;
          onSlotDragEnd(toTimeRange(slotRange(columnIndex, first, last)));
        }
      : undefined,
    slots: timeSlots.length,
  });

  const selection = slotFocus.selection;
  const keyboardRange =
    selection && !columns[selection.day].disabled
      ? slotRange(selection.day, selection.first, selection.last)
      : null;
  const keyboardTimes = keyboardRange && toTimeRange(keyboardRange);
  // The range dragged over the slots or selected with the keyboard
  const selectedRange = slotDragState ?? keyboardRange;

  // On the clock of the time column
  const getSlotLabel = createSlotLabeler(locale);
  // The name of a slot - by its clock time, also one the clocks skip, and
  // the resource of its column
  const slotLabel = (columnIndex: number, slotIndex: number) =>
    withResource(
      locale,
      columns[columnIndex].resource?.title,
      getSlotLabel(
        columns[columnIndex].date,
        Math.min(slotMinutes(slotIndex), END_HOUR * 60 - SLOT_DURATION),
      ),
    );
  const dayLabelFormat = createDayFormat(locale);

  // The events of each resource - a dragged one in the resource it is
  // dragged to - so a column looks through those of its resource only
  const resourceEvents = new Map<string | undefined, CalendarEvent[]>();
  if (resourceList) {
    for (const event of events) {
      const { resourceId } = getEventDisplayTimes(event);
      resourceEvents.set(resourceId, [
        ...(resourceEvents.get(resourceId) ?? []),
        event,
      ]);
    }
  }
  const eventsOf = (column: GridColumn) =>
    column.resource ? (resourceEvents.get(column.resource.id) ?? []) : events;

  // The timed events of a column - a dragged one where it is dragged to,
  // also the days a timed event runs into past midnight
  const getColumnEvents = (column: GridColumn): CalendarEvent[] =>
    eventsOf(column).filter((event) => {
      if (event.allDay) return false;
      const { end, start } = getEventDisplayTimes(event);
      return isOnDay({ end, start }, column.date);
    });

  // Unknown on the server and while a server-rendered page hydrates - its
  // clock and time zone may differ from the browser's
  const isHydrated = useIsHydrated();
  const today = isHydrated ? new Date() : null;
  const isToday = (date: Date) => today !== null && isSameDay(date, today);

  // Like the month view: on each day the event spans
  const getAllDayEvents = (column: GridColumn) =>
    eventsOf(column).filter(
      (event) => event.allDay && isOnDay(event, column.date),
    );

  const allDayTile = (event: CalendarEvent) => (
    <EventTile
      actions={renderEventActions?.(event)}
      className={cn(
        "relative truncate rounded border-l-2 px-1 py-0.5 text-xs",
        ...getColorStyles(getEventColor(event)),
        isClickable(event) ? "cursor-pointer" : "cursor-default",
      )}
      clickable={isClickable(event)}
      contentClassName="truncate"
      key={event.id}
      label={getEventLabel(event)}
      onOpen={() => handleEventClick(event)}
      title={getEventTooltipText(event)}
    >
      {/* Optional custom icon renderer */}
      {renderEventIcon?.(event)}
      <EventTitle event={event}>{event.title}</EventTitle>
    </EventTile>
  );

  // The all-day events of a column - a crowded one gets "+N more", the
  // header stays low - and the timed events out of the hours shown
  const allDayTiles = (column: GridColumn, label: string) => {
    const allDayEvents = getAllDayEvents(column);
    const hiddenCount = allDayEvents.length - MAX_ALL_DAY_EVENTS;

    return (
      <>
        {allDayEvents.length > 0 && (
          <div className="mt-1 space-y-1 text-left">
            {(hiddenCount > 0
              ? allDayEvents.slice(0, MAX_ALL_DAY_EVENTS)
              : allDayEvents
            ).map(allDayTile)}
            {hiddenCount > 0 && (
              <MoreEvents count={hiddenCount} label={label}>
                {allDayEvents.map((event) => (
                  <div key={event.id}>{allDayTile(event)}</div>
                ))}
              </MoreEvents>
            )}
          </div>
        )}
        <HiddenEvents
          day={column.date}
          endHour={END_HOUR}
          events={getColumnEvents(column)}
          getDisplayTimes={getEventDisplayTimes}
          getEventColor={getEventColor}
          getEventLabel={getEventLabel}
          isClickable={isClickable}
          label={label}
          onEventOpen={handleEventClick}
          renderEventActions={renderEventActions}
          renderEventIcon={renderEventIcon}
          startHour={START_HOUR}
        />
      </>
    );
  };

  // The weekday, date and month of a day in the header - in a line over
  // the resources of the day
  const dayHeading = (day: GridDay, inline: boolean) => {
    const isDayToday = isToday(day.date);
    const dateClassName = cn(
      "inline-flex items-center justify-center rounded-full",
      inline ? "h-7 w-7" : "h-8 w-8",
      day.isSelected
        ? "bg-primary-600 text-white"
        : isDayToday &&
            "font-bold text-primary-600 ring-1 ring-primary-600 dark:text-primary-400 dark:ring-primary-400",
    );
    const Line = inline ? "span" : "div";

    return (
      <>
        <Line className="font-medium">{weekdayNames[day.date.getDay()]}</Line>
        {onDateClick && !day.disabled ? (
          // The keyboard way to the day - its click reaches the header
          <button
            aria-current={isDayToday ? "date" : undefined}
            aria-label={dayLabelFormat.format(day.date)}
            className={cn(
              dateClassName,
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
            )}
            type="button"
          >
            {day.date.getDate()}
          </button>
        ) : (
          <Line
            aria-current={isDayToday ? "date" : undefined}
            className={dateClassName}
          >
            {day.date.getDate()}
          </Line>
        )}
        <Line className="text-xs text-neutral-600 dark:text-neutral-400">
          {day.date.toLocaleString(toIntlLocale(locale.code), {
            month: "short",
          })}
        </Line>
      </>
    );
  };

  const dayHeaderClassName = (day: GridDay) =>
    cn(
      day.isSelected && "bg-primary-50 dark:bg-primary-900/30",
      day.disabled && "opacity-60",
      !day.disabled &&
        onDateClick &&
        "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
    );

  // The resources of a day end with a line of their own - the week view
  // tells its days apart by it
  const endsDay = (columnIndex: number) =>
    !!resourceList &&
    gridDays.length > 1 &&
    (columnIndex + 1) % resourceList.length === 0;

  const columnsMinWidth =
    columns.length *
    (resourceList && gridDays.length === 1
      ? MIN_RESOURCE_COLUMN_WIDTH
      : MIN_DAY_COLUMN_WIDTH);
  // A column per day of the week - or per resource of each day, any number,
  // and six days in a week with a day the time zone skips
  const isWholeWeek = !resourceList && columns.length === 7;
  const columnsStyle = {
    minWidth: `${columnsMinWidth}px`,
    ...(!isWholeWeek && {
      gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
    }),
  };
  const rowClassName = SLOT_HEIGHT === 128 ? "h-32" : "h-16";

  return (
    <div
      className={cn(
        className,
        resourceList && "resource-view",
        "relative",
        // No text selected along a drag over the slots
        slotDragState && "select-none",
        stickyHeader ? "h-150 overflow-y-auto" : "overflow-auto",
      )}
      ref={scrollRef}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* Over the time column (z-10) - it scrolls sideways under the corner */}
      <div
        className="sticky top-0 z-20 grid grid-cols-[60px_1fr] bg-surface dark:bg-surface-dark"
        style={{ minWidth: `${TIME_COLUMN_WIDTH + columnsMinWidth}px` }}
      >
        <div className="sticky left-0 z-11 border-r border-neutral-200 bg-surface dark:border-neutral-800 dark:bg-surface-dark" />
        <div
          className={cn("grid", isWholeWeek && "grid-cols-7")}
          style={columnsStyle}
        >
          {resourceList ? (
            <>
              {/* The days over their resources - one day needs none */}
              {gridDays.length > 1 &&
                gridDays.map((day) => (
                  <div
                    className={cn(
                      "border-r border-b border-r-neutral-300 border-b-neutral-200 px-1 py-1.5 dark:border-r-neutral-600 dark:border-b-neutral-800",
                      dayHeaderClassName(day),
                    )}
                    key={day.date.getTime()}
                    onClick={() => !day.disabled && onDateClick?.(day.date)}
                    style={{ gridColumn: `span ${resourceList.length}` }}
                  >
                    {/* In view while the resources of the day scroll sideways
                        - right of the time column */}
                    <div className="sticky left-15 flex w-fit items-center gap-1.5 px-1">
                      {dayHeading(day, true)}
                    </div>
                  </div>
                ))}
              {columns.map((column, index) => {
                const { resource } = column;
                if (!resource) return null;

                return (
                  <div
                    className={cn(
                      "min-w-0 border-r p-1.5",
                      endsDay(index)
                        ? "border-neutral-300 dark:border-neutral-600"
                        : "border-neutral-200 dark:border-neutral-800",
                      column.disabled && "opacity-60",
                    )}
                    data-resource={resource.id}
                    key={index}
                  >
                    {/* Two lines at most - the whole name on hover */}
                    <div
                      className="line-clamp-2 text-center text-sm font-medium break-words"
                      title={resource.title}
                    >
                      {resource.color && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mr-1.5 inline-block size-2.5 rounded-full border-[5px]",
                            getColorStyles(resource.color)[2],
                          )}
                        />
                      )}
                      {resource.title}
                    </div>
                    {allDayTiles(
                      column,
                      withResource(
                        locale,
                        resource.title,
                        dayLabelFormat.format(column.date),
                      ),
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            gridDays.map((day, index) => (
              <div
                className={cn(
                  "border-r border-neutral-200 p-2 text-center dark:border-neutral-800",
                  dayHeaderClassName(day),
                )}
                key={index}
                onClick={() => !day.disabled && onDateClick?.(day.date)}
              >
                {dayHeading(day, false)}
                {allDayTiles(day, dayLabelFormat.format(day.date))}
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className="grid grid-cols-[60px_1fr]"
        style={{ minWidth: `${TIME_COLUMN_WIDTH + columnsMinWidth}px` }}
      >
        <div className="time-column sticky left-0 z-10 bg-surface dark:bg-surface-dark">
          {timeSlots.map((timeSlot, index) => (
            <div
              className={cn(
                "relative border-r border-b border-neutral-200 bg-surface text-xs text-neutral-500 dark:border-neutral-800 dark:bg-surface-dark dark:text-neutral-400",
                rowClassName,
              )}
              key={index}
            >
              {/* On one line - "10:00 AM" fits the column this way */}
              <span className="absolute top-1 right-1.5 whitespace-nowrap">
                {formatPattern(
                  locale.formats.time,
                  {
                    // The end hour 24 is the midnight ending the day - 12:00 AM
                    // (not PM) on the 12-hour clock, 24:00 on the 24-hour one
                    hours: usesHour12(locale.formats.time)
                      ? timeSlot.hour % 24
                      : timeSlot.hour,
                    minutes: timeSlot.minute,
                  },
                  getDayPeriods(locale.code),
                )}
              </span>
            </div>
          ))}
        </div>

        <div
          className={cn("grid", isWholeWeek && "grid-cols-7")}
          onBlur={slotsFocusable ? slotFocus.handleBlur : undefined}
          onFocus={slotsFocusable ? slotFocus.handleFocus : undefined}
          onKeyDown={slotsFocusable ? slotFocus.handleKeyDown : undefined}
          ref={gridRef}
          style={columnsStyle}
        >
          {columns.map((column, columnIndex) => (
            // A layer of its own - its crowded tiles stay under the sticky
            // header and time column
            <div
              className="day-column relative isolate"
              data-resource={column.resource?.id}
              key={columnIndex}
            >
              {endsDay(columnIndex) && (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-neutral-300 dark:bg-neutral-600" />
              )}
              {timeSlots.map((_, index) => {
                const handleSlotClick = () => {
                  const pressType = pressTypeRef.current;
                  pressTypeRef.current = null;
                  if (column.disabled) return;

                  if (onDateClick) {
                    pickSlot(columnIndex, index);
                  } else if (
                    onSlotDragEnd &&
                    pressType !== "mouse" &&
                    pressType !== "pen"
                  ) {
                    onSlotDragEnd(
                      toTimeRange(slotRange(columnIndex, index, index)),
                    );
                  }
                };

                const handleSlotPointerDown = (e: React.PointerEvent) => {
                  pressTypeRef.current = e.pointerType;
                  if (column.disabled) return;
                  handleSlotDragStart(
                    e,
                    column.date,
                    slotMinutes(index),
                    column.resource?.id,
                  );
                };

                return (
                  <div
                    className={cn(
                      "border-r border-b border-neutral-200 dark:border-neutral-800",
                      rowClassName,
                      !column.disabled &&
                        slotsFocusable &&
                        "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
                      slotsFocusable &&
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset",
                    )}
                    key={index}
                    onClick={handleSlotClick}
                    onPointerDown={handleSlotPointerDown}
                    {...(slotsFocusable && {
                      "aria-disabled": column.disabled || undefined,
                      "aria-label": slotLabel(columnIndex, index),
                      "data-slot": `${columnIndex}-${index}`,
                      role: "button",
                      tabIndex: slotFocus.isFocused(columnIndex, index)
                        ? 0
                        : -1,
                    })}
                  />
                );
              })}

              {/* The range being picked */}
              {selectedRange &&
                isSameDay(selectedRange.day, column.date) &&
                selectedRange.resourceId === column.resource?.id && (
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
                day={column.date}
                disabled={column.disabled}
                endHour={END_HOUR}
                events={getColumnEvents(column)}
                getColor={getEventColor}
                getDisplayTimes={getEventDisplayTimes}
                getLabel={getEventLabel}
                isAnyDragging={isAnyDragging}
                isClickable={isClickable}
                isDragging={isDragging}
                onDragStart={(e, event, type) =>
                  handleDragStart(e, event, type, columnIndex)
                }
                onEventClick={handleEventClick}
                renderEventActions={renderEventActions}
                renderEventIcon={renderEventIcon}
                slotDurationMinutes={SLOT_DURATION}
                slotHeight={SLOT_HEIGHT}
                startHour={START_HOUR}
                tileClassName={tileClassName}
              />
            </div>
          ))}
        </div>
      </div>

      {/* The range selected with the keyboard, for screen readers */}
      {onSlotDragEnd && (
        <div aria-live="polite" className="sr-only">
          {keyboardTimes &&
            formatMessage(locale.messages.calendar.rangeSelected, {
              range: withResource(
                locale,
                columns[selection?.day ?? 0]?.resource?.title,
                formatTimeRange(keyboardTimes.start, keyboardTimes.end, locale),
              ),
            })}
        </div>
      )}
    </div>
  );
}
