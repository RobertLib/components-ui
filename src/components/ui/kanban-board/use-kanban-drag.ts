import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatMessage } from "../../../i18n/ui/format";
import { useMessages } from "../../../providers/ui-context";
import {
  cardsIn,
  idKey,
  placeOf,
  samePlace,
  type KanbanCard,
  type KanbanColumn,
  type KanbanId,
  type KanbanPlace,
} from "./model";

/** Pixels a mouse or a pen may move before a press becomes a drag. */
const DRAG_THRESHOLD = 5;

/** How long a finger rests on a card before it is picked up (ms). */
const LONG_PRESS = 500;

/** How near an edge of a scrolling area a drag scrolls it, in pixels. */
const AUTO_SCROLL_EDGE = 48;

/** Pixels per frame it scrolls with the pointer right at the edge. */
const AUTO_SCROLL_SPEED = 16;

// Clicks, presses and keys on these inside a card are theirs - the controls
// `renderCard` puts into it
const CONTROLS =
  "a[href], button, input, select, textarea, label, [contenteditable]:not([contenteditable='false']), [role='button'], [role='checkbox'], [role='link'], [role='menuitem'], [role='switch']";

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const isRtl = (element: Element | null) =>
  !!element && getComputedStyle(element).direction === "rtl";

/**
 * The element of the card or the column whose key (`idKey`) is `key` - by
 * comparing the data attributes, as an id may hold any character.
 */
export const findElement = (
  root: ParentNode | null | undefined,
  attribute: "kanbanCard" | "kanbanColumn",
  key: string,
) =>
  Array.from(
    root?.querySelectorAll<HTMLElement>(
      attribute === "kanbanCard"
        ? "[data-kanban-card]"
        : "[data-kanban-column]",
    ) ?? [],
  ).find((element) => element.dataset[attribute] === key) ?? null;

/** Whether an event comes from a control inside the card, not the card. */
export const isFromControl = (event: React.SyntheticEvent<HTMLElement>) => {
  const control =
    event.target instanceof Element ? event.target.closest(CONTROLS) : null;
  return (
    !!control &&
    control !== event.currentTarget &&
    event.currentTarget.contains(control)
  );
};

/**
 * Swallows the click that follows the release of a drag - it comes right
 * after it, if at all, so the next click in another task is one again.
 */
function swallowNextClick() {
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    stop();
  };
  const stop = () => {
    window.removeEventListener("click", swallow, true);
    window.removeEventListener("pointerdown", stop, true);
  };

  window.addEventListener("click", swallow, true);
  // Or a new press comes first
  window.addEventListener("pointerdown", stop, true);
  setTimeout(stop);
}

/** The element that scrolls `element` up and down - `null` for the page. */
function findScroller(element: Element | null) {
  for (let node = element; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
  }
  return null;
}

/** How fast to scroll: towards -1 / 1 the nearer `position` is to an edge. */
function edgeSpeed(position: number, start: number, end: number) {
  if (position < start + AUTO_SCROLL_EDGE) {
    return -Math.min(
      1,
      (start + AUTO_SCROLL_EDGE - position) / AUTO_SCROLL_EDGE,
    );
  }
  if (position > end - AUTO_SCROLL_EDGE) {
    return Math.min(1, (position - end + AUTO_SCROLL_EDGE) / AUTO_SCROLL_EDGE);
  }
  return 0;
}

const scrollDelta = (speed: number) =>
  Math.sign(speed) *
  Math.max(1, Math.round(Math.abs(speed) * AUTO_SCROLL_SPEED));

/** A card being moved - by the pointer, or with the keys. */
export interface DragSession {
  cardId: KanbanId;
  /** Height of the card - of the place it would land at. */
  height: number;
  mode: "keyboard" | "pointer";
  /** Where the card is. */
  origin: KanbanPlace;
  /** The column under the pointer - also one that takes no card. */
  overColumnId: KanbanId | null;
  /** The board is right to left - for the copy of the card in a portal. */
  rtl: boolean;
  /** Where it would land - `null` where it cannot. */
  target: KanbanPlace | null;
  /** Width of the card - of its copy beside the pointer. */
  width: number;
}

