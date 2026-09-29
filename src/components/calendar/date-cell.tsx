import type {
  CalendarEvent,
  CalendarEventRenderContext,
  CalendarView,
} from "./types";
import { getColorStyles } from "./utils";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";
import MoreEvents from "./more-events";
import Tooltip from "../tooltip";
import { toISODate } from "../../utils/date";

export interface DateCellProps {
  /** Its events can be moved to other days - by the pointer or the keys. */
  canMove?: boolean;
  /** The day of the cell. */
  date: Date;
  /** The day is out of `minDate` - `maxDate` and cannot be picked. */
  disabled?: boolean;
  /** The event being moved - shown among the tiles of the day, not in "+N more". */
  draggingId?: string | null;
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
  /** An event is being dragged by the pointer - the tiles let it through. */
  isPointerDragging?: boolean;
  /** The day is the selected date of the calendar. */
  isSelected: boolean;
  /** The day is today. */
  isToday?: boolean;
  /** The full date, e.g. "Wednesday, September 23, 2026". */
  label: string;
  /** The key that picks an event up - `aria-keyshortcuts`. */
  moveShortcut?: string;
  /** The day has no working hours (`businessHours`) - it is shaded. */
  offHours?: boolean;
  /** The day was picked - by its button or a click in the cell. */
  onDateClick?: (date: Date) => void;
  /** An event tile was clicked. */
  onEventClick?: (event: CalendarEvent) => void;
  /** The focus left the button of a tile. */
  onTileBlur?: (e: React.FocusEvent<HTMLElement>) => void;
  /** The keys of the button of a tile - they move its event. */
  onTileKeyDown?: (
    e: React.KeyboardEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
  /** A press on a tile - it drags its event to another day. */
  onTilePointerDown?: (e: React.PointerEvent, event: CalendarEvent) => void;
  /**
   * The day can be picked - not a disabled one, nor one without working
   * hours with `restrictToBusinessHours`.
   */
  pickable?: boolean;
  /** Content of a tile after its icon - instead of the title. */
  renderEvent?: (
    event: CalendarEvent,
    context: CalendarEventRenderContext,
  ) => React.ReactNode;
  /** Per-event controls in the top-right corner of a tile. */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  /** Icon rendered before the title of a tile. */
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
  /** A cell of the grid of the month, or of its table without day buttons. */
  role?: "cell" | "gridcell";
  /** When an event takes place, as a tile writes it - for `renderEvent`. */
  timeText?: (event: CalendarEvent) => string;
  /** The view of the cell - for `renderEvent`. */
  view?: CalendarView;
}

const MAX_VISIBLE_EVENTS = 3;

interface MonthEventTileProps {
  /** Set by the `Tooltip` around the tile - it describes the tile's button. */
  "aria-describedby"?: string;
  /** The tile opens the event. */
  clickable: boolean;
  /** Its own color or that of its resource. */
  color: string | undefined;
  /** The day of the cell of the tile. */
  day: Date;
  /** The event is being moved. */
  dragging: boolean;
  /** The event of the tile. */
  event: CalendarEvent;
  /** The accessible name of the tile. */
  label: string;
  /** The event can be moved - the tile drags it and the keys pick it up. */
  movable: boolean;
  /** The key that picks the event up. */
  moveShortcut?: string;
  /** An event tile was clicked. */
  onEventClick?: (event: CalendarEvent) => void;
  /** The focus left the button of the tile. */
  onTileBlur?: (e: React.FocusEvent<HTMLElement>) => void;
  /** The keys of the button of the tile. */
  onTileKeyDown?: (
    e: React.KeyboardEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
  /** A press on the tile. */
  onTilePointerDown?: (e: React.PointerEvent, event: CalendarEvent) => void;
  /** Another event is dragged by the pointer - the tile lets it through. */
  passive: boolean;
  /** Content after the icon - instead of the title. */
  renderEvent?: DateCellProps["renderEvent"];
  /** Per-event controls in the top-right corner of the tile. */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  /** Icon rendered before the title. */
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
  /** When the event takes place - for `renderEvent`. */
  timeText?: (event: CalendarEvent) => string;
  /** The view - for `renderEvent`. */
  view?: CalendarView;
}

/** An event of the month view - in the day cell or the list of its events. */
function MonthEventTile({
  "aria-describedby": describedBy,
  clickable,
  color,
  day,
  dragging,
  event,
  label,
  movable,
  moveShortcut,
  onEventClick,
  onTileBlur,
  onTileKeyDown,
  onTilePointerDown,
  passive,
  renderEvent,
  renderEventActions,
  renderEventIcon,
  timeText,
  view = "month",
}: MonthEventTileProps) {
  const title = <EventTitle event={event}>{event.title}</EventTitle>;

  return (
    <EventTile
      actions={renderEventActions?.(event)}
      aria-describedby={describedBy}
      className={cn(
        // A narrower padding on phones - room for a letter before the "…"
        "relative w-full truncate rounded border-s-2 px-1 py-0.5 sm:px-2",
        ...getColorStyles(color),
        dragging && "opacity-80 shadow-lg ring-2 ring-primary-500",
        movable
          ? // A finger on it drags, it does not scroll the view
            "cursor-move touch-none select-none"
          : clickable
            ? "cursor-pointer"
            : "cursor-default",
        passive && "pointer-events-none",
      )}
      clickable={clickable}
      contentClassName="truncate"
      eventDay={day}
      eventId={movable ? event.id : undefined}
      keyShortcuts={movable ? moveShortcut : undefined}
      label={label}
      movable={movable}
      onButtonBlur={movable ? onTileBlur : undefined}
      onButtonKeyDown={movable ? (e) => onTileKeyDown?.(e, event) : undefined}
      onOpen={() => onEventClick?.(event)}
      onPointerDown={movable ? (e) => onTilePointerDown?.(e, event) : undefined}
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
      {renderEvent ? (
        // The label of the tile says it all to screen readers
        <span aria-hidden="true">
          {renderEvent(event, {
            allDay: !!event.allDay,
            color,
            compact: true,
            dragging,
            timeText: timeText?.(event) ?? "",
            title,
            view,
          })}
        </span>
      ) : (
        title
      )}
    </EventTile>
  );
}

export default function DateCell({
  canMove = false,
  date,
  disabled = false,
  draggingId = null,
  events,
  getEventColor,
  getEventLabel,
  isFocusTarget,
  isCurrentMonth,
  isEventClickable,
  isPointerDragging = false,
  isSelected,
  isToday = false,
  label,
  moveShortcut,
  offHours = false,
  onDateClick,
  onEventClick,
  onTileBlur,
  onTileKeyDown,
  onTilePointerDown,
  pickable = !disabled,
  renderEvent,
  renderEventActions,
  renderEventIcon,
  role = "gridcell",
  timeText,
  view,
}: DateCellProps) {
  const dayNumber = date.getDate();

  const hiddenCount = events.length - MAX_VISIBLE_EVENTS;
  // The moved event always has a tile of its own - not one in the list
  const moved = events.findIndex((event) => event.id === draggingId);
  const visibleEvents =
    hiddenCount > 0
      ? moved >= MAX_VISIBLE_EVENTS
        ? [...events.slice(0, MAX_VISIBLE_EVENTS - 1), events[moved]]
        : events.slice(0, MAX_VISIBLE_EVENTS)
      : events;

  const handleDateClick = () => {
    if (pickable && onDateClick) {
      onDateClick(date);
    }
  };

  const isClickable = (event: CalendarEvent) =>
    !!onEventClick && (isEventClickable?.(event) ?? true);

  // As wide as the cell - or in the list of "+N more" as its text, up to
  // the width of the list, where it does not move. A long title is cut
  // off, the actions stay on it.
  const tile = (event: CalendarEvent, fillsCell: boolean) => {
    const dragging = fillsCell && event.id === draggingId;

    return (
      <Tooltip
        className={fillsCell ? "w-full" : "max-w-full"}
        delay={300}
        // The tooltip may carry a long list (participants, …), so it stays
        // open while hovered and scrolls instead of overflowing the viewport.
        interactive
        key={event.id}
        title={
          // None over a drag
          draggingId === null ? (
            <div className="max-h-64 max-w-xs overflow-y-auto whitespace-pre-line">
              {/* An explicit tooltip replaces the event's own text, which
                  the tile already shows. */}
              {event.tooltip ??
                (event.timeText
                  ? `${event.title} (${event.timeText})`
                  : event.title)}
            </div>
          ) : undefined
        }
      >
        <MonthEventTile
          clickable={isClickable(event)}
          color={getEventColor(event)}
          day={date}
          dragging={dragging}
          event={event}
          label={getEventLabel(event)}
          movable={canMove && fillsCell && !disabled}
          moveShortcut={moveShortcut}
          onEventClick={onEventClick}
          onTileBlur={onTileBlur}
          onTileKeyDown={onTileKeyDown}
          onTilePointerDown={onTilePointerDown}
          passive={isPointerDragging && !dragging}
          renderEvent={renderEvent}
          renderEventActions={renderEventActions}
          renderEventIcon={renderEventIcon}
          timeText={timeText}
          view={view}
        />
      </Tooltip>
    );
  };

  const dayNumberClassName = cn(
    "inline-block h-6 w-6 rounded-full text-center",
    // In forced colors mode in the system colors of a selection
    isSelected &&
      "bg-primary-600 text-white forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
  );

  return (
    <div
      className={cn(
        "date-cell relative h-32 overflow-hidden border-e border-neutral-200 p-1 transition-colors dark:border-neutral-800",
        !isCurrentMonth &&
          "bg-neutral-50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
        // A day without working hours - under the other marks
        offHours &&
          isCurrentMonth &&
          !isSelected &&
          "bg-neutral-100/70 dark:bg-neutral-800/50",
        isSelected && "bg-primary-50 dark:bg-primary-900/30",
        disabled && "cursor-not-allowed opacity-60",
        pickable &&
          onDateClick &&
          "cursor-pointer hover:bg-neutral-100/30 dark:hover:bg-neutral-700/30",
      )}
      data-off-hours={offHours ? "" : undefined}
      onClick={handleDateClick}
      role={role}
    >
      <div className="flex items-start justify-between">
        {onDateClick ? (
          // The keyboard way to the day - its click reaches the cell. Arrow
          // keys move between the days (see MonthView).
          <button
            aria-current={isToday ? "date" : undefined}
            aria-disabled={!pickable || undefined}
            aria-label={label}
            // The selected date - a toggle button in the pressed state
            aria-pressed={isSelected}
            className={cn(
              dayNumberClassName,
              "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500",
              !pickable && "cursor-not-allowed",
            )}
            data-current={isToday ? "" : undefined}
            data-day={toISODate(date)}
            data-selected={isSelected ? "" : undefined}
            tabIndex={isFocusTarget ? 0 : -1}
            type="button"
          >
            {dayNumber}
          </button>
        ) : (
          <span
            aria-current={isToday ? "date" : undefined}
            className={dayNumberClassName}
            data-current={isToday ? "" : undefined}
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
