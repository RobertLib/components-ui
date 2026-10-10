import type { CalendarEvent, EventTimeChange } from "./types";
import type {
  DragType,
  EventDisplay,
  MoveGeometry,
  MoveSteps,
} from "./move-geometry";
import { daysBetween } from "./date-utils";
import { isDragPress, startPointerDrag } from "./pointer-drag";
import { isRtl } from "./utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatMessage } from "../../../i18n/ui/format";
import { shiftDay, toISODate } from "../../../utils/date";
import { useLocale } from "../../../providers/ui-context";

export type { DragType, EventDisplay } from "./move-geometry";

/** A moved event and the times a drop would give it. */
export interface DragState extends EventDisplay {
  /** The moved event. */
  event: CalendarEvent;
  /** Moved by the keys - not by the pointer. */
  keyboard: boolean;
  /** A move, or a resize by the start or the end edge. */
  type: DragType;
}

/** A tile the keys can pick up - see `handleKeyDown`. */
export interface MoveTile {
  /** Enter and Space open the event - they do not pick it up. */
  clickable: boolean;
  /** The day the tile is on - the focus follows it to the day it goes to. */
  day: Date;
  /** How the event moves or resizes - `null` when it cannot. */
  getGeometry: (type: DragType) => MoveGeometry | null;
  /** Shift + the arrows along it change the end of the event. */
  timeAxis?: "x" | "y";
}

interface UseEventMoveOptions {
  /** Tells screen readers - the live region of the calendar. */
  announce: (message: string) => void;
  /** When an event would take place - its day, times and resource. */
  describe: (event: CalendarEvent, display: EventDisplay) => string;
  /** The latest events - a removed or externally moved event cancels its move. */
  events: CalendarEvent[];
  /** The days, resources, hours and limits the move's geometry belongs to. */
  geometryKey: string;
  /** An event was moved. */
  onEventDrop?: (change: EventTimeChange) => void;
  canMoveEvent?: (event: CalendarEvent) => boolean;
  canResizeEvent?: (event: CalendarEvent) => boolean;
  canDropEvent?: (change: EventTimeChange) => boolean;
  /** An event was resized. */
  onEventResize?: (change: EventTimeChange) => void;
  /**
   * The scroll container of the view - scrolled along a drag at its edges;
   * the tiles are looked for in it to keep the focus.
   */
  scrollRef: React.RefObject<HTMLElement | null>;
}

/** The event and layout a move started with. */
interface MoveContext {
  event: CalendarEvent;
  geometryKey: string;
  type: DragType;
}

interface PointerSession extends MoveContext {
  /** Stops the listeners, clears the cursor and puts the event back. */
  stop: () => void;
}

/** A move by the keys. */
interface KeyboardSession extends MoveContext {
  /** Where the event is shown now. */
  display: EventDisplay;
  geometry: MoveGeometry;
  /** Where it was - a drop there changes nothing. */
  origin: EventDisplay;
  steps: MoveSteps;
  tile: MoveTile;
}

/** A tile to give the focus back to once it is rendered. */
interface FocusTarget {
  day: Date;
  id: string;
  /** Given up after this time - the app did not show the event again. */
  until: number;
}

/** Arrow keys and their steps - `x` towards the next column. */
const ARROWS: Record<string, MoveSteps> = {
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
};

const sameDisplay = (a: EventDisplay, b: EventDisplay) =>
  a.start.getTime() === b.start.getTime() &&
  a.end.getTime() === b.end.getTime() &&
  a.resourceId === b.resourceId;

/** The current event, while the times and layout the move started in still fit. */
function getCurrentEvent(options: UseEventMoveOptions, context: MoveContext) {
  if (
    options.geometryKey !== context.geometryKey ||
    !(context.type === "move" ? options.onEventDrop : options.onEventResize)
  ) {
    return undefined;
  }

  const current = options.events.find((event) => event.id === context.event.id);
  const permitted =
    context.type === "move" ? options.canMoveEvent : options.canResizeEvent;
  return current &&
    (!permitted || permitted(current)) &&
    sameDisplay(current, context.event) &&
    !!current.allDay === !!context.event.allDay
    ? current
    : undefined;
}

/** The cursor of a resize everywhere - also where the pointer leaves the tile. */
function addCursor(cursor: string) {
  const style = document.createElement("style");
  style.id = "calendar-resize-cursor";
  style.textContent = `* { cursor: ${cursor} !important; }`;
  document.head.appendChild(style);
  return style;
}