/** A press of the pointer on a card - until it is released. */
interface Press {
  /** Escape cancelled the drag - the release is still to come. */
  cancelled: boolean;
  cardId: KanbanId;
  dragging: boolean;
  /** The frame of the auto-scroll. */
  frame: number;
  height: number;
  longPress: ReturnType<typeof setTimeout> | undefined;
  /** Where in the card it was pressed. */
  offset: { x: number; y: number };
  over: KanbanId | null;
  pointer: { x: number; y: number };
  pointerId: number;
  start: { x: number; y: number };
  width: number;
  /** Removes the listeners of the press. */
  stop: () => void;
  /** What the pointer was last over - without `elementFromPoint`. */
  target: EventTarget | null;
  place: KanbanPlace | null;
  touch: boolean;
}

export interface KanbanDragOptions<T extends KanbanCard> {
  boardRef: React.RefObject<HTMLElement | null>;
  canMove: (card: T) => boolean;
  cards: readonly T[];
  columns: readonly KanbanColumn[];
  /** Moving is on. */
  enabled: boolean;
  getLabel: (card: T) => string;
  isAllowed: (card: T, origin: KanbanPlace, target: KanbanPlace) => boolean;
  isCollapsed: (columnId: KanbanId) => boolean;
  /** Commits a move - the drop of a card at another place. */
  onDrop: (card: T, origin: KanbanPlace, target: KanbanPlace) => void;
  /** The element that scrolls the columns sideways. */
  scrollerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Moving the cards of a board: a drag of the pointer - a press moved a few
 * pixels, or a finger resting on a card - and the keys (Space or Enter
 * picks a card up, the arrows choose the place, Space or Enter drops it,
 * Escape cancels). Both end in `onDrop` and are announced.
 */
export default function useKanbanDrag<T extends KanbanCard>(
  options: KanbanDragOptions<T>,
) {
  const messages = useMessages().ui;
  const [session, setSession] = useState<DragSession | null>(null);
  // What the live region says - the count tells a repeated text apart
  const [announcement, setAnnouncement] = useState({ count: 0, text: "" });
  const pressRef = useRef<Press | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  // The card to focus once it renders at its new place - in its column
  const refocusRef = useRef<{ cardId: KanbanId; columnId: KanbanId } | null>(
    null,
  );

  const endPress = (press: Press) => {
    press.stop();
    clearTimeout(press.longPress);
    cancelAnimationFrame(press.frame);
    if (pressRef.current === press) pressRef.current = null;
  };

  // Moving turned off, or the card is gone - the move ends
  if (
    session &&
    (!options.enabled ||
      !options.cards.some((card) => card.id === session.cardId))
  ) {
    setSession(null);
  }
  const active = options.enabled ? session : null;

  // For the handlers of the document, which run between renders
  const latest = { ...options, messages, session };
  const latestRef = useRef(latest);

  useLayoutEffect(() => {
    latestRef.current = latest;
    const press = pressRef.current;
    if (
      press &&
      (!options.enabled ||
        !options.cards.some((card) => card.id === press.cardId))
    ) {
      endPress(press);
    }
  });

  const announce = (text: string) =>
    setAnnouncement((previous) => ({ count: previous.count + 1, text }));

  const findCard = (id: KanbanId) =>
    latestRef.current.cards.find((card) => card.id === id);

  /** The other cards of a column - the positions a card can take there. */
  const othersCount = (columnId: KanbanId, cardId: KanbanId) =>
    cardsIn(latestRef.current.cards, columnId).filter(
      (card) => card.id !== cardId,
    ).length;

  const titleOf = (columnId: KanbanId) =>
    latestRef.current.columns.find((column) => column.id === columnId)?.title ??
    String(columnId);

  /** "Column Done, position 2 of 5" - with `template` and the card's label. */
  const describe = (template: string, card: T, place: KanbanPlace) =>
    formatMessage(template, {
      card: latestRef.current.getLabel(card),
      column: titleOf(place.columnId),
      count: othersCount(place.columnId, card.id) + 1,
      position: place.index + 1,
    });

  const finish = (card: T, origin: KanbanPlace, target: KanbanPlace | null) => {
    const { messages, onDrop } = latestRef.current;
    refocusRef.current = {
      cardId: card.id,
      columnId: (target ?? origin).columnId,
    };
    if (!target || samePlace(target, origin)) {
      announce(
        formatMessage(messages.kanbanBoard.unchanged, {
          card: latestRef.current.getLabel(card),
        }),
      );
      return;
    }
    const message = describe(messages.kanbanBoard.moved, card, target);
    onDrop(card, origin, target);
    announce(message);
  };

  const cancel = () => {
    const { messages, session } = latestRef.current;
    if (!session) return;
    setSession(null);
    const card = findCard(session.cardId);
    if (card) {
      announce(
        formatMessage(messages.kanbanBoard.moveCancelled, {
          card: latestRef.current.getLabel(card),
        }),
      );
    }
  };

  // The keys

  /** Picks up a card with the keys - `element` is the card. */
  const pickUp = (card: T, element: HTMLElement) => {
    const { cards, messages } = latestRef.current;
    const origin = placeOf(cards, card.id);
    if (!origin) return;
    setSession({
      cardId: card.id,
      height: element.offsetHeight,
      mode: "keyboard",
      origin,
      overColumnId: origin.columnId,
      rtl: isRtl(element),
      target: origin,
      width: element.offsetWidth,
    });
    announce(describe(messages.kanbanBoard.pickedUp, card, origin));
  };

  /**
   * The allowed place nearest to `index` in a column - the end of a
   * collapsed one only.
   */
  const nearestIn = (
    card: T,
    origin: KanbanPlace,
    columnId: KanbanId,
    index: number,
  ): KanbanPlace | null => {
    const { isAllowed, isCollapsed } = latestRef.current;
    const max = othersCount(columnId, card.id);
    if (isCollapsed(columnId)) {
      const place = { columnId, index: max };
      return isAllowed(card, origin, place) ? place : null;
    }
    const start = Math.min(Math.max(index, 0), max);
    for (let distance = 0; distance <= max; distance++) {
      for (const candidate of [start - distance, start + distance]) {
        if (candidate < 0 || candidate > max) continue;
        const place = { columnId, index: candidate };
        if (isAllowed(card, origin, place)) return place;
      }
    }
    return null;
  };

  /** Moves the picked up card on - within its column or to the next one. */
  const choose = (
    direction: "down" | "end" | "home" | "next" | "previous" | "up",
  ) => {
    const { columns, isAllowed, messages, session } = latestRef.current;
    const card = session && findCard(session.cardId);
    if (!session || !card) return;
    const current = session.target ?? session.origin;
    let next: KanbanPlace | null = null;

    if (direction === "next" || direction === "previous") {
      const step = direction === "next" ? 1 : -1;
      const from = columns.findIndex(
        (column) => column.id === current.columnId,
      );
      for (
        let index = from + step;
        index >= 0 && index < columns.length && !next;
        index += step
      ) {
        next = nearestIn(
          card,
          session.origin,
          columns[index].id,
          current.index,
        );
      }
    } else {
      const max = othersCount(current.columnId, card.id);
      const order =
        direction === "home"
          ? Array.from({ length: max + 1 }, (_, index) => index)
          : direction === "end"
            ? Array.from({ length: max + 1 }, (_, index) => max - index)
            : direction === "up"
              ? Array.from(
                  { length: current.index },
                  (_, index) => current.index - 1 - index,
                )
              : Array.from(
                  { length: Math.max(max - current.index, 0) },
                  (_, index) => current.index + 1 + index,
                );
      for (const index of order) {
        const place = { columnId: current.columnId, index };
        if (isAllowed(card, session.origin, place)) {
          next = place;
          break;
        }
      }
    }

    if (!next) {
      // Nowhere further - says where it stays
      announce(describe(messages.kanbanBoard.position, card, current));
      return;
    }
    setSession({ ...session, overColumnId: next.columnId, target: next });
    announce(describe(messages.kanbanBoard.position, card, next));
  };

  const dropHere = () => {
    const { session } = latestRef.current;
    const card = session && findCard(session.cardId);
    if (!session || !card) return;
    setSession(null);
    finish(card, session.origin, session.target);
  };

  /**
   * The keys of a picked up card, and Space (Enter for a card without an
   * action) picking one up. Returns whether the key was handled.
   */
  const onKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    card: T,
    enterPicksUp: boolean,
  ) => {
    const { canMove, enabled, session } = latestRef.current;
    if (!enabled || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }

    if (session?.mode !== "keyboard" || session.cardId !== card.id) {
      // A card that cannot move is pressed with Space, like any button
      if (!canMove(card)) return false;
      if (event.key === " " || (event.key === "Enter" && enterPicksUp)) {
        event.preventDefault();
        pickUp(card, event.currentTarget);
        return true;
      }
      return false;
    }

    // Tab leaves the card - which cancels the move
    if (event.key === "Tab") return false;
    event.preventDefault();

    // The columns run right to left in a right-to-left page
    const rtl = isRtl(event.currentTarget);
    switch (event.key) {
      case "ArrowUp":
        choose("up");
        break;
      case "ArrowDown":
        choose("down");
        break;
      case "ArrowLeft":
        choose(rtl ? "next" : "previous");
        break;
      case "ArrowRight":
        choose(rtl ? "previous" : "next");
        break;
      case "Home":
        choose("home");
        break;
      case "End":
        choose("end");
        break;
      case " ":
      case "Enter":
        dropHere();
        break;
      case "Escape":
        // The Escape of the move - not of a dialog around
        event.stopPropagation();
        cancel();
        break;
      default:
        break;
    }
    return true;
  };

