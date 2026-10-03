import { dateTimeZone } from "../../utils/time-zone";
import type {
  CalendarEvent,
  CalendarResource,
  CalendarViewProps,
} from "./types";
import {
  addCalendarDays,
  daysIntoWeek,
  getCalendarDay,
  isSameDay,
  minutesIntoDay,
} from "./date-utils";
import {
  getBusinessRanges,
  getOffHours,
  hasBusinessHours,
  isBusinessTime,
} from "./business-hours";
import {
  MIN_TILE_HEIGHT,
  createDayFormat,
  createSlotLabeler,
  createTimeLabeler,
  createTimeTextFormatter,
  formatTimeRange,
  getAllDayRange,
  getColorStyles,
  getEventTooltipText,
  isRtl,
  layoutEvents,
  revealFocus,
  withResource,
} from "./utils";
import {
  createTimelineGeometry,
  timelinePosition,
  type DragType,
  type TimelineAxis,
} from "./move-geometry";
import { useCallback, useMemo, useRef } from "react";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";
import Spinner from "../spinner";
import useCurrentMinute from "./use-current-minute";
import useToday from "../../hooks/use-today";
import useEventMove from "./use-event-move";
import useIsApplePlatform from "../../hooks/use-is-apple-platform";
import useSlotDrag, { toTimeRange, type SlotRange } from "./use-slot-drag";
import useSlotFocus from "./use-slot-focus";
import {
  formatPattern,
  getDayPeriods,
  getWeekdayNames,
  startOfDay,
} from "../../utils/date";
import { formatMessage, toIntlLocale } from "../../i18n/format";
import { toAriaKeyShortcuts } from "../../utils/shortcut";
import { useLocale } from "../../providers/ui-context";

/** Width of the column of the resource names, in pixels - `w-40`. */
const RESOURCE_COLUMN_WIDTH = 160;

/** Pixels of an hour of the day timeline - and of the week timeline. */
const HOUR_WIDTH = { day: 96, week: 40 };

/** Height of an event tile - a line of text - and of a lane of tiles. */
const LANE_HEIGHT = MIN_TILE_HEIGHT + 4;

/** Room above and below the lanes of a row. */
const ROW_PADDING = 4;

/** The lowest row - an empty one keeps room to pick a slot in. */
const MIN_ROW_HEIGHT = 48;

/** The narrowest tile - an event without a length shows too. */
const MIN_TILE_WIDTH = 24;

/** Width of a slot of the timeline in pixels - no narrower than 24. */
const getSlotWidth = (slotDuration: number, week: boolean) =>
  Math.max(
    Math.round(((week ? HOUR_WIDTH.week : HOUR_WIDTH.day) * slotDuration) / 60),
    24,
  );

/**
 * Every how many minutes the time row writes the time - the slots, or
 * whole hours and more where they are narrow: a time needs about 56 px.
 */
const getLabelInterval = (slotDuration: number, slotWidth: number) =>
  [slotDuration, 15, 30, 60, 120, 180, 240, 360].find(
    (interval) =>
      interval >= slotDuration &&
      interval % slotDuration === 0 &&
      (interval / slotDuration) * slotWidth >= 56,
  ) ?? 360;

/** A row of the timeline - a resource, or all events without resources. */
interface TimelineRow {
  resource?: CalendarResource;
}

/** An event in a row - where its tile goes. */
interface RowTile {
  event: CalendarEvent;
  /** The lane of the tile, 0 the top one. */
  lane: number;
  /** Width of the tile in pixels. */
  width: number;
  /** Pixels from the start of the timeline. */
  x: number;
}

/**
 * The resource timeline - `timelineDay` and `timelineWeek`: a row for each
 * resource, the hours shown of the day or the days of the week across them
 * in slots. Events are bars in the row of their resource, stacked where
 * they overlap - moved to another time or row and resized by their edges,
 * by the pointer and the keys; slots are picked by a click, a drag or the
 * keyboard (the arrow keys go across the time and down the resources).
 * The working hours are shaded, the current time is a line.
 */
