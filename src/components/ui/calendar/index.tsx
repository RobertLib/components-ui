import { copyDate, inTimeZone } from "../../../utils/time-zone";
import type {
  CalendarAgendaPeriod,
  CalendarBusinessHours,
  CalendarEvent,
  CalendarEventRenderContext,
  CalendarResource,
  CalendarSlotDuration,
  CalendarView,
  EventTimeChange,
  NewEventTimeRange,
} from "./types";
import { useCallback, useEffect, useMemo, useState } from "react";
import AgendaView from "./agenda-view";
import CalendarHeader from "./calendar-header";
import cn from "../../../utils/cn";
import { dateOf, shiftDay, startOfDay } from "../../../utils/date";
import DayView from "./day-view";
import { expandRecurringEvents } from "./recurrence";
import {
  getVisibleRange,
  normalizeAgendaPeriod,
  skipHiddenDays,
} from "./date-utils";
import logger from "../../../utils/logger";
import MonthView from "./month-view";
import { normalizeBusinessHours } from "./business-hours";
import TimelineView from "./timeline-view";
import useIsHydrated from "../../../hooks/use-is-hydrated";
import useToday from "../../../hooks/use-today";
import {
  SLOT_DURATIONS,
  createEventColorResolver,
  createEventLabeler,
  sortEvents,
} from "./utils";
import { useLocale } from "../../../providers/ui-context";
import WeekView from "./week-view";
import type { WeekDay } from "../../../i18n/types";

export type {
  CalendarAgendaPeriod,
  CalendarBusinessHours,
  CalendarEvent,
  CalendarEventColor,
  CalendarEventRenderContext,
  CalendarRecurrence,
  CalendarResource,
  CalendarSlotDuration,
  CalendarView,
  EventTimeChange,
  NewEventTimeRange,
} from "./types";

/**
 * Props of `Calendar` - also the attributes of its root element (`id`,
 * `style`, `data-*`, `aria-*`, event handlers), which gets the `ref` too.
 */
