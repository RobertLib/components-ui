import type { CalendarEvent } from "./types";
import { clickableTileProps, getColorStyles } from "./utils";
import cn from "../../utils/cn";
import EventActions from "./event-actions";
import EventTitle from "./event-title";
import Popover from "../popover";
import Tooltip from "../tooltip";
import { formatPlural } from "../../i18n/format";
import { toISODate } from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

export interface DateCellProps {
  date: Date;
  disabled?: boolean;
  events: CalendarEvent[];
  /** The day button is the tab stop of the month grid. */
  isFocusTarget: boolean;
  isCurrentMonth: boolean;
  /**
   * Return false to render an event as non-interactive - no pointer cursor and
   * `onEventClick` is not called. Defaults to clickable.
   */
  isEventClickable?: (event: CalendarEvent) => boolean;
  /** The day is the selected date of the calendar. */
  isSelected: boolean;
  /** The full date, e.g. "Wednesday, September 23, 2026". */
  label: string;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
}

const MAX_VISIBLE_EVENTS = 3;

interface EventTileProps {
  clickable: boolean;
  event: CalendarEvent;
  onEventClick?: (event: CalendarEvent) => void;
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
}

/** An event of the month view - in the day cell or the list of its events. */
function EventTile({
  clickable,
  event,
  onEventClick,
  renderEventActions,
  renderEventIcon,
}: EventTileProps) {
  const open = () => {
    if (clickable) onEventClick?.(event);
  };

  return (
    <Tooltip
      delay={300}
      // The tooltip may carry a long list (participants, …), so it stays
      // open while hovered and scrolls instead of overflowing the viewport.
      interactive
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
      <div
        className={cn(
          "group/event relative w-full truncate rounded border-l-2 px-2 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
          ...getColorStyles(event.color),
          clickable ? "cursor-pointer" : "cursor-default",
        )}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        {...(clickable ? clickableTileProps(open) : {})}
      >
        {renderEventActions && (
          <EventActions>{renderEventActions(event)}</EventActions>
        )}

        {/* Optional custom icon renderer - month tiles are cramped, so the
            icons are shrunk. Only the icons: an event badge may wrap its
            icon together with a number, and forcing the wrapper to 10px
            would clip the number away. */}
        <div className="text-[10px] [&_svg]:h-2.5! [&_svg]:w-2.5!">
          {renderEventIcon?.(event)}
        </div>
        <EventTitle event={event} htmlClassName="truncate">
          {event.title}
        </EventTitle>
      </div>
    </Tooltip>
  );
}

export default function DateCell({
  date,
  disabled = false,
  events,
  isFocusTarget,
  isCurrentMonth,
  isEventClickable,
  isSelected,
  label,
  onDateClick,
  onEventClick,
  renderEventActions,
  renderEventIcon,
}: DateCellProps) {
  const locale = useLocale();
  const { messages } = locale;
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

  const tile = (event: CalendarEvent) => (
    <EventTile
      clickable={isClickable(event)}
      event={event}
      key={event.id}
      onEventClick={onEventClick}
      renderEventActions={renderEventActions}
      renderEventIcon={renderEventIcon}
    />
  );

  const dayNumberClassName = cn(
    "inline-block h-6 w-6 rounded-full text-center",
    isSelected && "bg-primary-500 text-white",
  );

  return (
    <div
      className={cn(
        "date-cell relative h-32 overflow-hidden border-r border-neutral-200 p-1 transition-colors dark:border-neutral-800",
        !isCurrentMonth && "bg-neutral-50 text-neutral-400 dark:bg-neutral-800",
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
            aria-disabled={disabled || undefined}
            aria-label={label}
            className={cn(
              dayNumberClassName,
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
              disabled && "cursor-not-allowed",
            )}
            data-day={toISODate(date)}
            tabIndex={isFocusTarget ? 0 : -1}
            type="button"
          >
            {dayNumber}
          </button>
        ) : (
          <span className={dayNumberClassName}>{dayNumber}</span>
        )}
      </div>
      <div className="mt-1 space-y-1 overflow-hidden text-xs">
        {visibleEvents.map(tile)}
        {hiddenCount > 0 && (
          // A click here opens the list, not the day
          <div onClick={(event) => event.stopPropagation()}>
            <Popover
              className="inline-block"
              contentClassName="p-2"
              position="bottom"
              trigger={
                <span className="rounded px-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200">
                  {formatPlural(
                    locale.code,
                    messages.calendar.more,
                    hiddenCount,
                  )}
                </span>
              }
              triggerType="click"
              width="220px"
            >
              <div className="mb-1.5 text-sm font-semibold">{label}</div>
              {/* One event per line - the tiles are as wide as their text */}
              <div className="space-y-1 text-xs">
                {events.map((event) => (
                  <div key={event.id}>{tile(event)}</div>
                ))}
              </div>
            </Popover>
          </div>
        )}
      </div>
    </div>
  );
}