  /** The focus left the board - a move chosen with the keys is cancelled. */
  const onBlur = (event: React.FocusEvent<HTMLElement>) => {
    const { boardRef, session } = latestRef.current;
    if (session?.mode !== "keyboard") return;

    const next = event.relatedTarget;
    const card = findElement(
      boardRef.current,
      "kanbanCard",
      idKey(session.cardId),
    );
    if (next instanceof Node && card?.contains(next)) return;
    if (next) {
      cancel();
      return;
    }

    // Nothing took the focus: the window lost it (the move goes on when it
    // is back), or the card went away
    setTimeout(() => {
      const { boardRef, session } = latestRef.current;
      if (
        session?.mode === "keyboard" &&
        document.hasFocus() &&
        !boardRef.current?.contains(document.activeElement)
      ) {
        cancel();
      }
    });
  };

  // The pointer

  const moveGhost = (press: Press) => {
    const ghost = ghostRef.current;
    if (ghost) {
      ghost.style.translate = `${press.pointer.x - press.offset.x}px ${press.pointer.y - press.offset.y}px`;
    }
  };

  /** The place under the pointer. */
  const updatePointerPlace = (press: Press) => {
    const { boardRef, columns, isAllowed, isCollapsed } = latestRef.current;
    const board = boardRef.current;
    const card = findCard(press.cardId);
    const origin = placeOf(latestRef.current.cards, press.cardId);
    if (!card || !origin) return;
    const { x, y } = press.pointer;

    const hit =
      typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(x, y)
        : press.target instanceof Element
          ? press.target
          : null;
    const columnElement = hit?.closest<HTMLElement>("[data-kanban-column]");
    const column =
      columnElement && board?.contains(columnElement)
        ? columns.find(
            (candidate) =>
              idKey(candidate.id) === columnElement.dataset.kanbanColumn,
          )
        : undefined;

    let place: KanbanPlace | null = null;
    if (column && columnElement) {
      if (isCollapsed(column.id)) {
        place = { columnId: column.id, index: othersCount(column.id, card.id) };
      } else {
        // Before the first card whose middle is below the pointer
        const others = Array.from(
          columnElement.querySelectorAll<HTMLElement>("[data-kanban-card]"),
        ).filter((element) => element.dataset.kanbanCard !== idKey(card.id));
        const index = others.filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.top + rect.height / 2 < y;
        }).length;
        place = { columnId: column.id, index };
      }
    }

    const target = place && isAllowed(card, origin, place) ? place : null;
    const over = column?.id ?? null;
    if (samePlace(target, press.place) && over === press.over) return;
    press.place = target;
    press.over = over;
    setSession((current) =>
      current?.mode === "pointer"
        ? { ...current, overColumnId: over, target }
        : current,
    );
  };

  /**
   * What scrolls near the pointer, and how fast: the board sideways - by
   * the physical edges, in any writing direction - and the column under
   * the pointer (or the page) up and down.
   */
  const edgeScrolling = (press: Press) => {
    const { x, y } = press.pointer;
    const board = latestRef.current.scrollerRef.current;
    const boardRect = board?.getBoundingClientRect();
    const hit =
      typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(x, y)
        : null;
    const column = findScroller(hit?.closest("[data-kanban-scroll]") ?? null);
    const columnRect = column?.getBoundingClientRect();

    return {
      board,
      boardSpeed: boardRect ? edgeSpeed(x, boardRect.left, boardRect.right) : 0,
      vertical: column ?? document.scrollingElement,
      verticalSpeed: edgeSpeed(
        y,
        columnRect ? columnRect.top : 0,
        columnRect ? columnRect.bottom : window.innerHeight,
      ),
    };
  };

  /** Scrolls what is near the pointer by a step - whether anything moved. */
  const scrollStep = (press: Press) => {
    const { board, boardSpeed, vertical, verticalSpeed } = edgeScrolling(press);
    let moved = false;

    if (board && boardSpeed !== 0) {
      const before = board.scrollLeft;
      board.scrollLeft += scrollDelta(boardSpeed);
      if (board.scrollLeft !== before) moved = true;
    }
    if (vertical && verticalSpeed !== 0) {
      const before = vertical.scrollTop;
      vertical.scrollTop += scrollDelta(verticalSpeed);
      if (vertical.scrollTop !== before) moved = true;
    }
    return moved;
  };

  /** Scrolls while the pointer is near an edge - frame by frame. */
  const autoScroll = (press: Press) => {
    if (press.frame) return;
    const { boardSpeed, verticalSpeed } = edgeScrolling(press);
    if (boardSpeed === 0 && verticalSpeed === 0) return;

    const step = () => {
      press.frame = 0;
      if (pressRef.current !== press || !press.dragging || press.cancelled) {
        return;
      }
      // At the end of what it can scroll - the next move of the pointer
      // starts it again
      if (!scrollStep(press)) return;
      updatePointerPlace(press);
      press.frame = requestAnimationFrame(step);
    };

    press.frame = requestAnimationFrame(step);
  };

  const startDragging = (press: Press) => {
    const origin = placeOf(latestRef.current.cards, press.cardId);
    if (!origin) {
      endPress(press);
      return;
    }
    press.dragging = true;
    // A selection begun by the press would grow as the pointer moves
    window.getSelection?.()?.removeAllRanges();
    setSession({
      cardId: press.cardId,
      height: press.height,
      mode: "pointer",
      origin,
      overColumnId: origin.columnId,
      rtl: isRtl(latestRef.current.boardRef.current),
      target: origin,
      width: press.width,
    });
    press.place = origin;
    press.over = origin.columnId;
    updatePointerPlace(press);
    autoScroll(press);
  };

  /** A press on a card - it may become a drag. */
  const onPointerDown = (event: React.PointerEvent<HTMLElement>, card: T) => {
    const { canMove, enabled, session } = latestRef.current;
    if (
      !enabled ||
      event.button !== 0 ||
      !event.isPrimary ||
      // The Ctrl + click that opens the context menu on a Mac
      (event.ctrlKey && isMac()) ||
      isFromControl(event) ||
      !canMove(card)
    ) {
      return;
    }

    if (pressRef.current) endPress(pressRef.current);
    if (session?.mode === "keyboard") cancel();

    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX, y: event.clientY };
    const press: Press = {
      cancelled: false,
      cardId: card.id,
      dragging: false,
      frame: 0,
      height: rect.height,
      longPress: undefined,
      offset: { x: point.x - rect.left, y: point.y - rect.top },
      over: null,
      place: null,
      pointer: point,
      pointerId: event.pointerId,
      start: point,
      stop: () => {},
      target: event.target,
      touch: event.pointerType === "touch",
      width: rect.width,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== press.pointerId) return;
      press.pointer = { x: moveEvent.clientX, y: moveEvent.clientY };
      press.target = moveEvent.target;
      if (press.cancelled) return;

      if (!press.dragging) {
        const distance = Math.hypot(
          press.pointer.x - press.start.x,
          press.pointer.y - press.start.y,
        );
        if (distance <= DRAG_THRESHOLD) return;
        // A finger that moves first scrolls the page
        if (press.touch) endPress(press);
        else startDragging(press);
        return;
      }

      moveGhost(press);
      updatePointerPlace(press);
      autoScroll(press);
    };

    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== press.pointerId) return;
      if (press.dragging) {
        swallowNextClick();
        if (!press.cancelled) {
          const card = findCard(press.cardId);
          const origin = placeOf(latestRef.current.cards, press.cardId);
          setSession(null);
          if (card && origin) finish(card, origin, press.place);
        }
      }
      endPress(press);
    };

    // The browser took the pointer over - to scroll, to zoom
    const handleCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== press.pointerId) return;
      if (press.dragging && !press.cancelled) setSession(null);
      endPress(press);
    };

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      if (!press.dragging) {
        endPress(press);
        return;
      }
      if (press.cancelled) return;

      // The Escape of the drag - not of a dialog or popover around
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      press.cancelled = true;
      cancel();
    };

    // Picked up, the finger moves the card - not the page
    const handleTouchMove = (touchEvent: TouchEvent) => {
      if (press.dragging) touchEvent.preventDefault();
    };
    // Nor does resting on the card open the menu of the browser
    const handleContextMenu = (menuEvent: Event) => {
      if (press.touch) menuEvent.preventDefault();
    };
    const handleSelectStart = (selectEvent: Event) => {
      if (press.dragging) selectEvent.preventDefault();
    };
    const handleWindowBlur = () => {
      if (press.dragging && !press.cancelled) setSession(null);
      endPress(press);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleCancel);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("selectstart", handleSelectStart);
    window.addEventListener("blur", handleWindowBlur);

    press.stop = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleCancel);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("selectstart", handleSelectStart);
      window.removeEventListener("blur", handleWindowBlur);
    };

    if (press.touch) {
      press.longPress = setTimeout(() => {
        if (pressRef.current === press) startDragging(press);
      }, LONG_PRESS);
    }

    pressRef.current = press;
  };

  // A press going on when the board unmounts
  useEffect(
    () => () => {
      const press = pressRef.current;
      if (!press) return;
      press.stop();
      clearTimeout(press.longPress);
      cancelAnimationFrame(press.frame);
      pressRef.current = null;
    },
    [],
  );

  // The card goes on having the focus at its new place - a drop into
  // another column renders it anew there
  useLayoutEffect(() => {
    const refocus = refocusRef.current;
    if (refocus === null) return;
    refocusRef.current = null;
    const board = options.boardRef.current;
    // A collapsed column shows no cards - its button to expand it then
    const target =
      findElement(board, "kanbanCard", idKey(refocus.cardId)) ??
      findElement(
        board,
        "kanbanColumn",
        idKey(refocus.columnId),
      )?.querySelector<HTMLElement>("button");
    if (target && target !== document.activeElement) target.focus();
  });

  // The place chosen with the keys is scrolled into view
  const keyboardTarget =
    active?.mode === "keyboard" && active.target ? active.target : null;
  const targetKey = keyboardTarget
    ? `${idKey(keyboardTarget.columnId)}:${keyboardTarget.index}`
    : null;
  useEffect(() => {
    if (targetKey === null) return;
    const board = latestRef.current.boardRef.current;
    const { session } = latestRef.current;
    // The placeholder - or the card back at its place, or a collapsed column
    const element =
      board?.querySelector("[data-kanban-placeholder]") ??
      board?.querySelector("[data-moving]") ??
      (session?.target
        ? findElement(board, "kanbanColumn", idKey(session.target.columnId))
        : null);
    element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [targetKey]);

  /** The copy of the card beside the pointer - placed where the pointer is. */
  const attachGhost = useCallback((element: HTMLElement | null) => {
    ghostRef.current = element;
    const press = pressRef.current;
    if (element && press) {
      element.style.translate = `${press.pointer.x - press.offset.x}px ${press.pointer.y - press.offset.y}px`;
    }
  }, []);

  return {
    /** What the live region says - a repeated text differs by a space. */
    announcement: announcement.text + (announcement.count % 2 === 1 ? " " : ""),
    attachGhost,
    onBlur,
    onKeyDown,
    onPointerDown,
    session: active,
  };
}