export interface CalendarProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /**
   * What the agenda view lists: the `"month"` of the current date (default),
   * its `"week"` or `"day"`, or a number of days from it (e.g. `14`). The
   * navigation moves by it - pass the same to `getCalendarVisibleRange`.
   */
  agendaPeriod?: CalendarAgendaPeriod;
  /** IANA time zone used for days, event times, recurrence and callbacks. Defaults to the browser zone. */
  timeZone?: string;
  /** Classes of the calendar's frame. */
  className?: string;
  /**
   * Working hours - `true` for 9:00 - 17:00 on Monday to Friday, or the
   * hours of some days (`{ days: [1, 2, 3, 4], start: "08:00", end:
   * "16:30" }`), several for a break or other hours on other days. The week,
   * day and timeline views shade the time out of them, the month view the
   * days without any; with `restrictToBusinessHours` only they can be
   * picked.
   */
  businessHours?: boolean | CalendarBusinessHours | CalendarBusinessHours[];
  /**
   * Controlled date - use together with `setCurrentDate`, without which the
   * navigation cannot change it.
   */
  currentDate?: Date;
  /**
   * Hour the week, day and timeline views end with (1 - 24). Default 22.
   * Events starting at it or later are offered by "+N later" in the header
   * of their day - the timeline leaves them out.
   */
  dayEndHour?: number;
  /**
   * First hour of the week, day and timeline views (0 - 23). Default 7.
   * Events over by then are offered by "+N earlier" in the header of their
   * day - the timeline leaves them out.
   */
  dayStartHour?: number;
  /**
   * Events to show - fetch those of
   * `getCalendarVisibleRange(date, view, weekStartsOn)`. In any order: the
   * views list all-day events first, then by start, the longer of events
   * starting together first. A recurring event (with `recurrence`) shows its
   * occurrences in the visible range - fetch the recurring events whose
   * occurrences may fall in it. Days and hours follow `timeZone` (the browser zone
   * when omitted): a page rendered on the server shows the events once it is
   * hydrated.
   */
  events?: CalendarEvent[];
  /**
   * Days of the week the views leave out - `[0, 6]` for a work week without
   * the weekend (`Date#getDay()`: 0 is Sunday). The week and month views
   * have no column for them, the day views skip them (a hidden date shows
   * the next visible day, or the previous one at `maxDate`), the agenda
   * lists no events on them. Their events are
   * not shown - `getCalendarVisibleRange` still has the days.
   */
  hiddenDays?: WeekDay[];
  /**
   * Date shown first by an uncontrolled calendar - today by default. Pass it
   * (or `currentDate`) when the page is rendered on the server: "today" of
   * the server and of the browser may differ, and the hydration would not
   * match - a date of the same day in both, like `new Date(2026, 8, 24)`
   * made where the component renders, or noon of the day.
   */
  initialDate?: Date;
  /**
   * View shown first by a calendar without `view` - the first of
   * `viewOptions` by default.
   */
  initialView?: CalendarView;
  /**
   * Return false to render an event as non-interactive - no pointer cursor and
   * `onEventClick` is not called. Defaults to clickable.
   */
  isEventClickable?: (event: CalendarEvent) => boolean;
  /** Whether this event may be moved. Defaults to true with `onEventDrop`. */
  canMoveEvent?: (event: CalendarEvent) => boolean;
  /** Whether this event may be resized. Defaults to true with `onEventResize`. */
  canResizeEvent?: (event: CalendarEvent) => boolean;
  /** Whether proposed times and resource are allowed, for both move and resize. */
  canDropEvent?: (change: EventTimeChange) => boolean;
  /** Shows a spinner over the view. */
  loading?: boolean;
  /**
   * Days after it are disabled - they cannot be picked, and events are
   * neither dropped on them nor moved or resized there. The navigation
   * (Next, Today, Page Down) goes no further than the period with it.
   */
  maxDate?: Date;
  /**
   * Days before it are disabled - they cannot be picked, and events are
   * neither dropped on them nor moved or resized there. The navigation
   * (Previous, Today, Page Up) goes no further than the period with it.
   */
  minDate?: Date;
  /**
   * Draws a line at the current time in the week, day and timeline views -
   * moved on every minute. Default `true`.
   */
  nowIndicator?: boolean;
  /**
   * A day (month view, a day heading of the agenda) or a time slot (week,
   * day and timeline views) was clicked, or picked with Enter or Space. A
   * slot in the column (or the timeline row) of a resource comes with its
   * `resourceId`.
   */
  onDateClick?: (date: Date, resourceId?: string) => void;
  /**
   * An event tile was clicked. An occurrence of a recurring event has
   * `recurringEventId` and `occurrenceStart` - ask whether the change is for
   * it or for the whole series.
   */
  onEventClick?: (event: CalendarEvent) => void;
  /**
   * Enables moving events to another time or day - in the week, day and
   * timeline views by whole slots, in the month view and the all-day row by
   * whole days (an all-day event stays one, every event keeps its length) -
   * and to another resource, with `newResourceId`. By the pointer, or by
   * the keys: Ctrl / ⌘ + X on a tile (Enter or Space on one without
   * `onEventClick`) picks the event up, the arrow keys move it, Enter puts
   * it down and Escape back.
   */
  onEventDrop?: (change: EventTimeChange) => void;
  /**
   * Enables resizing events by their top and bottom edge (the start and
   * end edge in the timeline) - by the pointer, or by Shift + the arrow
   * keys along the time once the keys picked the event up.
   */
  onEventResize?: (change: EventTimeChange) => void;
  /**
   * Enables selecting a time range by dragging over empty slots, e.g. to
   * create an event - in a resource column with its `resourceId`. From the
   * keyboard, Shift + arrow up / down select slots and Enter or Space pick
   * them; without `onDateClick`, Enter, Space or a tap on a slot pick that
   * one slot.
   */
  onSlotDragEnd?: (range: NewEventTimeRange) => void;
  /** The user switched the view. */
  onViewChange?: (view: CalendarView) => void;
  /**
   * Content of an event tile after its icon (`renderEventIcon`) - instead
   * of the title; `context.title` is that title (with its `htmlTitle`),
   * `context.timeText` when the event takes place, `context.view` and
   * `context.compact` how much room there is. The tile stays a button named
   * by the title and time of the event, and its actions stay - what this
   * renders is for the eye (screen readers get the name), so keep controls
   * out of it (`renderEventActions`).
   */
  renderEvent?: (
    event: CalendarEvent,
    context: CalendarEventRenderContext,
  ) => React.ReactNode;
  /**
   * Per-event controls rendered in the top-right corner of a tile, revealed on
   * hover. Presses and clicks never reach the tile underneath, so an action
   * here neither starts a drag nor triggers `onEventClick`; screen readers
   * get the controls next to the tile's button, not inside it.
   */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  /** Icon rendered before the title of a tile. */
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
  /**
   * Rooms, people, vehicles, … - the day and week views show a column for
   * each (the week one for each of every day), the timeline views a row,
   * with the events of the `resourceId`. Many columns scroll sideways under
   * the time column.
   */
  resources?: CalendarResource[];
  /**
   * Only the time of `businessHours` can be picked: a slot out of them is
   * neither clicked (`onDateClick`) nor selected (`onSlotDragEnd` - a range
   * stops at their end), nor a day without them in the month view and the
   * day headings. Events can still be moved there.
   */
  restrictToBusinessHours?: boolean;
  /** Controlled date setter - called by the navigation. */
  setCurrentDate?: (date: Date) => void;
  /**
   * Length of the time slots in minutes - 5, 10, 15, 20, 30 or 60. By
   * default half hours in the week view and hours in the day and timeline
   * views. Ranges are picked, and events moved and resized, by whole slots;
   * the time column writes the times every slot, or every quarter, half or
   * whole hour where the slots are short.
   */
  slotDuration?: CalendarSlotDuration;
  /** Keeps the weekday header visible while the view scrolls. */
  stickyHeader?: boolean;
  /**
   * Controlled view - use together with `onViewChange`, e.g. to keep the
   * view in the URL.
   */
  view?: CalendarView;
  /**
   * Views offered by the view switcher - add `"agenda"` for the list,
   * `"timelineDay"` / `"timelineWeek"` for the resources in rows.
   */
  viewOptions?: CalendarView[];
}

