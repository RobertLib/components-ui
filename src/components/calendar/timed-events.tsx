import type { CalendarEvent } from "./types";
import type { DragType } from "./use-event-drag";
import {
  MIN_TILE_HEIGHT,
  getColorStyles,
  getEventTooltipText,
  getVisibleMinutes,
  layoutEvents,
  spansMidnight,
} from "./utils";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";

export interface TimedEventsProps {
  /** Events can be moved (`onEventDrop`). */
  canMove: boolean;
  /** Events can be resized (`onEventResize`). */
  canResize: boolean;
  /** The day of the column. */
  day: Date;
  /** The day is disabled - its events can be neither moved nor resized. */
  disabled?: boolean;
  /** Hour the grid ends with. */
  endHour: number;
  /** The timed events shown on the day, in their order. */
  events: CalendarEvent[];
  /** The color of an event - its own or that of its resource. */
  getColor: (event: CalendarEvent) => string | undefined;
  /** The times an event is shown at - a dragged one where it is dragged to. */
  getDisplayTimes: (event: CalendarEvent) => { end: Date; start: Date };
  /** The accessible name of a tile (`createEventLabeler`). */
  getLabel: (event: CalendarEvent) => string;
  /** An event is being dragged - the others let the pointer through. */
  isAnyDragging: boolean;
  /** Whether a tile opens its event. */
  isClickable: (event: CalendarEvent) => boolean;
  /** Whether the event is being dragged. */
  isDragging: (eventId: string) => boolean;
  /** A press on a tile or its resize handle. */
  onDragStart: (
    e: React.PointerEvent,
    event: CalendarEvent,
    type: DragType,
  ) => void;
  /** A tile was clicked. */
  onEventClick: (event: CalendarEvent) => void;
  /** Per-event controls in the top-right corner of a tile. */
  renderEventActions?: (event: CalendarEvent) => React.ReactNode;
  /** Icon rendered before the title of a tile. */
  renderEventIcon?: (event: CalendarEvent) => React.ReactNode;
  /** Length of a slot in minutes. */
  slotDurationMinutes: number;
  /** Height of a slot in pixels. */
  slotHeight: number;
  /** First hour of the grid. */
  startHour: number;
  /** Classes of the tiles, e.g. their padding. */
  tileClassName?: string;
}

/** The tiles of the timed events of a day column in the week or day view. */
export default function TimedEvents({
  canMove,
  canResize,
  day,
  disabled = false,
  endHour,
  events,
  getColor,
  getDisplayTimes,
  getLabel,
  isAnyDragging,
  isClickable,
  isDragging,
  onDragStart,
  onEventClick,
  renderEventActions,
  renderEventIcon,
  slotDurationMinutes,
  slotHeight,
  startHour,
  tileClassName,
}: TimedEventsProps) {
  const toPixels = (minutes: number) =>
    (minutes / slotDurationMinutes) * slotHeight;

  // Only the events within or overlapping the hour range, cut to it
  const tiles = events.flatMap((event) => {
    const { end, start } = getDisplayTimes(event);
    const minutes = getVisibleMinutes(start, end, day, startHour, endHour);
    return minutes ? [{ event, minutes }] : [];
  });

  // Side by side where they overlap as drawn - by the clock, with the
  // minimum height of a tile, a dragged event where it is dragged to
  const minMinutes = (MIN_TILE_HEIGHT / slotHeight) * slotDurationMinutes;
  const layout = layoutEvents(
    tiles.map(({ event, minutes }) => ({
      from: minutes.from,
      id: event.id,
      to: Math.max(minutes.to, minutes.from + minMinutes),
    })),
  );

  return tiles.map(({ event, minutes }) => {
    const top = toPixels(minutes.from - startHour * 60);
    const height = Math.max(
      toPixels(minutes.to - minutes.from),
      MIN_TILE_HEIGHT,
    );
    const { column, columns, span } = layout.get(event.id) ?? {
      column: 0,
      columns: 1,
      span: 1,
    };

    const dragging = isDragging(event.id);
    const clickable = isClickable(event);
    // One day's grid cannot move or resize an event over several, and the
    // events of a disabled day stay as they are
    const draggable = !disabled && !spansMidnight(event);
    const movable = canMove && draggable;
    // Short tiles get thin handles - with room to grab the tile between
    const handleClassName = cn(
      "absolute right-0 left-0 z-10 cursor-ns-resize touch-none hover:bg-black/10",
      height < 40 ? "h-1" : "h-2",
    );

    return (
      <EventTile
        actions={renderEventActions?.(event)}
        className={cn(
          "absolute overflow-hidden rounded-md border-l-2 py-1 text-xs leading-tight select-none",
          tileClassName,
          ...getColorStyles(getColor(event)),
          dragging && "opacity-80 shadow-lg ring-2 ring-primary-500",
          movable
            ? // A finger on it drags, it does not scroll the view
              "cursor-move touch-none"
            : clickable
              ? "cursor-pointer"
              : "cursor-default",
          isAnyDragging && !dragging && "pointer-events-none",
        )}
        clickable={clickable}
        // The icon and the title on one line - a short tile has room for one
        contentClassName="flex min-w-0 items-center"
        handles={
          canResize &&
          draggable && (
            <>
              <div
                className={cn(handleClassName, "top-0")}
                onPointerDown={(e) => onDragStart(e, event, "resize-top")}
              />
              <div
                className={cn(handleClassName, "bottom-0")}
                onPointerDown={(e) => onDragStart(e, event, "resize-bottom")}
              />
            </>
          )
        }
        key={event.id}
        label={getLabel(event)}
        onOpen={() => onEventClick(event)}
        onPointerDown={
          movable ? (e) => onDragStart(e, event, "move") : undefined
        }
        style={{
          height: `${height}px`,
          left: `calc(${(column / columns) * 100}% + 2px)`,
          top: `${top}px`,
          width: `calc(${(span / columns) * 100}% - 4px)`,
          // Its own layer - the handles and actions of a tile stay on it
          zIndex: dragging ? 2 : 1,
        }}
        title={getEventTooltipText(event)}
      >
        {/* Optional custom icon renderer */}
        {renderEventIcon?.(event)}
        {/* Cut off after the icon - a rich title wraps in a tall tile */}
        <EventTitle
          className="min-w-0 truncate font-medium"
          event={event}
          htmlClassName="min-w-0"
        >
          {event.title}
        </EventTitle>
      </EventTile>
    );
  });
}