export default function TimelineView({
  announce,
  businessHours,
  currentDate,
  dayEndHour,
  dayStartHour,
  events,
  getEventColor,
  getEventLabel,
  hiddenDays,
  isEventClickable,
  canMoveEvent,
  canResizeEvent,
  canDropEvent,
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
  slotDuration: slotDurationProp,
  stickyHeader = true,
  view,
}: CalendarViewProps) {
  const START_HOUR = dayStartHour;
  const END_HOUR = dayEndHour;
  const SLOT_DURATION = slotDurationProp ?? 60;
  const isWeek = view === "timelineWeek";
  const SLOT_WIDTH = getSlotWidth(SLOT_DURATION, isWeek);

  const locale = useLocale();
  // Sunday first, like `Date#getDay()`
  const weekdayNames = getWeekdayNames(locale.code, 0);
  const resourceList = resources && resources.length > 0 ? resources : null;
  const business = businessHours;

  // The rows - drags and the keys measure and find the slots in them
  const gridRef = useRef<HTMLDivElement>(null);
  // The view scrolls - a drag scrolls it along at its edges
  const scrollRef = useRef<HTMLDivElement>(null);
  // The days and hours on top - the focus stays below them
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

  // The days across - the day, or the days of the week not hidden; each at
  // its own start, none the time zone skips
  const axis = useMemo<TimelineAxis>(() => {
    const dates = isWeek
      ? Array.from({ length: 7 }, (_, index) =>
          getCalendarDay(
            currentDate,
            index - daysIntoWeek(currentDate, locale.weekStartsOn),
          ),
        )
          .filter((day) => day !== null)
          .filter((day) => !hiddenDays.has(day.getDay()))
      : [startOfDay(currentDate)];

    return {
      days: dates.map((day) => ({
        day,
        disabled: !!(
          (minDate && addCalendarDays(day, 1) <= minDate) ||
          (maxDate && day > maxDate)
        ),
      })),
      endHour: END_HOUR,
      slotDuration: SLOT_DURATION,
      startHour: START_HOUR,
    };
  }, [
    END_HOUR,
    SLOT_DURATION,
    START_HOUR,
    currentDate,
    hiddenDays,
    isWeek,
    locale.weekStartsOn,
    maxDate,
    minDate,
  ]);

  const rows = useMemo<TimelineRow[]>(
    () =>
      resourceList ? resourceList.map((resource) => ({ resource })) : [{}],
    [resourceList],
  );
  const rowResources = rows.map((row) => row.resource?.id);

  const minutesPerDay = (END_HOUR - START_HOUR) * 60;
  const slotsPerDay = minutesPerDay / SLOT_DURATION;
  const dayWidth = slotsPerDay * SLOT_WIDTH;
  const totalWidth = axis.days.length * dayWidth;
  const totalSlots = axis.days.length * slotsPerDay;
  const labelInterval = getLabelInterval(SLOT_DURATION, SLOT_WIDTH);

  // Pixels from the start of the timeline - of a date, of minutes of it
  const toPixels = (minutes: number) => (minutes / SLOT_DURATION) * SLOT_WIDTH;
  const xOf = (date: Date) => toPixels(timelinePosition(axis, date));
  // A time on a day shown, in its hours
  const isShownTime = (date: Date) => {
    const day = axis.days.find((item) => isSameDay(item.day, date));
    const minutes = day ? minutesIntoDay(day.day, date) : -1;
    return minutes >= START_HOUR * 60 && minutes < END_HOUR * 60;
  };

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
      axis,
      rowResources,
      SLOT_WIDTH,
      minDate,
      maxDate,
    ]),
    onEventDrop,
    onEventResize,
    canMoveEvent,
    canResizeEvent,
    canDropEvent,
    scrollRef,
  });
  const { getEventDisplayTimes, isDragging, isPointerDragging } = move;

  // The key that picks an event up - for `aria-keyshortcuts`
  const isApple = useIsApplePlatform();
  const moveShortcut = toAriaKeyShortcuts("mod+x", isApple);

  // The day and the clock minutes of a slot - its index across all days
  const slotDay = (slotIndex: number) =>
    axis.days[Math.floor(slotIndex / slotsPerDay)];
  const slotFrom = (slotIndex: number) =>
    START_HOUR * 60 + (slotIndex % slotsPerDay) * SLOT_DURATION;

  // The slots `first` - `last` of a row as a range - of one day
  const slotRange = (
    rowIndex: number,
    first: number,
    last: number,
  ): SlotRange => ({
    day: slotDay(first).day,
    from: slotFrom(first),
    resourceId: rows[rowIndex].resource?.id,
    to: slotFrom(last) + SLOT_DURATION,
  });

  const timeRangeLimits = {
    from: START_HOUR * 60,
    to: END_HOUR * 60,
    businessHours: restrictToBusinessHours ? business : null,
  };
  const getTimeRange = (range: SlotRange) =>
    toTimeRange(range, timeRangeLimits);

  // A slot that can be picked - of an enabled day, in the working hours
  // with `restrictToBusinessHours`
  const isSlotPickable = (slotIndex: number) => {
    const { day, disabled } = slotDay(slotIndex);
    const from = slotFrom(slotIndex);
    return (
      !disabled &&
      (business === null ||
        !restrictToBusinessHours ||
        isBusinessTime(business, day, from, from + SLOT_DURATION)) &&
      getTimeRange({ day, from, to: from + SLOT_DURATION }) !== null
    );
  };

  // The slots of a range the keys selected that can be picked - those of
  // the day of the first one around it, up to one out of the working hours
  const pickableRange = (
    rowIndex: number,
    anchor: number,
    first: number,
    last: number,
  ) => {
    if (!isSlotPickable(anchor)) return null;
    const dayStart = anchor - (anchor % slotsPerDay);
    let from = anchor;
    while (from > Math.max(first, dayStart) && isSlotPickable(from - 1)) {
      from--;
    }
    let to = anchor;
    while (
      to < Math.min(last, dayStart + slotsPerDay - 1) &&
      isSlotPickable(to + 1)
    ) {
      to++;
    }
    while (!getTimeRange(slotRange(rowIndex, from, to))) {
      if (to > anchor) to--;
      else if (from < anchor) from++;
      else return null;
    }
    return slotRange(rowIndex, from, to);
  };

  const pickSlot = (rowIndex: number, slotIndex: number) => {
    const range = getTimeRange(slotRange(rowIndex, slotIndex, slotIndex));
    if (!range) return;
    const resource = rows[rowIndex].resource;
    if (resource) {
      onDateClick?.(range.start, resource.id);
    } else {
      onDateClick?.(range.start);
    }
  };

  // Pointer and keyboard ranges belong to the same days, resources and limits.
  const slotGeometryKey = JSON.stringify([
    axis,
    rowResources,
    SLOT_WIDTH,
    minDate,
    maxDate,
    restrictToBusinessHours && business ? [...business] : null,
  ]);
  const { handleSlotDragStart, slotDragState } = useSlotDrag({
    axis: "x",
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
    slotHeight: SLOT_WIDTH,
    timeRangeLimits,
  });

  // Slots are picked with `onDateClick`, or they start a range
  const slotsFocusable = !!onDateClick || !!onSlotDragEnd;

  // The keyboard way to the slots - one tab stop; the arrow keys go across
  // the time and down the resources, Shift + ← / → select a range
  const slotFocus = useSlotFocus({
    days: rows.length,
    geometryKey: slotGeometryKey,
    gridRef,
    initialDay: 0,
    onActivate: (rowIndex, slotIndex) => {
      if (!isSlotPickable(slotIndex)) return;
      if (onDateClick) {
        pickSlot(rowIndex, slotIndex);
      } else {
        const times = getTimeRange(slotRange(rowIndex, slotIndex, slotIndex));
        if (times) onSlotDragEnd?.(times);
      }
    },
    onSelectRange: onSlotDragEnd
      ? (rowIndex, first, last, anchor) => {
          const range = pickableRange(rowIndex, anchor, first, last);
          const times = range && getTimeRange(range);
          if (times) onSlotDragEnd(times);
        }
      : undefined,
    orientation: "horizontal",
    slots: totalSlots,
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

  const getSlotLabel = createSlotLabeler(locale);
  const dayLabelFormat = createDayFormat(locale, dateTimeZone(currentDate));

  // Unknown on the server and while a server-rendered page hydrates - its
  // clock and time zone may differ from the browser's. Another day after
  // midnight, also in a view left open.
  const today = useToday(dateTimeZone(currentDate));
  const isToday = (date: Date) => today !== null && isSameDay(date, today);
  const now = useCurrentMinute(
    nowIndicator && axis.days.some(({ day }) => isToday(day)),
    dateTimeZone(currentDate),
  );
  // The line of the current time - within the hours shown of today
  const nowX = now && isShownTime(now) ? xOf(now) : null;

  // The tiles of a row: its events (a moved one in the row it is moved
  // to) in the time shown, in lanes where they overlap
  const tilesOf = (row: TimelineRow) => {
    const items: RowTile[] = [];
    for (const event of events) {
      const display = getEventDisplayTimes(event);
      if (resourceList && display.resourceId !== row.resource?.id) continue;

      const { end, start } = event.allDay
        ? getAllDayRange({ end: display.end, start: display.start })
        : display;
      const x = xOf(event.allDay ? startOfDay(start) : start);
      const endX = xOf(end);
      // Wholly out of the time shown - a night, a hidden day, another week;
      // an event without a length shows where it is, in the hours shown
      if (end <= start ? !isShownTime(start) : endX <= x) continue;

      items.push({
        event,
        lane: 0,
        width: Math.max(endX - x, MIN_TILE_WIDTH),
        x,
      });
    }

    const layout = layoutEvents(
      items.map((item) => ({
        from: item.x,
        id: item.event.id,
        to: item.x + item.width,
      })),
    );
    let lanes = 1;
    for (const item of items) {
      const placed = layout.get(item.event.id);
      item.lane = placed?.column ?? 0;
      lanes = Math.max(lanes, placed?.columns ?? 1);
    }

    return { items, lanes };
  };

  // How an event of a row moves - by the slots across, the rows down
  const timelineGeometry = (
    event: CalendarEvent,
    type: DragType,
    rowIndex: number,
    pressY?: number,
  ) =>
    createTimelineGeometry({
      axis,
      event,
      grid: gridRef.current,
      minDuration: Math.min(15, SLOT_DURATION),
      pressY,
      row: rowIndex,
      rows: rowResources,
      rtl: isRtl(scrollRef.current),
      slotWidth: SLOT_WIDTH,
      type,
    });

  // Where a press is in the rows - its row is found from it
  const pressYOf = (e: React.PointerEvent) =>
    e.clientY - (gridRef.current?.getBoundingClientRect().top ?? 0);

  const tile = (
    { event, lane, width, x }: RowTile,
    rowIndex: number,
  ): React.ReactNode => {
    const display = getEventDisplayTimes(event);
    const day = startOfDay(
      event.allDay ? getAllDayRange(display).start : display.start,
    );
    const dragging = isDragging(event.id);
    const clickable = isClickable(event);
    const color = getEventColor(event);
    // The events of a disabled day stay as they are
    const onEnabledDay = !axis.days.find((item) => isSameDay(item.day, day))
      ?.disabled;
    const movable =
      !!onEventDrop && onEnabledDay && (!canMoveEvent || canMoveEvent(event));
    const resizable =
      !!onEventResize &&
      !event.allDay &&
      onEnabledDay &&
      (!canResizeEvent || canResizeEvent(event));
    const keyMovable = movable || resizable;
    const title = (
      <EventTitle className="min-w-0 truncate font-medium" event={event}>
        {event.title}
      </EventTitle>
    );
    const handleClassName =
      "absolute inset-y-0 z-10 w-1.5 cursor-ew-resize touch-none hover:bg-black/10";

    return (
      <EventTile
        actions={renderEventActions?.(event)}
        className={cn(
          "absolute flex items-center overflow-hidden rounded-md border-s-2 px-1.5 text-xs leading-tight outline-[1.5px] outline-surface select-none dark:outline-surface-dark",
          ...getColorStyles(color),
          dragging && "opacity-80 shadow-lg ring-2 ring-primary-500",
          movable
            ? // A finger on it drags, it does not scroll the view
              "cursor-move touch-none"
            : clickable
              ? "cursor-pointer"
              : "cursor-default",
          isPointerDragging && !dragging && "pointer-events-none",
        )}
        clickable={clickable}
        contentClassName="flex min-w-0 items-center"
        eventDay={day}
        eventId={event.id}
        handles={
          resizable && (
            <>
              <div
                className={cn(handleClassName, "inset-s-0")}
                onPointerDown={(e) =>
                  move.handleDragStart(
                    e,
                    event,
                    "resize-start",
                    timelineGeometry(event, "resize-start", rowIndex),
                  )
                }
              />
              <div
                className={cn(handleClassName, "inset-e-0")}
                onPointerDown={(e) =>
                  move.handleDragStart(
                    e,
                    event,
                    "resize-end",
                    timelineGeometry(event, "resize-end", rowIndex),
                  )
                }
              />
            </>
          )
        }
        key={event.id}
        keyShortcuts={keyMovable ? moveShortcut : undefined}
        label={getEventLabel(event)}
        movable={keyMovable}
        onButtonBlur={keyMovable ? move.handleBlur : undefined}
        onButtonKeyDown={
          keyMovable
            ? (e) =>
                move.handleKeyDown(e, event, {
                  clickable,
                  day,
                  getGeometry: (type) =>
                    (type === "move" && movable) ||
                    (type === "resize-end" && resizable)
                      ? timelineGeometry(event, type, rowIndex)
                      : null,
                  timeAxis: "x",
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
                  timelineGeometry(event, "move", rowIndex, pressYOf(e)),
                )
            : undefined
        }
        style={{
          height: `${MIN_TILE_HEIGHT}px`,
          insetInlineStart: `${x}px`,
          top: `${ROW_PADDING + lane * LANE_HEIGHT}px`,
          width: `${width}px`,
          // Its own layer - the handles and actions of a tile stay on it
          zIndex: dragging ? 2 : 1,
        }}
        title={getEventTooltipText(event)}
      >
        {/* Optional custom icon renderer */}
        {renderEventIcon?.(event)}
        {renderEvent ? (
          // The label of the tile says it all to screen readers
          <span aria-hidden="true" className="min-w-0 flex-1 truncate">
            {renderEvent(event, {
              allDay: !!event.allDay,
              color,
              compact: true,
              dragging,
              timeText: timeText({ allDay: event.allDay, ...display }),
              title,
              view,
            })}
          </span>
        ) : (
          title
        )}
      </EventTile>
    );
  };

  // A day heading picks the day - not one out of `minDate` - `maxDate`, nor
  // one without working hours with `restrictToBusinessHours`
  const isDayPickable = (day: TimelineAxis["days"][number]) =>
    !day.disabled &&
    (business === null ||
      !restrictToBusinessHours ||
      hasBusinessHours(business, day.day));

  // The times the time row writes - every `labelInterval` minutes of a day
  const labels = Array.from(
    { length: Math.ceil(minutesPerDay / labelInterval) },
    (_, index) => START_HOUR * 60 + index * labelInterval,
  );

  return (
    <div
      className={cn(
        "timeline-view relative",
        // No text selected along a drag over the slots
        slotDragState && "select-none",
        stickyHeader ? "max-h-150 overflow-auto" : "overflow-x-auto",
      )}
      ref={scrollRef}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      <div style={{ minWidth: `${RESOURCE_COLUMN_WIDTH + totalWidth}px` }}>
        {/* Over the resource column (z-10) - it scrolls sideways under the
            corner */}
        <div
          className="sticky top-0 z-20 flex border-b border-neutral-200 bg-surface dark:border-neutral-800 dark:bg-surface-dark"
          ref={headerRef}
        >
          <div className="sticky inset-s-0 z-10 w-40 shrink-0 border-e border-neutral-200 bg-surface dark:border-neutral-800 dark:bg-surface-dark" />
          <div className="shrink-0" style={{ width: `${totalWidth}px` }}>
            <div className="flex">
              {axis.days.map((day) => {
                const isDayToday = isToday(day.day);
                const isSelected = isSameDay(day.day, currentDate);
                const dateClassName = cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full",
                  isSelected
                    ? "bg-primary-600 text-white forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
                    : isDayToday &&
                        "font-bold text-primary-600 ring-1 ring-primary-600 dark:text-primary-400 dark:ring-primary-400 forced-colors:outline-1",
                );
                const pickable = !!onDateClick && isDayPickable(day);

                return (
                  <div
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 border-e border-neutral-300 px-2 py-1.5 dark:border-neutral-600",
                      isSelected && "bg-primary-50 dark:bg-primary-900/30",
                      day.disabled && "opacity-60",
                      pickable &&
                        "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
                    )}
                    key={day.day.getTime()}
                    onClick={() => pickable && onDateClick?.(day.day)}
                    style={{ width: `${dayWidth}px` }}
                  >
                    {/* In view while the hours of the day scroll sideways -
                        beside the resource column */}
                    <span className="sticky inset-s-40 flex items-center gap-1.5">
                      <span className="font-medium">
                        {weekdayNames[day.day.getDay()]}
                      </span>
                      {pickable ? (
                        // The keyboard way to the day - its click reaches
                        // the heading
                        <button
                          aria-current={isDayToday ? "date" : undefined}
                          aria-label={dayLabelFormat.format(day.day)}
                          className={cn(
                            dateClassName,
                            "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500",
                          )}
                          data-current={isDayToday ? "" : undefined}
                          type="button"
                        >
                          {day.day.getDate()}
                        </button>
                      ) : (
                        <span
                          aria-current={isDayToday ? "date" : undefined}
                          className={dateClassName}
                          data-current={isDayToday ? "" : undefined}
                        >
                          {day.day.getDate()}
                        </span>
                      )}
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {day.day.toLocaleString(toIntlLocale(locale.code), {
                          calendar: "gregory",
                          month: "short",
                        })}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            {/* The times of the slots - a picture, the slots are named by
                their times */}
            <div aria-hidden="true" className="flex">
              {axis.days.map((day) =>
                labels.map((minutes) => (
                  <div
                    className="shrink-0 truncate border-e border-t border-neutral-200 px-1 py-0.5 text-xs whitespace-nowrap text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
                    key={`${day.day.getTime()}-${minutes}`}
                    style={{
                      width: `${toPixels(Math.min(labelInterval, END_HOUR * 60 - minutes))}px`,
                    }}
                  >
                    {formatPattern(
                      locale.formats.time,
                      {
                        hours: Math.floor(minutes / 60),
                        minutes: minutes % 60,
                      },
                      getDayPeriods(locale.code),
                    )}
                  </div>
                )),
              )}
            </div>
          </div>
        </div>

        <div
          className="relative"
          onBlur={slotsFocusable ? slotFocus.handleBlur : undefined}
          onFocus={(event) => {
            // Below the header, beside the resource column
            revealFocus(
              event.target,
              scrollRef.current,
              headerRef.current?.offsetHeight ?? 0,
              RESOURCE_COLUMN_WIDTH,
            );
            if (slotsFocusable) slotFocus.handleFocus(event);
          }}
          onKeyDown={slotsFocusable ? slotFocus.handleKeyDown : undefined}
          ref={gridRef}
        >
          {rows.map((row, rowIndex) => {
            const { items, lanes } = tilesOf(row);
            const height = Math.max(
              MIN_ROW_HEIGHT,
              lanes * LANE_HEIGHT + 2 * ROW_PADDING,
            );
            const { resource } = row;

            return (
              <div
                className="flex border-b border-neutral-200 dark:border-neutral-800"
                data-resource={resource?.id}
                data-row={rowIndex}
                key={resource?.id ?? rowIndex}
                style={{ height: `${height}px` }}
              >
                <div className="sticky inset-s-0 z-10 flex w-40 shrink-0 items-center border-e border-neutral-200 bg-surface px-2 dark:border-neutral-800 dark:bg-surface-dark">
                  {resource && (
                    // Two lines at most - the whole name on hover
                    <div
                      className="line-clamp-2 text-sm font-medium wrap-break-word"
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
                  )}
                </div>

                {/* A layer of its own - its tiles stay under the sticky
                    header and resource column */}
                <div
                  className="relative isolate shrink-0"
                  style={{ width: `${totalWidth}px` }}
                >
                  {/* The time out of the working hours - under the slots,
                      so their hover and focus show over it */}
                  {business &&
                    axis.days.map((day, dayIndex) =>
                      getOffHours(
                        business,
                        day.day,
                        START_HOUR * 60,
                        END_HOUR * 60,
                      ).map((range) => (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 -z-10 bg-neutral-100 dark:bg-neutral-800/60"
                          data-off-hours=""
                          key={`${dayIndex}-${range.from}`}
                          style={{
                            insetInlineStart: `${dayIndex * dayWidth + toPixels(range.from - START_HOUR * 60)}px`,
                            width: `${toPixels(range.to - range.from)}px`,
                          }}
                        />
                      )),
                    )}

                  <div className="flex h-full">
                    {Array.from({ length: totalSlots }, (_, slotIndex) => {
                      const pickable = isSlotPickable(slotIndex);
                      const minutes = slotFrom(slotIndex) + SLOT_DURATION;
                      // The line after a slot - of a day, of a written
                      // time, or a lighter one
                      const lineClassName =
                        minutes === END_HOUR * 60
                          ? "border-neutral-300 dark:border-neutral-600"
                          : (minutes - START_HOUR * 60) % labelInterval === 0
                            ? "border-neutral-200 dark:border-neutral-800"
                            : "border-neutral-100 dark:border-neutral-800/50";

                      const handleSlotClick = () => {
                        const pressType = pressTypeRef.current;
                        pressTypeRef.current = null;
                        if (!pickable) return;

                        if (onDateClick) {
                          pickSlot(rowIndex, slotIndex);
                        } else if (
                          onSlotDragEnd &&
                          pressType !== "mouse" &&
                          pressType !== "pen"
                        ) {
                          const times = getTimeRange(
                            slotRange(rowIndex, slotIndex, slotIndex),
                          );
                          if (times) onSlotDragEnd(times);
                        }
                      };

                      const handleSlotPointerDown = (e: React.PointerEvent) => {
                        pressTypeRef.current = e.pointerType;
                        if (!pickable) return;
                        handleSlotDragStart(
                          e,
                          slotDay(slotIndex).day,
                          slotFrom(slotIndex),
                          resource?.id,
                        );
                      };

                      return (
                        <div
                          className={cn(
                            "h-full shrink-0 border-e",
                            lineClassName,
                            pickable &&
                              slotsFocusable &&
                              "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700",
                            slotsFocusable &&
                              "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset",
                          )}
                          key={slotIndex}
                          onClick={handleSlotClick}
                          onPointerDown={handleSlotPointerDown}
                          style={{ width: `${SLOT_WIDTH}px` }}
                          {...(slotsFocusable && {
                            "aria-disabled": !pickable || undefined,
                            "aria-label": withResource(
                              locale,
                              resource?.title,
                              getSlotLabel(
                                slotDay(slotIndex).day,
                                slotFrom(slotIndex),
                              ),
                            ),
                            "data-slot": `${rowIndex}-${slotIndex}`,
                            role: "button",
                            tabIndex: slotFocus.isFocused(rowIndex, slotIndex)
                              ? 0
                              : -1,
                          })}
                        />
                      );
                    })}
                  </div>

                  {/* The range being picked */}
                  {selectedRange &&
                    selectedRange.resourceId === resource?.id &&
                    axis.days.some(({ day }) =>
                      isSameDay(day, selectedRange.day),
                    ) && (
                      <div
                        className="pointer-events-none absolute inset-y-1 rounded-md border-2 border-dashed border-primary-500 bg-primary-100/50 dark:bg-primary-900/50 forced-colors:border-[Highlight]"
                        style={{
                          insetInlineStart: `${
                            axis.days.findIndex(({ day }) =>
                              isSameDay(day, selectedRange.day),
                            ) *
                              dayWidth +
                            toPixels(selectedRange.from - START_HOUR * 60)
                          }px`,
                          width: `${toPixels(selectedRange.to - selectedRange.from)}px`,
                        }}
                      />
                    )}

                  {items.map((item) => tile(item, rowIndex))}
                </div>
              </div>
            );
          })}

          {/* The current time - a picture, today is marked in the header.
              Red also in forced colors mode, where a line of the text color
              would pass for a line of the grid. */}
          {nowX !== null && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-5 w-0.5 -translate-x-1/2 bg-danger-500 forced-color-adjust-none rtl:translate-x-1/2 dark:bg-danger-400"
              data-now-indicator=""
              style={{ insetInlineStart: `${RESOURCE_COLUMN_WIDTH + nowX}px` }}
            />
          )}
        </div>
      </div>

      {/* The range selected with the keyboard, for screen readers */}
      {onSlotDragEnd && (
        <div aria-live="polite" className="sr-only">
          {keyboardTimes &&
            formatMessage(locale.messages.calendar.rangeSelected, {
              range: withResource(
                locale,
                rows[selection?.day ?? 0]?.resource?.title,
                formatTimeRange(keyboardTimes.start, keyboardTimes.end, locale),
              ),
            })}
        </div>
      )}
    </div>
  );
}