/** `date` moved by a period of the view - the agenda by its own period. */
const shiftDate = (
  date: Date,
  period: CalendarAgendaPeriod,
  direction: 1 | -1,
) => {
  const newDate = copyDate(date);

  if (period === "month") {
    // Stay within the target month - Jan 31 + 1 month must not skip February
    const day = newDate.getDate();
    newDate.setDate(1);
    newDate.setMonth(newDate.getMonth() + direction);
    const daysInMonth = dateOf(
      newDate.getFullYear(),
      newDate.getMonth() + 1,
      0,
      newDate,
    ).getDate();
    newDate.setDate(Math.min(day, daysInMonth));
  } else {
    // Whole days - over a day the time zone skips on to the next one in
    // the direction (`setDate` takes it for the day after it, also back)
    const days = period === "week" ? 7 : period === "day" ? 1 : period;
    const day = shiftDay(newDate, days * direction);
    newDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  }

  return newDate;
};

/**
 * The next visible day, or the previous one when the next is past the date
 * limits. A hidden day between the limits may have neither.
 */
function resolveVisibleDay(
  date: Date,
  hiddenDays: ReadonlySet<number>,
  minDate: Date | undefined,
  maxDate: Date | undefined,
) {
  const min = minDate && startOfDay(minDate);
  const max = maxDate && startOfDay(maxDate);

  for (const direction of [1, -1] as const) {
    const candidate = skipHiddenDays(date, hiddenDays, direction);
    const day = startOfDay(candidate);
    if ((!min || day >= min) && (!max || day <= max)) return candidate;
  }
  return null;
}

/**
 * An event calendar with month, week, day, agenda and resource timeline
 * views. Events can be clicked, moved to another time and resized - by the
 * pointer or the keys - repeat by a rule and belong to resources (rooms,
 * people) with a column or a row each; empty slots can be dragged over to
 * pick a range for a new event. Working hours are shaded, and days of the
 * week can be left out. The dates of today have `data-current`, the selected
 * day of the month grid `data-selected` - for styling.
 */
