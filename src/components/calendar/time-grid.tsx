import type {
  CalendarEvent,
  CalendarResource,
  CalendarViewProps,
} from "./types";
import { addCalendarDays, isSameDay, minutesIntoDay } from "./date-utils";
import {
  getBusinessRanges,
  getOffHours,
  hasBusinessHours,
  isBusinessTime,
} from "./business-hours";
import {
  MAX_ALL_DAY_EVENTS,
  createDayFormat,
  createSlotLabeler,
  createTimeLabeler,
  createTimeTextFormatter,
  formatTimeRange,
  getColorStyles,
  getEventTooltipText,
  getHiddenSide,
  getLabelInterval,
  isOnDay,
  isRtl,
  revealFocus,
  withResource,
} from "./utils";
import {
  createDayGeometry,
  createGridGeometry,
  type DayCell,
  type DragType,
  type GridColumn as DragColumn,
} from "./move-geometry";
import { useCallback, useMemo, useRef } from "react";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";
import HiddenEvents from "./hidden-events";
import MoreEvents from "./more-events";
import Spinner from "../spinner";
import TimedEvents from "./timed-events";
import useCurrentMinute from "./use-current-minute";
import useEventMove from "./use-event-move";
import useIsApplePlatform from "../../hooks/use-is-apple-platform";
import useSlotDrag, { toTimeRange, type SlotRange } from "./use-slot-drag";
import useIsHydrated from "../../hooks/use-is-hydrated";
import useSlotFocus from "./use-slot-focus";
import {
  formatDate,
  formatPattern,
  getDayPeriods,
  getWeekdayNames,
  usesHour12,
} from "../../utils/date";
import { formatMessage, toIntlLocale } from "../../i18n/format";
import { toAriaKeyShortcuts } from "../../utils/shortcut";
import { useLocale } from "../../providers/ui-context";

/** Width of the time column in pixels - `grid-cols-[60px_1fr]`. */
const TIME_COLUMN_WIDTH = 60;

/** The narrowest day column of the week - on phones the week scrolls sideways. */
const MIN_DAY_COLUMN_WIDTH = 100;

/**
 * The narrowest column of a resource of the day view - many of them scroll
 * sideways. Those of the week view are as narrow as its days.
 */
const MIN_RESOURCE_COLUMN_WIDTH = 120;

/** The rows of the heights the week and day views always had. */
const ROW_CLASS_NAMES: Record<number, string> = { 64: "h-16", 128: "h-32" };

