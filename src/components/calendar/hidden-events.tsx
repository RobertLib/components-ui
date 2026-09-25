import type { CalendarEvent, CalendarViewProps } from "./types";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";
import MoreEvents from "./more-events";
import {
  createTimeFormat,
  getColorStyles,
  getEventTooltipText,
  getHiddenSide,
} from "./utils";
import { useLocale } from "../../providers/ui-context";

interface HiddenEventsProps extends Pick<
  CalendarViewProps,
  "getEventColor" | "getEventLabel" | "renderEventActions" | "renderEventIcon"
> {
  /** The day of the column. */
  day: Date;
  /** Hour the grid ends with. */
  endHour: number;
  /** The timed events of the column, in their order. */
  events: CalendarEvent[];
  /** The times an event is shown at - a dragged one where it is dragged to. */
  getDisplayTimes: (event: CalendarEvent) => { end: Date; start: Date };
  /** Whether an event opens on a click of its tile. */
  isClickable: (event: CalendarEvent) => boolean;
  /** Heading of the lists - the full date of the day (and its resource). */
  label: string;
  /** Opens an event - the click of its tile. */
  onEventOpen: (event: CalendarEvent) => void;
  /** First hour of the grid. */
  startHour: number;
}

/**
 * "+N earlier" and "+N later" in the header of a column of the week and day
 * views - the timed events no part of which lies in the hours shown
 * (`dayStartHour` - `dayEndHour`), which the grid has no row for. Each opens
 * the list of them, like "+N more" of the month view.
 */
export default function HiddenEvents({
  day,
  endHour,
  events,
  getDisplayTimes,
  getEventColor,
  getEventLabel,
  isClickable,
  label,
  onEventOpen,
  renderEventActions,
  renderEventIcon,
  startHour,
}: HiddenEventsProps) {
  const locale = useLocale();
  const { messages } = locale;
  const timeFormat = createTimeFormat(locale);

  // A timed event in a list - with its start, as the grid has no row for it
  const tile = (event: CalendarEvent) => (
    <EventTile
      actions={renderEventActions?.(event)}
      className={cn(
        "relative truncate rounded border-l-2 px-1 py-0.5 text-xs",
        ...getColorStyles(getEventColor(event)),
        isClickable(event) ? "cursor-pointer" : "cursor-default",
      )}
      clickable={isClickable(event)}
      contentClassName="truncate"
      label={getEventLabel(event)}
      onOpen={() => onEventOpen(event)}
      title={getEventTooltipText(event)}
    >
      <span className="mr-1 tabular-nums">
        {timeFormat.format(getDisplayTimes(event).start)}
      </span>
      {renderEventIcon?.(event)}
      <EventTitle event={event}>{event.title}</EventTitle>
    </EventTile>
  );

  const earlier: CalendarEvent[] = [];
  const later: CalendarEvent[] = [];
  for (const event of events) {
    const { end, start } = getDisplayTimes(event);
    const side = getHiddenSide(start, end, day, startHour, endHour);
    if (side === "earlier") earlier.push(event);
    if (side === "later") later.push(event);
  }

  if (earlier.length === 0 && later.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap justify-center gap-x-1 text-left">
      {(
        [
          [earlier, messages.calendar.earlier],
          [later, messages.calendar.later],
        ] as const
      ).map(
        ([list, message], index) =>
          list.length > 0 && (
            <MoreEvents
              count={list.length}
              key={index}
              label={label}
              message={message}
            >
              {list.map((event) => (
                <div key={event.id}>{tile(event)}</div>
              ))}
            </MoreEvents>
          ),
      )}
    </div>
  );
}
