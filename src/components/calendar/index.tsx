import type {
  CalendarAgendaPeriod,
  CalendarEvent,
  CalendarResource,
  CalendarView,
  EventTimeChange,
  NewEventTimeRange,
} from "./types";
import { useCallback, useEffect, useMemo, useState } from "react";
import AgendaView from "./agenda-view";
import CalendarHeader from "./calendar-header";
import cn from "../../utils/cn";
import { dateOf, shiftDay } from "../../utils/date";
import DayView from "./day-view";
import { expandRecurringEvents } from "./recurrence";
import { getVisibleRange, normalizeAgendaPeriod } from "./date-utils";
import logger from "../../utils/logger";
import MonthView from "./month-view";
import useIsHydrated from "../../hooks/use-is-hydrated";
import {
  createEventColorResolver,
  createEventLabeler,
  sortEvents,
} from "./utils";
import { useLocale } from "../../providers/ui-context";
import WeekView from "./week-view";

export type {
  CalendarAgendaPeriod,
  CalendarEvent,
  CalendarEventColor,
  CalendarRecurrence,
  CalendarResource,
  CalendarView,
  EventTimeChange,
  NewEventTimeRange,
} from "./types";

export interface CalendarProps {
  /**
   * What the agenda view lists: the `"month"` of the current date (default),
   * its `"week"` or `"day"`, or a number of days from it (e.g. `14`). The
   * navigation moves by it - pass the same to `getCalendarVisibleRange`.
   */
  agendaPeriod?: CalendarAgendaPeriod;
  /** Classes of the calendar's frame. */
  className?: string;
  /**
   * Controlled date - use together with `setCurrentDate`, without which the
   * navigation cannot change it.
   */
  currentDate?: Date;
  /**
   * Hour the week and day views end with (1 - 24). Default 22. Events
   * starting at it or later are offered by "+N later" in the header of
   * their day.
   */
  dayEndHour?: number;
  /**
   * First hour of the week and day views (0 - 23). Default 7. Events over
   * by then are offered by "+N earlier" in the header of their day.
   */
  dayStartHour?: number;
  /**
   * Events to show - fetch those of
   * `getCalendarVisibleRange(date, view, weekStartsOn)`. In any order: the
   * views list all-day events first, then by start, the longer of events
   * starting together first. A recurring event (with `recurrence`) shows its
   * occurrences in the visible range - fetch the recurring events whose
   * occurrences may fall in it. Days and hours are those of the browser's
   * time zone: a page rendered on the server shows the events once it is
   * hydrated.
   */
  events?: CalendarEvent[];
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
  /** Shows a spinner over the view. */
  loading?: boolean;
  /**
   * Days after it are disabled - they cannot be picked, and events are
   * neither dropped on them nor moved or resized there.
   */
  maxDate?: Date;
  /**
   * Days before it are disabled - they cannot be picked, and events are
   * neither dropped on them nor moved or resized there.
   */
  minDate?: Date;
  /**
   * A day (month view, a day heading of the agenda) or a time slot (week and
   * day views) was clicked, or picked with Enter or Space. A slot in the
   * column of a resource comes with its `resourceId`.
   */
  onDateClick?: (date: Date, resourceId?: string) => void;
  /**
   * An event tile was clicked. An occurrence of a recurring event has
   * `recurringEventId` and `occurrenceStart` - ask whether the change is for
   * it or for the whole series.
   */
  onEventClick?: (event: CalendarEvent) => void;
  /**
   * Enables dragging events to another time or day (week and day views) -
   * and to another resource, with `newResourceId`.
   */
  onEventDrop?: (change: EventTimeChange) => void;
  /** Enables resizing events by their top and bottom edge. */
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
   * each (the week one for each of every day), with the events of the
   * `resourceId`. Many columns scroll sideways under the time column.
   */
  resources?: CalendarResource[];
  /** Controlled date setter - called by the navigation. */
  setCurrentDate?: (date: Date) => void;
  /** Keeps the weekday header visible while the view scrolls. */
  stickyHeader?: boolean;
  /**
   * Controlled view - use together with `onViewChange`, e.g. to keep the
   * view in the URL.
   */
  view?: CalendarView;
  /** Views offered by the view switcher - add `"agenda"` for the list. */
  viewOptions?: CalendarView[];
}