export interface TimeGridProps extends CalendarViewProps {
  /** Classes of the scroll container - `week-view` or `day-view`. */
  className: string;
  /**
   * The days of the grid, local midnights - a column each, or with
   * `resources` a column for each resource of each day.
   */
  days: Date[];
  /** Height of a slot in pixels - `getSlotHeight`. */
  slotHeight: number;
  /** Length of a slot in minutes. */
  slotMinutes: number;
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
 * sticky header. The day view without resources shows its date and all-day
 * events above its one column. Events are moved to another time or column
 * (day and resource) and resized by the pointer and the keys, the all-day
 * ones to another column; slots are picked by a click, a drag or the
 * keyboard. The working hours are shaded, the current time is a line.
 */
export default function TimeGrid({
  announce,
  businessHours,
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
  nowIndicator,
  onDateClick,
  onEventClick,
  onEventDrop,
  onEventResize,
  onSlotDragEnd,
  renderEvent,
  renderEventActions,
  renderEventIcon,
  resources,
  restrictToBusinessHours,
  slotHeight,
  slotMinutes,
  stickyHeader = true,
  tileClassName,
  view,
}: TimeGridProps) {
  const SLOT_HEIGHT = slotHeight;
  const SLOT_DURATION = slotMinutes;
  const START_HOUR = dayStartHour;
  const END_HOUR = dayEndHour;

  const locale = useLocale();
  // Sunday first, like `Date#getDay()`
  const weekdayNames = getWeekdayNames(locale.code, 0);
  const resourceList = resources && resources.length > 0 ? resources : null;
  // The day view: its date and all-day events above one column
  const isSingleDay = !resourceList && days.length === 1;
  const business = businessHours;

  // The day columns - drags measure the pointer in them
  const gridRef = useRef<HTMLDivElement>(null);
  // The columns of the header - an all-day event is dragged over them
  const headerGridRef = useRef<HTMLDivElement>(null);
  // The view scrolls - a drag scrolls it along at its edges
  const scrollRef = useRef<HTMLDivElement>(null);
  // The days, resources and all-day events on top - the focus stays below
  const headerRef = useRef<HTMLDivElement>(null);
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
  const headerCells = useMemo<DayCell[]>(
    () =>
      columns.map((column) => ({
        day: column.date,
        disabled: column.disabled,
        resourceId: column.resource?.id,
      })),
    [columns],
  );

  // When a moved event would take place - for screen readers
  const timeLabel = useMemo(
    () => createTimeLabeler(locale, resourceList ?? undefined),
    [locale, resourceList],
  );
  const timeText = useMemo(() => createTimeTextFormatter(locale), [locale]);

  const move = useEventMove({
    announce,
    describe: (event, display) =>
      timeLabel({ allDay: event.allDay, ...display }),
    events,
    geometryKey: JSON.stringify([
      dragColumns,
      START_HOUR,
      END_HOUR,
      SLOT_DURATION,
      SLOT_HEIGHT,
      minDate,
      maxDate,
    ]),
    onEventDrop,
    onEventResize,
    scrollRef,
  });
  const { getEventDisplayTimes, isDragging, isPointerDragging } = move;

  // The key that picks an event up - for `aria-keyshortcuts`
  const isApple = useIsApplePlatform();
  const moveShortcut = toAriaKeyShortcuts("mod+x", isApple);

  // A slot of the working hours - the only ones to pick with
  // `restrictToBusinessHours`
  const isBusinessSlot = (day: Date, from: number) =>
    business === null ||
    !restrictToBusinessHours ||
    isBusinessTime(business, day, from, from + SLOT_DURATION);

  const timeRangeLimits = {
    from: START_HOUR * 60,
    to: END_HOUR * 60,
    businessHours: restrictToBusinessHours ? business : null,
  };
  const getTimeRange = (range: SlotRange) =>
    toTimeRange(range, timeRangeLimits);

  // Pointer and keyboard ranges belong to the same days, resources and limits.
  const slotGeometryKey = JSON.stringify([
    dragColumns,
    START_HOUR,
    END_HOUR,
    SLOT_DURATION,
    SLOT_HEIGHT,
    minDate,
    maxDate,
    restrictToBusinessHours && business ? [...business] : null,
  ]);
  const { handleSlotDragStart, slotDragState } = useSlotDrag({
    geometryKey: slotGeometryKey,
    // The working hours around the first slot
    getBounds:
      business !== null && restrictToBusinessHours
        ? (day, anchor) => {
            const range = getBusinessRanges(business, day).find(
              (item) =>
                item.from <= anchor && anchor + SLOT_DURATION <= item.to,
            );
            return range
              ? {
                  from: Math.max(range.from, START_HOUR * 60),
                  to: Math.min(range.to, END_HOUR * 60),
                }
              : { from: anchor, to: anchor + SLOT_DURATION };
          }
        : undefined,
    gridRef,
    onSlotDragEnd,
    scrollRef,
    slotDurationMinutes: SLOT_DURATION,
    slotHeight: SLOT_HEIGHT,
    timeRangeLimits,
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

  // The time column writes the time every so many minutes - the lines of
  // the other slots are lighter
  const labelInterval = getLabelInterval(SLOT_DURATION, SLOT_HEIGHT);

  // The clock time of a slot row in minutes since midnight
  const slotMinutesOf = (slotIndex: number) =>
    timeSlots[slotIndex].hour * 60 + timeSlots[slotIndex].minute;

  // The start of the slot a row stands for - the row of the end hour stands
  // for the last slot before it
  const slotFrom = (slotIndex: number) =>
    Math.min(slotMinutesOf(slotIndex), END_HOUR * 60 - SLOT_DURATION);

  // The slots `first` - `last` of a column as a range - the row of the end
  // hour stands for the last slot before it
  const slotRange = (
    columnIndex: number,
    first: number,
    last: number,
  ): SlotRange => ({
    day: columns[columnIndex].date,
    from: slotFrom(first),
    resourceId: columns[columnIndex].resource?.id,
    to: slotFrom(last) + SLOT_DURATION,
  });

  // A slot that can be picked - of an enabled day, in the working hours
  // with `restrictToBusinessHours`
  const isSlotPickable = (columnIndex: number, slotIndex: number) =>
    !columns[columnIndex].disabled &&
    isBusinessSlot(columns[columnIndex].date, slotFrom(slotIndex)) &&
    getTimeRange(slotRange(columnIndex, slotIndex, slotIndex)) !== null;

  // The slots of a range the keys selected that can be picked - those
  // around the first one, up to a slot out of the working hours
  const pickableRange = (
    columnIndex: number,
    anchor: number,
    first: number,
    last: number,
  ) => {
    if (!isSlotPickable(columnIndex, anchor)) return null;
    let from = anchor;
    while (from > first && isSlotPickable(columnIndex, from - 1)) from--;
    let to = anchor;
    while (to < last && isSlotPickable(columnIndex, to + 1)) to++;
    while (!getTimeRange(slotRange(columnIndex, from, to))) {
      if (to > anchor) to--;
      else if (from < anchor) from++;
      else return null;
    }
    return slotRange(columnIndex, from, to);
  };

  // A picked slot - with the resource of its column
  const pickSlot = (columnIndex: number, slotIndex: number) => {
    const times = getTimeRange(slotRange(columnIndex, slotIndex, slotIndex));
    if (!times) return;
    const resource = columns[columnIndex].resource;
    if (resource) {
      onDateClick?.(times.start, resource.id);
    } else {
      onDateClick?.(times.start);
    }
  };

  // Slots are picked with `onDateClick`, or they start a range
  const slotsFocusable = !!onDateClick || !!onSlotDragEnd;

  // The keyboard way to the slots - one tab stop, arrow keys between the
  // slots and the columns; Shift + arrow keys select a range
  const slotFocus = useSlotFocus({
    days: columns.length,
    geometryKey: slotGeometryKey,
    gridRef,
    initialDay: Math.max(
      columns.findIndex((column) => column.isSelected),
      0,
    ),
    onActivate: (columnIndex, slotIndex) => {
      if (!isSlotPickable(columnIndex, slotIndex)) return;
      if (onDateClick) {
        pickSlot(columnIndex, slotIndex);
      } else {
        const times = getTimeRange(
          slotRange(columnIndex, slotIndex, slotIndex),
        );
        if (times) onSlotDragEnd?.(times);
      }
    },
    onSelectRange: onSlotDragEnd
      ? (columnIndex, first, last, anchor) => {
          const range = pickableRange(columnIndex, anchor, first, last);
          const times = range && getTimeRange(range);
          if (times) onSlotDragEnd(times);
        }
      : undefined,
    slots: timeSlots.length,
  });

  const selection = slotFocus.selection;
  const keyboardRange = selection
    ? pickableRange(
        selection.day,
        selection.anchor,
        selection.first,
        selection.last,
      )
    : null;
  const keyboardTimes = keyboardRange && getTimeRange(keyboardRange);
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
      getSlotLabel(columns[columnIndex].date, slotFrom(slotIndex)),
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
  // The line of the current time - moved on every minute, while the grid
  // shows today
  const now = useCurrentMinute(nowIndicator && days.some(isToday));

  // Like the month view: on each day the event spans - a moved one on the
  // days it is moved to
  const getAllDayEvents = (column: GridColumn) =>
    eventsOf(column).filter(
      (event) =>
        event.allDay &&
        isOnDay({ allDay: true, ...getEventDisplayTimes(event) }, column.date),
    );

  // All-day events go to another column of the header - a day or a resource
  const allDayMovable = !!onEventDrop && columns.length > 1;

  const dayGeometry = (event: CalendarEvent, columnIndex: number) =>
    createDayGeometry({
      cells: headerCells,
      columns: headerCells.length,
      event,
      grid: headerGridRef.current,
      hasResources: !!resourceList,
      index: columnIndex,
      maxDate,
      minDate,
      rtl: isRtl(scrollRef.current),
    });

  const gridGeometry = (
    event: CalendarEvent,
    type: DragType,
    columnIndex: number,
  ) =>
    createGridGeometry({
      column: columnIndex,
      columns: dragColumns,
      endHour: END_HOUR,
      event,
      grid: gridRef.current,
      minDuration: Math.min(15, SLOT_DURATION),
      rtl: isRtl(scrollRef.current),
      slotDuration: SLOT_DURATION,
      slotHeight: SLOT_HEIGHT,
      startHour: START_HOUR,
      type,
    });

  /**
   * The tile of an all-day event - in the header, or in the list of "+N
   * more" (`inList`), where it does not move.
   */
  const allDayTile = (
    event: CalendarEvent,
    columnIndex: number,
    inList = false,
  ) => {
    const column = columns[columnIndex];
    const clickable = isClickable(event);
    const movable = allDayMovable && !inList && !column.disabled;
    const dragging = !inList && isDragging(event.id);
    const color = getEventColor(event);
    const title = <EventTitle event={event}>{event.title}</EventTitle>;

    return (
      <EventTile
        actions={renderEventActions?.(event)}
        className={cn(
          "relative rounded border-s-2",
          isSingleDay ? "px-2 py-1 text-sm" : "truncate px-1 py-0.5 text-xs",
          ...getColorStyles(color),
          dragging && "opacity-80 shadow-lg ring-2 ring-primary-500",
          movable
            ? // A finger on it drags, it does not scroll the view
              "cursor-move touch-none select-none"
            : clickable
              ? "cursor-pointer"
              : "cursor-default",
          isPointerDragging && !dragging && "pointer-events-none",
        )}
        clickable={clickable}
        contentClassName={isSingleDay ? undefined : "truncate"}
        eventDay={column.date}
        eventId={movable ? event.id : undefined}
        key={event.id}
        keyShortcuts={movable ? moveShortcut : undefined}
        label={getEventLabel(event)}
        movable={movable}
        onButtonBlur={movable ? move.handleBlur : undefined}
        onButtonKeyDown={
          movable
            ? (e) =>
                move.handleKeyDown(e, event, {
                  clickable,
                  day: column.date,
                  getGeometry: (type) =>
                    type === "move" ? dayGeometry(event, columnIndex) : null,
                })
            : undefined
        }
        onOpen={() => handleEventClick(event)}
        onPointerDown={
          movable
            ? (e) =>
                move.handleDragStart(
                  e,
                  event,
                  "move",
                  dayGeometry(event, columnIndex),
                )
            : undefined
        }
        title={getEventTooltipText(event)}
      >
        {/* Optional custom icon renderer */}
        {renderEventIcon?.(event)}
        {renderEvent ? (
          // The label of the tile says it all to screen readers
          <span aria-hidden="true">
            {renderEvent(event, {
              allDay: true,
              color,
              compact: true,
              dragging,
              timeText: timeText({
                allDay: true,
                end: event.end,
                start: event.start,
              }),
              title,
              view,
            })}
          </span>
        ) : (
          title
        )}
        {isSingleDay && (
          <>
            {" "}
            {/* Also after an `htmlTitle` - in the label for screen readers */}
            <span aria-hidden="true">({locale.messages.calendar.allDay})</span>
          </>
        )}
      </EventTile>
    );
  };

  // The all-day events of a column - a crowded one gets "+N more", the
  // header stays low, a moved event always shows - and the timed events
  // out of the hours shown
  const allDayTiles = (columnIndex: number, label: string) => {
    const column = columns[columnIndex];
    const allDayEvents = getAllDayEvents(column);
    const hiddenCount = allDayEvents.length - MAX_ALL_DAY_EVENTS;
    const moved = allDayEvents.findIndex((event) => isDragging(event.id));
    const shown =
      hiddenCount > 0
        ? moved >= MAX_ALL_DAY_EVENTS
          ? [
              ...allDayEvents.slice(0, MAX_ALL_DAY_EVENTS - 1),
              allDayEvents[moved],
            ]
          : allDayEvents.slice(0, MAX_ALL_DAY_EVENTS)
        : allDayEvents;

    return (
      <>
        {allDayEvents.length > 0 && (
          <div
            className={cn(
              "space-y-1",
              isSingleDay ? "mt-2" : "mt-1 text-start",
            )}
          >
            {shown.map((event) => allDayTile(event, columnIndex))}
            {hiddenCount > 0 && (
              <MoreEvents count={hiddenCount} label={label}>
                {allDayEvents.map((event) => (
                  <div key={event.id}>
                    {allDayTile(event, columnIndex, true)}
                  </div>
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
          renderEvent={renderEvent}
          renderEventActions={renderEventActions}
          renderEventIcon={renderEventIcon}
          startHour={START_HOUR}
          view={view}
        />
      </>
    );
  };

  // A day heading picks the day - not one out of `minDate` - `maxDate`, nor
  // one without working hours with `restrictToBusinessHours`
  const isDayPickable = (day: GridDay) =>
    !day.disabled &&
    (business === null ||
      !restrictToBusinessHours ||
      hasBusinessHours(business, day.date));

  // The weekday, date and month of a day in the header - in a line over
  // the resources of the day
  const dayHeading = (day: GridDay, inline: boolean) => {
    const isDayToday = isToday(day.date);
    const dateClassName = cn(
      "inline-flex items-center justify-center rounded-full",
      inline ? "h-7 w-7" : "h-8 w-8",
      // In forced colors mode, which drops the fill and the ring, in the
      // system colors of a selection - and today with an outline
      day.isSelected
        ? "bg-primary-600 text-white forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
        : isDayToday &&
            "font-bold text-primary-600 ring-1 ring-primary-600 dark:text-primary-400 dark:ring-primary-400 forced-colors:outline-1",
    );
    const Line = inline ? "span" : "div";

    return (
      <>
        <Line className="font-medium">{weekdayNames[day.date.getDay()]}</Line>
        {onDateClick && isDayPickable(day) ? (
          // The keyboard way to the day - its click reaches the header
          <button
            aria-current={isDayToday ? "date" : undefined}
            aria-label={dayLabelFormat.format(day.date)}
            className={cn(
              dateClassName,
              "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500",
            )}
            data-current={isDayToday ? "" : undefined}
            type="button"
          >
            {day.date.getDate()}
          </button>
        ) : (
          <Line
            aria-current={isDayToday ? "date" : undefined}
            className={dateClassName}
            data-current={isDayToday ? "" : undefined}
          >
            {day.date.getDate()}
          </Line>
        )}
        <Line className="text-xs text-neutral-600 dark:text-neutral-400">
          {day.date.toLocaleString(toIntlLocale(locale.code), {
            calendar: "gregory",
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
      isDayPickable(day) &&
        onDateClick &&
        "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
    );

  // The resources of a day end with a line of their own - the week view
  // tells its days apart by it
  const endsDay = (columnIndex: number) =>
    !!resourceList &&
    gridDays.length > 1 &&
    (columnIndex + 1) % resourceList.length === 0;

  const columnsMinWidth = isSingleDay
    ? 0
    : columns.length *
      (resourceList && gridDays.length === 1
        ? MIN_RESOURCE_COLUMN_WIDTH
        : MIN_DAY_COLUMN_WIDTH);
  // A column per day of the week - or per resource of each day, any number,
  // and fewer days with `hiddenDays` or a day the time zone skips
  const isWholeWeek = !resourceList && columns.length === 7;
  const columnsStyle = {
    minWidth: `${columnsMinWidth}px`,
    ...(!isWholeWeek && {
      gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
    }),
  };
  const rowClassName = ROW_CLASS_NAMES[SLOT_HEIGHT];
  const rowStyle = rowClassName ? undefined : { height: `${SLOT_HEIGHT}px` };
  // Pixels of the grid `minutes` after the first hour
  const toPixels = (minutes: number) => (minutes / SLOT_DURATION) * SLOT_HEIGHT;
  // A line the time column writes a time at - the lines between are lighter
  const isLabelLine = (minutes: number) => minutes % labelInterval === 0;

  // The time out of the working hours of a column - shaded; the row of the
  // end hour goes with the slot it stands for
  const offHoursOf = (column: GridColumn) => {
    if (!business) return [];
    const ranges = getOffHours(
      business,
      column.date,
      START_HOUR * 60,
      END_HOUR * 60,
    );
    const last = ranges[ranges.length - 1];
    if (last && last.to === END_HOUR * 60) {
      return [...ranges.slice(0, -1), { ...last, to: last.to + SLOT_DURATION }];
    }
    return ranges;
  };

  // Where the line of the current time goes in a column - `null` in the
  // columns of other days and out of the hours shown
  const nowLineTop = (column: GridColumn) => {
    if (!now || !isSameDay(column.date, now)) return null;
    const minutes = minutesIntoDay(column.date, now);
    if (minutes < START_HOUR * 60 || minutes > END_HOUR * 60) return null;
    return toPixels(minutes - START_HOUR * 60);
  };

  // The header of the day view - its date, the all-day events and the
  // timed ones out of the hours shown; none without them
  const singleDayColumn = columns[0];
  const hasSingleDayHeader =
    isSingleDay &&
    (getAllDayEvents(singleDayColumn).length > 0 ||
      getColumnEvents(singleDayColumn).some((event) => {
        const { end, start } = getEventDisplayTimes(event);
        return (
          getHiddenSide(
            start,
            end,
            singleDayColumn.date,
            START_HOUR,
            END_HOUR,
          ) !== null
        );
      }));

  const header = isSingleDay ? (
    hasSingleDayHeader && (
      <div
        className="sticky top-0 z-20 flex items-center border-b border-neutral-200 bg-surface p-2 dark:border-neutral-800 dark:bg-surface-dark"
        ref={headerRef}
      >
        <div
          className={cn(
            "bg-primary-50 p-2 text-center dark:bg-primary-900/30",
            singleDayColumn.disabled && "opacity-60",
          )}
          ref={headerGridRef}
        >
          <div className="font-medium">
            {formatDate(singleDayColumn.date, locale.formats.date)}
          </div>
          {allDayTiles(0, dayLabelFormat.format(singleDayColumn.date))}
        </div>
      </div>
    )
  ) : (
    // Over the time column (z-10) - it scrolls sideways under the corner
    <div
      className="sticky top-0 z-20 grid grid-cols-[60px_1fr] bg-surface dark:bg-surface-dark"
      ref={headerRef}
      style={{ minWidth: `${TIME_COLUMN_WIDTH + columnsMinWidth}px` }}
    >
      <div className="sticky inset-s-0 z-11 border-e border-neutral-200 bg-surface dark:border-neutral-800 dark:bg-surface-dark" />
      <div
        className={cn("grid", isWholeWeek && "grid-cols-7")}
        ref={headerGridRef}
        style={columnsStyle}
      >
        {resourceList ? (
          <>
            {/* The days over their resources - also the one day of the
                day view, with its date and the mark of today */}
            {gridDays.map((day) => (
              <div
                className={cn(
                  "border-e border-b border-e-neutral-300 border-b-neutral-200 px-1 py-1.5 dark:border-e-neutral-600 dark:border-b-neutral-800",
                  dayHeaderClassName(day),
                )}
                key={day.date.getTime()}
                onClick={() => isDayPickable(day) && onDateClick?.(day.date)}
                style={{ gridColumn: `span ${resourceList.length}` }}
              >
                {/* In view while the resources of the day scroll sideways
                    - right of the time column */}
                <div className="sticky inset-s-15 flex w-fit items-center gap-1.5 px-1">
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
                    "min-w-0 border-e p-1.5",
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
                    className="line-clamp-2 text-center text-sm font-medium wrap-break-word"
                    title={resource.title}
                  >
                    {resource.color && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "me-1.5 inline-block size-2.5 rounded-full border-[5px]",
                          getColorStyles(resource.color)[2],
                        )}
                      />
                    )}
                    {resource.title}
                  </div>
                  {allDayTiles(
                    index,
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
                "border-e border-neutral-200 p-2 text-center dark:border-neutral-800",
                dayHeaderClassName(day),
              )}
              key={index}
              onClick={() => isDayPickable(day) && onDateClick?.(day.date)}
            >
              {dayHeading(day, false)}
              {allDayTiles(index, dayLabelFormat.format(day.date))}
            </div>
          ))
        )}
      </div>
    </div>
  );

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

      {header}

      <div
        className="grid grid-cols-[60px_1fr]"
        style={{ minWidth: `${TIME_COLUMN_WIDTH + columnsMinWidth}px` }}
      >
        <div className="time-column sticky inset-s-0 z-10 bg-surface dark:bg-surface-dark">
          {timeSlots.map((timeSlot, index) => {
            const minutes = timeSlot.hour * 60 + timeSlot.minute;
            const next =
              index + 1 < timeSlots.length ? slotMinutesOf(index + 1) : 0;

            return (
              <div
                className={cn(
                  "relative border-e border-b bg-surface text-xs text-neutral-500 dark:bg-surface-dark dark:text-neutral-400",
                  index + 1 < timeSlots.length && !isLabelLine(next)
                    ? "border-e-neutral-200 border-b-neutral-100 dark:border-e-neutral-800 dark:border-b-neutral-800/50"
                    : "border-neutral-200 dark:border-neutral-800",
                  rowClassName,
                )}
                key={index}
                style={rowStyle}
              >
                {/* On one line - "10:00 AM" fits the column this way */}
                {isLabelLine(minutes) && (
                  <span className="absolute inset-e-1.5 top-1 whitespace-nowrap">
                    {formatPattern(
                      locale.formats.time,
                      {
                        // The end hour 24 is the midnight ending the day -
                        // 12:00 AM (not PM) on the 12-hour clock, 24:00 on
                        // the 24-hour one
                        hours: usesHour12(locale.formats.time)
                          ? timeSlot.hour % 24
                          : timeSlot.hour,
                        minutes: timeSlot.minute,
                      },
                      getDayPeriods(locale.code),
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className={cn("grid", isWholeWeek && "grid-cols-7")}
          onBlur={slotsFocusable ? slotFocus.handleBlur : undefined}
          onFocus={(event) => {
            // Below the header, right of the time column
            revealFocus(
              event.target,
              scrollRef.current,
              headerRef.current?.offsetHeight ?? 0,
              isSingleDay ? 0 : TIME_COLUMN_WIDTH,
            );
            if (slotsFocusable) slotFocus.handleFocus(event);
          }}
          onKeyDown={slotsFocusable ? slotFocus.handleKeyDown : undefined}
          ref={gridRef}
          style={columnsStyle}
        >
          {columns.map((column, columnIndex) => {
            const nowTop = nowLineTop(column);

            return (
              // A layer of its own - its crowded tiles stay under the
              // sticky header and time column
              <div
                className="day-column relative isolate"
                data-resource={column.resource?.id}
                key={columnIndex}
              >
                {/* The time out of the working hours - under the slots, so
                    their hover and focus show over it */}
                {offHoursOf(column).map((range) => (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 -z-10 bg-neutral-100 dark:bg-neutral-800/60"
                    data-off-hours=""
                    key={range.from}
                    style={{
                      height: `${toPixels(range.to - range.from)}px`,
                      top: `${toPixels(range.from - START_HOUR * 60)}px`,
                    }}
                  />
                ))}
                {endsDay(columnIndex) && (
                  <div className="pointer-events-none absolute inset-y-0 inset-e-0 w-px bg-neutral-300 dark:bg-neutral-600" />
                )}
                {timeSlots.map((_, index) => {
                  const pickable = isSlotPickable(columnIndex, index);
                  const next =
                    index + 1 < timeSlots.length ? slotMinutesOf(index + 1) : 0;

                  const handleSlotClick = () => {
                    const pressType = pressTypeRef.current;
                    pressTypeRef.current = null;
                    if (!pickable) return;

                    if (onDateClick) {
                      pickSlot(columnIndex, index);
                    } else if (
                      onSlotDragEnd &&
                      pressType !== "mouse" &&
                      pressType !== "pen"
                    ) {
                      const times = getTimeRange(
                        slotRange(columnIndex, index, index),
                      );
                      if (times) onSlotDragEnd(times);
                    }
                  };

                  const handleSlotPointerDown = (e: React.PointerEvent) => {
                    pressTypeRef.current = e.pointerType;
                    if (!pickable) return;
                    handleSlotDragStart(
                      e,
                      column.date,
                      slotMinutesOf(index),
                      column.resource?.id,
                    );
                  };

                  return (
                    <div
                      className={cn(
                        "border-e border-b",
                        index + 1 < timeSlots.length && !isLabelLine(next)
                          ? "border-e-neutral-200 border-b-neutral-100 dark:border-e-neutral-800 dark:border-b-neutral-800/50"
                          : "border-neutral-200 dark:border-neutral-800",
                        rowClassName,
                        pickable &&
                          slotsFocusable &&
                          "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
                        slotsFocusable &&
                          "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset",
                      )}
                      key={index}
                      onClick={handleSlotClick}
                      onPointerDown={handleSlotPointerDown}
                      style={rowStyle}
                      {...(slotsFocusable && {
                        "aria-disabled": !pickable || undefined,
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
                      className="pointer-events-none absolute inset-x-1 rounded-md border-2 border-dashed border-primary-500 bg-primary-100/50 dark:bg-primary-900/50 forced-colors:border-[Highlight]"
                      style={{
                        // Clock minutes, like the event tiles - also over a
                        // daylight saving change
                        top: `${toPixels(selectedRange.from - START_HOUR * 60)}px`,
                        height: `${toPixels(selectedRange.to - selectedRange.from)}px`,
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
                  isAnyDragging={isPointerDragging}
                  isClickable={isClickable}
                  isDragging={isDragging}
                  moveShortcut={moveShortcut}
                  onDragStart={(e, event, type) =>
                    move.handleDragStart(
                      e,
                      event,
                      type,
                      gridGeometry(event, type, columnIndex),
                    )
                  }
                  onEventClick={handleEventClick}
                  onTileBlur={move.handleBlur}
                  onTileKeyDown={(e, event) =>
                    move.handleKeyDown(e, event, {
                      clickable: isClickable(event),
                      day: column.date,
                      getGeometry: (type) =>
                        (type === "move" && onEventDrop) ||
                        (type === "resize-end" && onEventResize)
                          ? gridGeometry(event, type, columnIndex)
                          : null,
                      timeAxis: "y",
                    })
                  }
                  renderEvent={renderEvent}
                  renderEventActions={renderEventActions}
                  renderEventIcon={renderEventIcon}
                  slotDurationMinutes={SLOT_DURATION}
                  slotHeight={SLOT_HEIGHT}
                  startHour={START_HOUR}
                  tileClassName={tileClassName}
                  timeText={(_, times) => timeText(times)}
                  view={view}
                />

                {/* The current time - a picture, today is marked in the
                    header. Red also in forced colors mode, where a line of
                    the text color would pass for a line of the grid. */}
                {nowTop !== null && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-3 h-0.5 -translate-y-1/2 bg-danger-500 forced-color-adjust-none dark:bg-danger-400"
                    data-now-indicator=""
                    style={{ top: `${nowTop}px` }}
                  >
                    <span className="absolute -inset-s-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-danger-500 dark:bg-danger-400" />
                  </div>
                )}
              </div>
            );
          })}
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
