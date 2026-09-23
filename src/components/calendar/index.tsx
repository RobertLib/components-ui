import type {
  CalendarEvent,
  CalendarView,
  EventTimeChange,
  NewEventTimeRange,
} from "./types";
import { useCallback, useState } from "react";
import CalendarHeader from "./calendar-header";
import cn from "../../utils/cn";
import DayView from "./day-view";
import MonthView from "./month-view";
import WeekView from "./week-view";

export type {
  CalendarEvent,
  CalendarEventColor,
  CalendarView,
  EventTimeChange,
  NewEventTimeRange,
} from "./types";

export interface CalendarProps {
  className?: string;
  /** Controlled date - use together with `setCurrentDate`. */
  currentDate?: Date;
  /** Hour the week and day views end with (1 - 24). Default 22. */
  dayEndHour?: number;
  /** First hour of the week and day views (0 - 23). Default 7. */
  dayStartHour?: number;
  /**
   * Events to show - fetch those of
   * `getCalendarVisibleRange(date, view, weekStartsOn)`.
   */
  events?: CalendarEvent[];
  /** Date shown first by an uncontrolled calendar - today by default. */
  initialDate?: Date;
  /** View shown first by a calendar without `view`. */
  initialView?: CalendarView;
  /**
   * Return false to render an event as non-interactive - no pointer cursor and
   * `onEventClick` is not called. Defaults to clickable.
   */
  isEventClickable?: (event: CalendarEvent) => boolean;
  /** Shows a spinner over the view. */
  loading?: boolean;
  /** Days after it are disabled. */
  maxDate?: Date;
  /** Days before it are disabled. */
  minDate?: Date;
  /** A day (month view) or a time slot (week and day views) was clicked. */
  onDateClick?: (date: Date) => void;
  /** An event tile was clicked. */
  onEventClick?: (event: CalendarEvent) => void;
  /** Enables dragging events to another time or day (week and day views). */
  onEventDrop?: (change: EventTimeChange) => void;
  /** Enables resizing events by their top and bottom edge. */
  onEventResize?: (change: EventTimeChange) => void;
  /** Enables selecting a time range by dragging over empty slots, e.g. to create an event. */
  onSlotDragEnd?: (range: NewEventTimeRange) => void;
  /** The user switched the view. */
  onViewChange?: (view: CalendarView) => void;
  /**
   * Per-event controls rendered in the top-right corner of a tile, revealed on
   * hover. Clicks never reach the tile underneath, so an action here does not
   * also trigger `onEventClick`.
   */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  /** Icon rendered before the title of a tile. */
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
  /** Controlled date setter - called by the navigation. */
  setCurrentDate?: (date: Date) => void;
  /** Keeps the weekday header visible while the view scrolls. */
  stickyHeader?: boolean;
  /**
   * Controlled view - use together with `onViewChange`, e.g. to keep the
   * view in the URL.
   */
  view?: CalendarView;
  /** Views offered by the view switcher. */
  viewOptions?: CalendarView[];
}

const shiftDate = (date: Date, view: CalendarView, direction: 1 | -1) => {
  const newDate = new Date(date);

  if (view === "month") {
    // Stay within the target month - Jan 31 + 1 month must not skip February
    const day = newDate.getDate();
    newDate.setDate(1);
    newDate.setMonth(newDate.getMonth() + direction);
    const daysInMonth = new Date(
      newDate.getFullYear(),
      newDate.getMonth() + 1,
      0,
    ).getDate();
    newDate.setDate(Math.min(day, daysInMonth));
  } else if (view === "week") {
    newDate.setDate(newDate.getDate() + 7 * direction);
  } else {
    newDate.setDate(newDate.getDate() + direction);
  }

  return newDate;
};

/**
 * An event calendar with month, week and day views. Events can be clicked,
 * dragged to another time and resized; empty slots can be dragged over to
 * pick a range for a new event.
 */
export default function Calendar({
  className = "",
  currentDate: externalCurrentDate,
  dayEndHour = 22,
  dayStartHour = 7,
  events = [],
  initialDate,
  initialView = "month",
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
  setCurrentDate: externalSetCurrentDate,
  stickyHeader = true,
  view: controlledView,
  viewOptions = ["month", "week", "day"],
}: CalendarProps) {
  // Default to current date if no initialDate provided
  const [internalCurrentDate, setInternalCurrentDate] = useState(
    () => initialDate || new Date(),
  );

  // Use external currentDate if provided, otherwise use internal state
  const currentDate = externalCurrentDate ?? internalCurrentDate;
  const [internalView, setInternalView] = useState<CalendarView>(initialView);
  const view = controlledView ?? internalView;

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

  const viewProps = {
    currentDate,
    dayEndHour: endHour,
    dayStartHour: startHour,
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
    stickyHeader,
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-secondary-200 bg-surface shadow dark:border-secondary-700 dark:bg-surface-dark",
        className,
      )}
    >
      <CalendarHeader
        currentDate={currentDate}
        onDateSelect={changeDate}
        onNext={() => changeDate(shiftDate(currentDate, view, 1))}
        onPrevious={() => changeDate(shiftDate(currentDate, view, -1))}
        onViewChange={handleViewChange}
        view={view}
        viewOptions={viewOptions}
      />
      <div className="flex-1">
        {view === "week" ? (
          <WeekView {...viewProps} />
        ) : view === "day" ? (
          <DayView {...viewProps} />
        ) : (
          <MonthView {...viewProps} />
        )}
      </div>
    </div>
  );
}