/** The day of the tile after the event moved from `from` to `to`. */
const followDay = (day: Date, from: Date, to: Date) =>
  shiftDay(day, daysBetween(from, to));

/**
 * Moving and resizing events - by the pointer, and by the keys: Ctrl / ⌘ + X
 * on a tile (or Enter / Space on one that opens nothing) picks the event up,
 * the arrow keys move it by a step - Shift + the arrows along the time
 * change its end - Enter, Space or Ctrl / ⌘ + V put it down, Escape or
 * leaving it puts it back. Screen readers are told each place. The view
 * renders the moved event at `getEventDisplayTimes` - the state changes only
 * when it gets to another place, not with every pixel.
 */
export default function useEventMove(options: UseEventMoveOptions) {
  const messages = useLocale().messages.ui;
  const [dragState, setDragState] = useState<DragState | null>(null);
  // A drag outlives the render it started in - it reads the latest options
  const optionsRef = useRef(options);
  const pointerRef = useRef<PointerSession | null>(null);
  const sessionRef = useRef<KeyboardSession | null>(null);
  const focusRef = useRef<FocusTarget | null>(null);

  /** Ends the move by the keys - the event goes back where it was. */
  const cancelKeyboard = (announce: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    setDragState(null);
    focusRef.current = {
      day: session.tile.day,
      id: session.event.id,
      until: Date.now() + 1000,
    };
    if (announce) {
      optionsRef.current.announce(
        formatMessage(messages.calendar.moveCancelled, {
          title: session.event.title,
        }),
      );
    }
  };

  // Before the focus follows a tile, or a release can report a stale move.
  // Refetching equal times keeps the move; changed geometry or event times
  // puts it back, including presses still below the drag threshold.
  useLayoutEffect(() => {
    optionsRef.current = options;
    const pointer = pointerRef.current;
    if (pointer && !getCurrentEvent(options, pointer)) pointer.stop();
    const session = sessionRef.current;
    if (session && !getCurrentEvent(options, session)) cancelKeyboard(true);
  });

  // Activity hides the view by removing its effects while keeping state.
  // A stopped drag must clear that state too, so showing the view again
  // restores the event and lets the other tiles take pointer clicks.
  useEffect(
    () => () => {
      pointerRef.current?.stop();
      sessionRef.current = null;
      focusRef.current = null;
      setDragState(null);
    },
    [],
  );

  // The tile of an event the keys move goes to another day or column - a
  // new element, and the focus would drop to the page. It follows the tile,
  // also once the app has put the dropped event where it went.
  useLayoutEffect(() => {
    const session = sessionRef.current;
    const target: FocusTarget | null = session
      ? {
          day: followDay(
            session.tile.day,
            session.origin.start,
            session.display.start,
          ),
          id: session.event.id,
          until: Infinity,
        }
      : focusRef.current;
    if (!target) return;
    if (Date.now() > target.until) {
      focusRef.current = null;
      return;
    }

    const scroller = optionsRef.current.scrollRef.current;
    const tiles = Array.from(
      scroller?.querySelectorAll<HTMLElement>("[data-event-id]") ?? [],
    ).filter((tile) => tile.dataset.eventId === target.id);
    const day = toISODate(target.day);
    const preferred =
      tiles.find((tile) => tile.dataset.eventDay === day) ?? tiles[0];
    if (!preferred) return;

    const active = preferred.ownerDocument.activeElement;
    if (active === preferred) {
      if (!session && preferred.dataset.eventDay === day) {
        focusRef.current = null;
      }
      return;
    }
    // The user went elsewhere meanwhile
    const lost =
      !active ||
      active === preferred.ownerDocument.body ||
      (active instanceof HTMLElement && active.dataset.eventId === target.id);
    if (!lost) {
      focusRef.current = null;
      return;
    }

    preferred.focus();
  });

  const describe = (event: CalendarEvent, display: EventDisplay) =>
    optionsRef.current.describe(event, display);

  const canPlace = (
    event: CalendarEvent,
    display: EventDisplay,
    hasResources: boolean,
  ) => {
    const check = optionsRef.current.canDropEvent;
    return (
      !check ||
      check({
        event,
        newStart: display.start,
        newEnd: display.end,
        ...(hasResources && { newResourceId: display.resourceId }),
      })
    );
  };

  /** Reports a change - a move or a resize. */
  const commit = (
    context: MoveContext,
    display: EventDisplay,
    hasResources: boolean,
  ) => {
    const event = getCurrentEvent(optionsRef.current, context);
    if (!event) return false;
    const change: EventTimeChange = {
      event,
      newEnd: display.end,
      newStart: display.start,
      ...(hasResources && { newResourceId: display.resourceId }),
    };
    if (
      optionsRef.current.canDropEvent &&
      !optionsRef.current.canDropEvent(change)
    )
      return false;
    const { onEventDrop, onEventResize } = optionsRef.current;
    if (context.type === "move") {
      onEventDrop?.(change);
    } else {
      onEventResize?.(change);
    }
    return true;
  };

  /** Puts the event the keys move down where it is shown. */
  const dropKeyboard = () => {
    const session = sessionRef.current;
    if (!session) return;
    const { display, event, geometry, origin, tile, type } = session;

    if (
      sameDisplay(display, origin) ||
      !getCurrentEvent(optionsRef.current, session) ||
      !canPlace(event, display, geometry.hasResources)
    ) {
      cancelKeyboard(true);
      return;
    }

    sessionRef.current = null;
    setDragState(null);
    // Once the app shows it there - its tile is a new element
    focusRef.current = {
      day: followDay(tile.day, origin.start, display.start),
      id: event.id,
      until: Date.now() + 2000,
    };
    if (!commit(session, display, geometry.hasResources)) return;
    optionsRef.current.announce(
      formatMessage(
        type === "move" ? messages.calendar.moved : messages.calendar.resized,
        { time: describe(event, display), title: event.title },
      ),
    );
  };

  /**
   * Starts a drag - on a press with the mouse, a pen or a finger - of an
   * event: a move, or a resize by one of its edges.
   */
  const handleDragStart = (
    e: React.PointerEvent,
    event: CalendarEvent,
    type: DragType,
    geometry: MoveGeometry,
  ) => {
    if (!isDragPress(e)) return;
    // A handle, not the tile under it
    e.stopPropagation();
    pointerRef.current?.stop();
    cancelKeyboard(false);

    const context: MoveContext = {
      event,
      geometryKey: optionsRef.current.geometryKey,
      type,
    };
    const origin = geometry.compute({ x: 0, y: 0 });
    // The times a drop gives - live, not those of the last render
    let current: EventDisplay | null = null;
    // The event was shown at other times along the way - its release is no
    // click, also back where it started
    let moved = false;
    let cursorStyle: HTMLStyleElement | null = null;

    const finish = () => {
      pointerRef.current = null;
      cursorStyle?.remove();
      setDragState(null);
    };

    const stopDrag = startPointerDrag(e, {
      axis: geometry.axis,
      grid: geometry.grid,
      scroller: optionsRef.current.scrollRef.current,
      scrollSideways: geometry.scrollSideways,
      onMove: (offset) => {
        const next = geometry.compute(geometry.toSteps(offset));
        if (!canPlace(event, next, geometry.hasResources)) {
          current = null;
          setDragState(null);
          return;
        }
        if (current && sameDisplay(next, current)) return;

        if (!cursorStyle && geometry.cursor) {
          cursorStyle = addCursor(geometry.cursor);
        }
        current = next;
        if (!sameDisplay(next, origin)) moved = true;
        setDragState({ ...next, event, keyboard: false, type });
      },
      onDrop: () => {
        finish();
        if (!current || sameDisplay(current, origin)) return moved;
        commit(context, current, geometry.hasResources);
        return true;
      },
      onCancel: finish,
    });

    pointerRef.current = {
      ...context,
      stop: () => {
        stopDrag();
        finish();
      },
    };
  };

  /**
   * The keys of the button of a tile: they pick the event up, move it, put
   * it down or back. Call it before the tile's own keys - it prevents the
   * default of those it takes.
   */
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    event: CalendarEvent,
    tile: MoveTile,
  ) => {
    if (e.target !== e.currentTarget || e.nativeEvent.isComposing) return;

    const session = sessionRef.current;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (!session || session.event.id !== event.id) {
      const picks =
        (mod && !e.altKey && !e.shiftKey && key === "x") ||
        (!tile.clickable &&
          !mod &&
          !e.altKey &&
          (key === "Enter" || key === " "));
      if (!picks) return;

      const type: DragType = tile.getGeometry("move") ? "move" : "resize-end";
      const geometry = tile.getGeometry(type);
      if (!geometry) return;
      e.preventDefault();

      pointerRef.current?.stop();
      cancelKeyboard(false);
      const origin = geometry.compute({ x: 0, y: 0 });
      sessionRef.current = {
        display: origin,
        event,
        geometryKey: optionsRef.current.geometryKey,
        geometry,
        origin,
        steps: { x: 0, y: 0 },
        tile,
        type,
      };
      setDragState({ ...origin, event, keyboard: true, type });
      optionsRef.current.announce(
        formatMessage(messages.calendar.moveStart, { title: event.title }),
      );
      return;
    }

    if (key === "Escape") {
      // It puts the event back and nothing else - not a Dialog around
      e.preventDefault();
      e.stopPropagation();
      cancelKeyboard(true);
      return;
    }
    if (key === "Tab") {
      cancelKeyboard(true);
      return;
    }
    if (key === "Enter" || key === " " || (mod && key === "v")) {
      e.preventDefault();
      dropKeyboard();
      return;
    }

    const arrow = ARROWS[e.key];
    if (!arrow || e.altKey || mod) return;
    e.preventDefault();
    e.stopPropagation();

    // The next column is on the left in a right-to-left page
    const step = { x: isRtl(e.currentTarget) ? -arrow.x : arrow.x, y: arrow.y };
    const axis = step.x !== 0 ? "x" : "y";
    const alongTime = session.tile.timeAxis === axis;

    // Shift + the arrows along the time change the end - so do the plain
    // arrows of an event that can only be resized
    let type: DragType | null = e.shiftKey
      ? alongTime
        ? "resize-end"
        : null
      : "move";
    if (type === "move" && alongTime && !session.tile.getGeometry("move")) {
      type = "resize-end";
    }
    if (!type) return;

    let { geometry, steps } = session;
    if (type !== session.type) {
      // One kind of change at a time - put it back first
      if (steps.x !== 0 || steps.y !== 0) return;
      const other = session.tile.getGeometry(type);
      if (!other) return;
      geometry = other;
    }
    if (geometry.axis !== "both" && geometry.axis !== axis) return;

    const nextSteps = { x: steps.x + step.x, y: steps.y + step.y };
    const display = geometry.compute(nextSteps);
    // At an edge or a refused destination - nothing changes
    if (!canPlace(event, display, geometry.hasResources)) return;
    if (sameDisplay(display, session.display)) return;

    steps = nextSteps;
    sessionRef.current = { ...session, display, geometry, steps, type };
    setDragState({ ...display, event, keyboard: true, type });
    optionsRef.current.announce(describe(event, display));
  };

  /**
   * The focus left a tile - a move by the keys ends unless it went to the
   * moved tile again (a new element in another column).
   */
  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session) return;

    const related = e.relatedTarget;
    if (related instanceof HTMLElement) {
      if (related.dataset.eventId !== session.event.id) cancelKeyboard(true);
      return;
    }

    // The tile went away with the focus - it is focused again in the same
    // commit; a click on the page leaves the focus on its body
    setTimeout(() => {
      const current = sessionRef.current;
      if (current !== session && current?.event.id !== session.event.id) {
        return;
      }
      const active = document.activeElement;
      if (
        !(active instanceof HTMLElement) ||
        active.dataset.eventId !== session.event.id
      ) {
        cancelKeyboard(true);
      }
    });
  };

  return {
    dragState,
    /**
     * The times and the resource an event is shown at - a moved one where
     * it would go.
     */
    getEventDisplayTimes: (event: CalendarEvent): EventDisplay =>
      dragState?.event.id === event.id
        ? {
            end: dragState.end,
            resourceId: dragState.resourceId,
            start: dragState.start,
          }
        : { end: event.end, resourceId: event.resourceId, start: event.start },
    handleBlur,
    handleDragStart,
    handleKeyDown,
    /** An event is being moved - by the pointer or the keys. */
    isAnyDragging: dragState !== null,
    /** Whether the event is being moved or resized. */
    isDragging: (eventId: string) => dragState?.event.id === eventId,
    /** An event is being dragged by the pointer - the others let it through. */
    isPointerDragging: dragState !== null && !dragState.keyboard,
  };
}
