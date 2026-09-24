import type { CalendarEvent } from "./types";
import { getColorStyles } from "./utils";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";
import MoreEvents from "./more-events";
import Tooltip from "../tooltip";
import { toISODate } from "../../utils/date";

export interface DateCellProps {
  /** The day of the cell. */
  date: Date;
  /** The day is out of `minDate` - `maxDate` and cannot be picked. */
  disabled?: boolean;
  /** The events shown on the day, in their order. */
  events: CalendarEvent[];
  /** The color of an event - its own or that of its resource. */
  getEventColor: (event: CalendarEvent) => string | undefined;
  /** The accessible name of a tile (`createEventLabeler`). */
  getEventLabel: (event: CalendarEvent) => string;
  /** The day button is the tab stop of the month grid. */
  isFocusTarget: boolean;
  /** The day is in the month shown - the days around it are dimmed. */
  isCurrentMonth: boolean;
  /**
   * Return false to render an event as non-interactive - no pointer cursor and
   * `onEventClick` is not called. Defaults to clickable.
   */
  isEventClickable?: (event: CalendarEvent) => boolean;
  /** The day is the selected date of the calendar. */
  isSelected: boolean;
  /** The day is today. */
  isToday?: boolean;
  /** The full date, e.g. "Wednesday, September 23, 2026". */
  label: string;
  /** The day was picked - by its button or a click in the cell. */
  onDateClick?: (date: Date) => void;
  /** An event tile was clicked. */
  onEventClick?: (event: CalendarEvent) => void;
  /** Per-event controls in the top-right corner of a tile. */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  /** Icon rendered before the title of a tile. */
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
}

const MAX_VISIBLE_EVENTS = 3;

interface MonthEventTileProps {
  /** Set by the `Tooltip` around the tile - it describes the tile's button. */
  "aria-describedby"?: string;
  /** The tile opens the event. */
  clickable: boolean;
  /** Its own color or that of its resource. */
  color: string | undefined;
  /** The event of the tile. */
  event: CalendarEvent;
  /** The accessible name of the tile. */
  label: string;
  /** An event tile was clicked. */
  onEventClick?: (event: CalendarEvent) => void;
  /** Per-event controls in the top-right corner of the tile. */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  /** Icon rendered before the title. */
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
}

/** An event of the month view - in the day cell or the list of its events. */
function MonthEventTile({
  "aria-describedby": describedBy,
  clickable,
  color,
  event,
  label,
  onEventClick,
  renderEventActions,
  renderEventIcon,
}: MonthEventTileProps) {
  return (
    <EventTile
      actions={renderEventActions?.(event)}
      aria-describedby={describedBy}
      className={cn(
        // A narrower padding on phones - room for a letter before the "…"
        "relative w-full truncate rounded border-l-2 px-1 py-0.5 sm:px-2",
        ...getColorStyles(color),
        clickable ? "cursor-pointer" : "cursor-default",
      )}
      clickable={clickable}
      contentClassName="truncate"
      label={label}
      onOpen={() => onEventClick?.(event)}
    >
      {/* Optional custom icon renderer - month tiles are cramped, so the
          icons are shrunk. Only the icons: an event badge may wrap its
          icon together with a number, and forcing the wrapper to 10px
          would clip the number away. Inline, on the line of the title. */}
      {renderEventIcon && (
        <span className="text-[10px] [&_svg]:h-2.5! [&_svg]:w-2.5!">
          {renderEventIcon(event)}
        </span>
      )}
      <EventTitle event={event}>{event.title}</EventTitle>
    </EventTile>
  );
}

export default function DateCell({
  date,
  disabled = false,
  events,
  getEventColor,
  getEventLabel,
  isFocusTarget,
  isCurrentMonth,
  isEventClickable,
  isSelected,
  isToday = false,
  label,
  onDateClick,
  onEventClick,
  renderEventActions,
  renderEventIcon,
}: DateCellProps) {
  const dayNumber = date.getDate();

  const hiddenCount = events.length - MAX_VISIBLE_EVENTS;
  const visibleEvents =
    hiddenCount > 0 ? events.slice(0, MAX_VISIBLE_EVENTS) : events;

  const handleDateClick = () => {
    if (!disabled && onDateClick) {
      onDateClick(date);
    }
  };

  const isClickable = (event: CalendarEvent) =>
    !!onEventClick && (isEventClickable?.(event) ?? true);

  // As wide as the cell - or in the list of "+N more" as its text, up to
  // the width of the list. A long title is cut off, the actions stay on it.
  const tile = (event: CalendarEvent, fillsCell: boolean) => (
    <Tooltip
      className={fillsCell ? "w-full" : "max-w-full"}
      delay={300}
      // The tooltip may carry a long list (participants, …), so it stays
      // open while hovered and scrolls instead of overflowing the viewport.
      interactive
      key={event.id}
      title={
        <div className="max-h-64 max-w-xs overflow-y-auto whitespace-pre-line">
          {/* An explicit tooltip replaces the event's own text, which
              the tile already shows. */}
          {event.tooltip ??
            (event.timeText
              ? `${event.title} (${event.timeText})`
              : event.title)}
        </div>
      }
    >
      <MonthEventTile
        clickable={isClickable(event)}
        color={getEventColor(event)}
        event={event}
        label={getEventLabel(event)}
        onEventClick={onEventClick}
        renderEventActions={renderEventActions}
        renderEventIcon={renderEventIcon}
      />
    </Tooltip>
  );

  const dayNumberClassName = cn(
    "inline-block h-6 w-6 rounded-full text-center",
    isSelected && "bg-primary-600 text-white",
  );

  return (
    <div
      className={cn(
        "date-cell relative h-32 overflow-hidden border-r border-neutral-200 p-1 transition-colors dark:border-neutral-800",
        !isCurrentMonth &&
          "bg-neutral-50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
        isSelected && "bg-primary-50 dark:bg-primary-900/30",
        disabled && "cursor-not-allowed opacity-60",
        !disabled &&
          onDateClick &&
          "cursor-pointer hover:bg-neutral-100/30 dark:hover:bg-neutral-700/30",
      )}
      onClick={handleDateClick}
    >
      <div className="flex items-start justify-between">
        {onDateClick ? (
          // The keyboard way to the day - its click reaches the cell. Arrow
          // keys move between the days (see MonthView).
          <button
            aria-current={isToday ? "date" : undefined}
            aria-disabled={disabled || undefined}
            aria-label={label}
            // The selected date - a toggle button in the pressed state
            aria-pressed={isSelected}
            className={cn(
              dayNumberClassName,
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              disabled && "cursor-not-allowed",
            )}
            data-day={toISODate(date)}
            tabIndex={isFocusTarget ? 0 : -1}
            type="button"
          >
            {dayNumber}
          </button>
        ) : (
          <span
            aria-current={isToday ? "date" : undefined}
            className={dayNumberClassName}
          >
            {dayNumber}
          </span>
        )}
      </div>
      <div className="mt-1 space-y-1 overflow-hidden text-xs">
        {visibleEvents.map((event) => tile(event, true))}
        {hiddenCount > 0 && (
          <MoreEvents count={hiddenCount} label={label}>
            {events.map((event) => (
              <div key={event.id}>{tile(event, false)}</div>
            ))}
          </MoreEvents>
        )}
      </div>
    </div>
  );
}