export default function Calendar({
  agendaPeriod: agendaPeriodProp,
  businessHours: businessHoursProp,
  className = "",
  currentDate: externalCurrentDate,
  dayEndHour = 22,
  dayStartHour = 7,
  events: sourceEvents = [],
  hiddenDays: hiddenDaysProp,
  initialDate,
  initialView,
  isEventClickable,
  canMoveEvent,
  canResizeEvent,
  canDropEvent,
  loading = false,
  maxDate: sourceMaxDate,
  minDate: sourceMinDate,
  timeZone,
  nowIndicator = true,
  onDateClick,
  onEventClick,
  onEventDrop,
  onEventResize,
  onSlotDragEnd,
  onViewChange,
  renderEvent,
  renderEventActions,
  renderEventIcon,
  resources,
  restrictToBusinessHours = false,
  setCurrentDate: externalSetCurrentDate,
  slotDuration: slotDurationProp,
  stickyHeader = true,
  view: controlledView,
  viewOptions = ["month", "week", "day"],
  ...props
}: CalendarProps) {
  const locale = useLocale();

  // Default to current date if no initialDate provided - on the server a
  // date of its own, which is why server rendering should pass one
  const [internalCurrentDate, setInternalCurrentDate] = useState(
    () => initialDate || new Date(),
  );

  // Use external currentDate if provided, otherwise use internal state
  const isControlled = externalCurrentDate !== undefined;
  const rawDateValue = externalCurrentDate ?? internalCurrentDate;
  const dateValue = useMemo(
    () => inTimeZone(rawDateValue, timeZone),
    [rawDateValue, timeZone],
  );
  const minDate = useMemo(
    () => sourceMinDate && inTimeZone(sourceMinDate, timeZone),
    [sourceMinDate, timeZone],
  );
  const maxDate = useMemo(
    () => sourceMaxDate && inTimeZone(sourceMaxDate, timeZone),
    [sourceMaxDate, timeZone],
  );

  // The navigation would silently do nothing
  useEffect(() => {
    if (isControlled && !externalSetCurrentDate) {
      logger.warn(
        "Calendar: `currentDate` without `setCurrentDate` cannot be navigated - use `initialDate` for the initial date.",
      );
    }
  }, [externalSetCurrentDate, isControlled]);

  const [internalView, setInternalView] = useState<CalendarView>(
    () => initialView ?? viewOptions[0] ?? "month",
  );
  const view = controlledView ?? internalView;
  const agendaPeriod = normalizeAgendaPeriod(agendaPeriodProp);

  // The weekdays left out - all of them would leave nothing, so none
  const hiddenKey = [...new Set(hiddenDaysProp ?? [])]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort()
    .join(",");
  const hiddenDays = useMemo(
    () =>
      new Set(
        hiddenKey && hiddenKey.split(",").length < 7
          ? hiddenKey.split(",").map(Number)
          : [],
      ),
    [hiddenKey],
  );

  // A step of the navigation - a period of the view (written out, the
  // compiler takes the result of a call for one that may change)
  const step =
    view === "agenda"
      ? agendaPeriod
      : view === "timelineDay"
        ? "day"
        : view === "timelineWeek"
          ? "week"
          : view;
  // A view of a day shows a visible day inside the limits when possible.
  // An app-provided date outside them still renders a disabled day; it
  // never updates the parent's date while rendering.
  const byDays = step === "day";
  const currentDate = useMemo(
    () =>
      byDays
        ? (resolveVisibleDay(dateValue, hiddenDays, minDate, maxDate) ??
          skipHiddenDays(dateValue, hiddenDays))
        : dateValue,
    [byDays, dateValue, hiddenDays, maxDate, minDate],
  );

  const { invalid: invalidHours, schedule: businessHours } = useMemo(
    () => normalizeBusinessHours(businessHoursProp),
    [businessHoursProp],
  );
  const invalidHoursText = invalidHours
    .map((hours) => `"${hours.start}" - "${hours.end}"`)
    .join(", ");
  useEffect(() => {
    if (invalidHoursText) {
      logger.warn(
        `Calendar: business hours ${invalidHoursText} are left out - give "HH:mm" times, the end after the start.`,
      );
    }
  }, [invalidHoursText]);

  // The length of the slots - the default of the view for any other
  const slotDuration =
    slotDurationProp !== undefined && SLOT_DURATIONS.includes(slotDurationProp)
      ? slotDurationProp
      : undefined;
  useEffect(() => {
    if (slotDurationProp !== undefined && slotDuration === undefined) {
      logger.warn(
        `Calendar: slotDuration ${slotDurationProp} is none of ${SLOT_DURATIONS.join(", ")} - the views show their default slots.`,
      );
    }
  }, [slotDuration, slotDurationProp]);

  // Tells screen readers - a text said again gets a space more, so that it
  // is said again
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback(
    (message: string) =>
      setAnnouncement((previous) =>
        previous.trimEnd() === message ? `${message} ` : message,
      ),
    [],
  );

  const startHour = Math.min(Math.max(0, Math.floor(dayStartHour)), 23);
  const endHour = Math.min(Math.max(startHour + 1, Math.floor(dayEndHour)), 24);

  const changeDate = useCallback(
    (date: Date) => {
      if (externalSetCurrentDate) {
        externalSetCurrentDate(date);
      } else {
        setInternalCurrentDate(date);
      }
    },
    [externalSetCurrentDate],
  );

  const handleViewChange = useCallback(
    (newView: CalendarView) => {
      if (controlledView === undefined) setInternalView(newView);
      onViewChange?.(newView);
    },
    [controlledView, onViewChange],
  );

  // The navigation goes towards the days of `minDate` - `maxDate`, not to a
  // period without one of them - also from a date out of them - and puts
  // the date on the first or the last of them
  const getNavigationDate = (date: Date) => {
    const { end, start } = getVisibleRange(
      date,
      "agenda",
      locale.weekStartsOn,
      {
        agendaPeriod: step,
      },
    );
    const canNavigate =
      date < currentDate
        ? !minDate || end > minDate
        : !maxDate || start <= maxDate;
    if (!canNavigate) return null;

    const target =
      minDate && date < minDate
        ? copyDate(minDate)
        : maxDate && date > maxDate
          ? copyDate(maxDate)
          : date;
    return byDays
      ? resolveVisibleDay(target, hiddenDays, minDate, maxDate)
      : target;
  };
  const canNavigateTo = (date: Date) => getNavigationDate(date) !== null;
  const navigate = (date: Date) => {
    const target = getNavigationDate(date);
    if (!target) return false;
    changeDate(target);
    return true;
  };

  // A day at a time over the hidden days - to the next one shown
  const previousDate =
    step === "day"
      ? skipHiddenDays(shiftDate(currentDate, step, -1), hiddenDays, -1)
      : shiftDate(currentDate, step, -1);
  const nextDate =
    step === "day"
      ? skipHiddenDays(shiftDate(currentDate, step, 1), hiddenDays)
      : shiftDate(currentDate, step, 1);
  const canGoPrevious = canNavigateTo(previousDate);
  const canGoNext = canNavigateTo(nextDate);

  // The days the view paints - recurring events repeat within them
  const range = getVisibleRange(currentDate, view, locale.weekStartsOn, {
    agendaPeriod,
  });
  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();
  const visibleRange = useMemo(
    () => ({
      end: inTimeZone(new Date(rangeEnd), timeZone),
      start: inTimeZone(new Date(rangeStart), timeZone),
    }),
    [rangeEnd, rangeStart, timeZone],
  );

  // The events follow the selected time zone (the browser zone by default), which
  // the server does not know - they show once the page is hydrated, so the
  // markup of the server always matches (see "Server rendering" in the
  // docs). A page rendered in the browser shows them from the start.
  const isHydrated = useIsHydrated();
  // The day of the Today button - checked again after midnight
  const today = useToday(timeZone);

  // The order of the tiles of a day and of the Tab key
  const sortedEvents = useMemo(
    () =>
      isHydrated
        ? sortEvents(
            expandRecurringEvents(sourceEvents, visibleRange, { timeZone }),
          )
        : [],
    [sourceEvents, isHydrated, visibleRange, timeZone],
  );

  const getEventLabel = useMemo(
    () => createEventLabeler(locale, resources, timeZone),
    [locale, resources, timeZone],
  );
  const getEventColor = useMemo(
    () => createEventColorResolver(resources),
    [resources],
  );

  const viewProps = {
    agendaPeriod,
    announce,
    businessHours,
    currentDate,
    dayEndHour: endHour,
    dayStartHour: startHour,
    events: sortedEvents,
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
    onNavigate: navigate,
    onSlotDragEnd,
    renderEvent,
    renderEventActions,
    renderEventIcon,
    resources,
    restrictToBusinessHours,
    slotDuration,
    stickyHeader,
    view,
    visibleRange,
  };

  return (
    <div
      {...props}
      className={cn(
        "flex flex-col overflow-hidden border border-secondary-200 bg-surface shadow dark:border-secondary-700 dark:bg-surface-dark",
        className,
      )}
    >
      <CalendarHeader
        agendaPeriod={agendaPeriod}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        // Today of the server and of the browser may differ - known once
        // the page is hydrated
        canGoToday={!today || canNavigateTo(inTimeZone(new Date(), timeZone))}
        currentDate={currentDate}
        maxDate={maxDate}
        minDate={minDate}
        onDateSelect={byDays ? navigate : changeDate}
        onNext={() => navigate(nextDate)}
        onPrevious={() => navigate(previousDate)}
        onToday={() => navigate(inTimeZone(new Date(), timeZone))}
        onViewChange={handleViewChange}
        view={view}
        viewOptions={viewOptions}
      />
      <div className="flex-1">
        {view === "week" ? (
          <WeekView {...viewProps} />
        ) : view === "day" ? (
          <DayView {...viewProps} />
        ) : view === "agenda" ? (
          <AgendaView {...viewProps} />
        ) : view === "timelineDay" || view === "timelineWeek" ? (
          <TimelineView {...viewProps} />
        ) : (
          <MonthView {...viewProps} />
        )}
      </div>
      {/* What the keys did to an event - picked up, moved, put down */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