/** `date` moved by a period of the view - the agenda by its own period. */
const shiftDate = (
  date: Date,
  period: CalendarAgendaPeriod,
  direction: 1 | -1,
) => {
  const newDate = new Date(date);

  if (period === "month") {
    // Stay within the target month - Jan 31 + 1 month must not skip February
    const day = newDate.getDate();
    newDate.setDate(1);
    newDate.setMonth(newDate.getMonth() + direction);
    const daysInMonth = dateOf(
      newDate.getFullYear(),
      newDate.getMonth() + 1,
      0,
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
 * An event calendar with month, week, day and agenda views. Events can be
 * clicked, dragged to another time and resized, repeat by a rule and belong
 * to resources (rooms, people) with a column each; empty slots can be
 * dragged over to pick a range for a new event.
 */
export default function Calendar({
  agendaPeriod: agendaPeriodProp,
  className = "",
  currentDate: externalCurrentDate,
  dayEndHour = 22,
  dayStartHour = 7,
  events = [],
  initialDate,
  initialView,
  isEventClickable,
  loading = false,
  maxDate,
  minDate,
  onDateClick,
  onEventClick,
  onEventDrop,
  onEventResize,
  onSlotDragEnd,
  onViewChange,
  renderEventActions,
  renderEventIcon,
  resources,
  setCurrentDate: externalSetCurrentDate,
  stickyHeader = true,
  view: controlledView,
  viewOptions = ["month", "week", "day"],
}: CalendarProps) {
  const locale = useLocale();

  // Default to current date if no initialDate provided - on the server a
  // date of its own, which is why server rendering should pass one
  const [internalCurrentDate, setInternalCurrentDate] = useState(
    () => initialDate || new Date(),
  );

  // Use external currentDate if provided, otherwise use internal state
  const currentDate = externalCurrentDate ?? internalCurrentDate;
  const isControlled = externalCurrentDate !== undefined;

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

  // The days the view paints - recurring events repeat within them
  const range = getVisibleRange(currentDate, view, locale.weekStartsOn, {
    agendaPeriod,
  });
  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();
  const visibleRange = useMemo(
    () => ({ end: new Date(rangeEnd), start: new Date(rangeStart) }),
    [rangeEnd, rangeStart],
  );

  // The events go on the days and hours of the browser's time zone, which
  // the server does not know - they show once the page is hydrated, so the
  // markup of the server always matches (see "Server rendering" in the
  // docs). A page rendered in the browser shows them from the start.
  const isHydrated = useIsHydrated();

  // The order of the tiles of a day and of the Tab key
  const sortedEvents = useMemo(
    () =>
      isHydrated ? sortEvents(expandRecurringEvents(events, visibleRange)) : [],
    [events, isHydrated, visibleRange],
  );

  const getEventLabel = useMemo(
    () => createEventLabeler(locale, resources),
    [locale, resources],
  );
  const getEventColor = useMemo(
    () => createEventColorResolver(resources),
    [resources],
  );

  const viewProps = {
    agendaPeriod,
    currentDate,
    dayEndHour: endHour,
    dayStartHour: startHour,
    events: sortedEvents,
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
    onNavigate: changeDate,
    onSlotDragEnd,
    renderEventActions,
    renderEventIcon,
    resources,
    stickyHeader,
    visibleRange,
  };

  // A step of the navigation - a period of the view
  const step = view === "agenda" ? agendaPeriod : view;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-secondary-200 bg-surface shadow dark:border-secondary-700 dark:bg-surface-dark",
        className,
      )}
    >
      <CalendarHeader
        agendaPeriod={agendaPeriod}
        currentDate={currentDate}
        maxDate={maxDate}
        minDate={minDate}
        onDateSelect={changeDate}
        onNext={() => changeDate(shiftDate(currentDate, step, 1))}
        onPrevious={() => changeDate(shiftDate(currentDate, step, -1))}
        onToday={() => changeDate(new Date())}
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
        ) : (
          <MonthView {...viewProps} />
        )}
      </div>
    </div>
  );
}
