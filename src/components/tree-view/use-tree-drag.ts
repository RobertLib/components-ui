import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatMessage, formatPlural } from "../../i18n/format";
import type { PluralMessage } from "../../i18n/types";
import { useLocale, useMessages } from "../../providers/ui-context";
import { isFromControl, isRtl, levelAt } from "./dom";
import {
  getDraggedIds,
  getDropPlaces,
  getPlaceRow,
  getPointerPlace,
  isNoopMove,
  isValidDrop,
  samePlace,
  stepFromCursor,
  type DropPlace,
  type PlaceCursor,
  type TreeDropPosition,
  type TreeMove,
} from "./drag-model";
import {
  getAncestors,
  isLazy,
  type LoadStates,
  type TreeIndex,
  type TreeRow,
} from "./tree-model";
import type { TreeItem, TreeItemId } from "./types";

/** Pixels a mouse or a pen may move before a press becomes a drag. */
const DRAG_THRESHOLD = 5;

/** How long a finger rests on an item before it is picked up (ms). */
const LONG_PRESS = 500;

/** How long a collapsed item is hovered before it expands (ms). */
const AUTO_EXPAND_DELAY = 700;

/** How near an edge of the scroll container a drag scrolls it, in pixels. */
const AUTO_SCROLL_EDGE = 40;

/** Pixels per frame it scrolls with the pointer right at the edge. */
const AUTO_SCROLL_SPEED = 16;

const EMPTY_IDS: ReadonlySet<TreeItemId> = new Set();

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

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

/** The element that scrolls the tree - `null` for the page. */
function findScroller(element: HTMLElement | null) {
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

/** A move of items going on - by the pointer, or chosen with the keys. */
interface MoveSession {
  /**
   * The keys: the place the choosing goes on from - the chosen one, at
   * first the moved item's - kept with the places as they were, for when
   * the rows change meanwhile.
   */
  cursor: PlaceCursor;
  ids: TreeItemId[];
  mode: "keyboard" | "pointer";
  place: DropPlace | null;
}

/** A press of the pointer on an item - until it is released. */
interface Press {
  /** Escape cancelled the drag - the release is still to come. */
  cancelled: boolean;
  dragging: boolean;
  /** The collapsed item hovered - it expands after a while. */
  expandId: TreeItemId | null;
  expandTimer: ReturnType<typeof setTimeout> | undefined;
  /** The frame of the auto-scroll. */
  frame: number;
  ids: TreeItemId[];
  longPress: ReturnType<typeof setTimeout> | undefined;
  place: DropPlace | null;
  pointer: { x: number; y: number };
  pointerId: number;
  /** What scrolls along near its edges - `null` for the page. */
  scroller: HTMLElement | null;
  start: { x: number; y: number };
  /** Removes the listeners of the press. */
  stop: () => void;
  /** What the pointer was last over - without `elementFromPoint`. */
  target: EventTarget | null;
  touch: boolean;
}

export interface TreeDragOptions<T extends TreeItem> {
  canDrag?: (item: T) => boolean;
  canDrop?: (move: {
    items: T[];
    position: TreeDropPosition;
    target: T;
  }) => boolean;
  /** `loadChildren` was given. */
  canLoad: boolean;
  /** Moving is on - `onMove` was given and the tree is not disabled. */
  enabled: boolean;
  /** Expands or collapses a row, as the arrow keys do. */
  expandRow: (row: TreeRow<T>, expand: boolean) => void;
  index: TreeIndex<T>;
  items: readonly T[];
  loads: LoadStates<T>;
  onMove?: (move: TreeMove<T["id"]>) => void;
  /** Shows the children of the item `id`, which items were dropped into. */
  revealChildren: (id: TreeItemId) => void;
  /**
   * Scrolls the row at `rowIndex` into view - with `status`, the row under
   * it saying its children load too.
   */
  revealRow: (rowIndex: number, status?: boolean) => void;
  rowIndexById: ReadonlyMap<TreeItemId, number>;
  /** The index of the row an element of the tree is the tree item of. */
  rowIndexOfElement: (element: Element) => number | undefined;
  rows: TreeRow<T>[];
  /** The selected items of a multiple selection - `null` otherwise. */
  selected: ReadonlySet<TreeItemId> | null;
  treeRef: React.RefObject<HTMLElement | null>;
}

/**
 * Moving the items of a tree: a drag of the pointer - a press moved a few
 * pixels, or a finger resting on an item - and the keyboard's move mode
 * (Ctrl / ⌘ + X, the arrow keys, Enter). Both end in `onMove`; the items
 * stay as they are until the app moves them.
 */
export default function useTreeDrag<T extends TreeItem>(
  options: TreeDragOptions<T>,
) {
  const locale = useLocale();
  const messages = useMessages();
  const [session, setSession] = useState<MoveSession | null>(null);
  // What the live region says - the count tells a repeated text apart
  const [announcement, setAnnouncement] = useState({ count: 0, text: "" });
  const pressRef = useRef<Press | null>(null);
  const badgeRef = useRef<HTMLElement | null>(null);

  const endPress = (press: Press) => {
    press.stop();
    clearTimeout(press.longPress);
    clearTimeout(press.expandTimer);
    cancelAnimationFrame(press.frame);
    if (pressRef.current === press) pressRef.current = null;
  };

  // Moving turned off, or any moved item is gone - the whole move ends
  if (
    session &&
    (!options.enabled || !session.ids.every((id) => options.index.byId.has(id)))
  ) {
    setSession(null);
  }
  const active = options.enabled ? session : null;

  // For the handlers of the document, which run between renders
  const latest = { ...options, localeCode: locale.code, messages, session };
  const latestRef = useRef(latest);

  useLayoutEffect(() => {
    latestRef.current = latest;
    // The press can outlive its visible session, or still be waiting for a
    // touch long press. Stop its document listeners and timers as well.
    const press = pressRef.current;
    if (
      press &&
      (!options.enabled || !press.ids.every((id) => options.index.byId.has(id)))
    ) {
      endPress(press);
    }
  });

  const announce = (text: string) =>
    setAnnouncement((previous) => ({ count: previous.count + 1, text }));

  const labelOf = (id: TreeItemId) =>
    latestRef.current.index.byId.get(id)?.label ?? String(id);

  /** `single` with the label of the one item, else `many` with their number. */
  const describeItems = (
    ids: TreeItemId[],
    single: string,
    many: PluralMessage,
  ) =>
    ids.length === 1
      ? formatMessage(single, { item: labelOf(ids[0]) })
      : formatPlural(latestRef.current.localeCode, many, ids.length);

  const describePlace = (place: DropPlace) => {
    const { index, messages } = latestRef.current;
    const item = labelOf(place.targetId);

    if (place.position === "before") {
      return formatMessage(messages.treeView.dropBefore, { item });
    }
    if (place.position === "inside") {
      return formatMessage(messages.treeView.dropInside, { item });
    }

    const parentId = index.parentOf.get(place.targetId);
    return parentId === null || parentId === undefined
      ? formatMessage(messages.treeView.dropAfter, { item })
      : formatMessage(messages.treeView.dropAfterIn, {
          item,
          parent: labelOf(parentId),
        });
  };

  /** Whether `ids` can be dropped at `place` - and it moves them somewhere. */
  const isAllowed = (place: DropPlace, ids: TreeItemId[]) => {
    const { canDrag, canDrop, enabled, index, items, loads } =
      latestRef.current;
    if (!enabled) return false;
    // A source's permissions may have changed since the move started.
    if (
      !ids.every((id) => {
        const item = index.byId.get(id);
        return (
          item !== undefined &&
          !index.disabled.has(id) &&
          (canDrag?.(item) ?? true)
        );
      })
    ) {
      return false;
    }
    if (!isValidDrop(place, new Set(ids), index)) return false;
    if (isNoopMove(place, ids, { index, items, loads })) return false;
    if (!canDrop) return true;

    const target = index.byId.get(place.targetId);
    const moved = ids.flatMap((id) => {
      const item = index.byId.get(id);
      return item ? [item] : [];
    });
    return (
      !!target && canDrop({ items: moved, position: place.position, target })
    );
  };

  /** Reports the drop - the app moves the items. */
  const commit = (place: DropPlace, ids: TreeItemId[]) => {
    const { canLoad, index, loads, messages, onMove, revealChildren } =
      latestRef.current;

    onMove?.({
      itemIds: ids,
      position: place.position,
      targetId: place.targetId,
    } as TreeMove<T["id"]>);

    // The moved items show in the item they were dropped into - unless its
    // children are still to load, which the app is changing now
    const target = index.byId.get(place.targetId);
    if (
      place.position === "inside" &&
      target &&
      !isLazy(target, loads, canLoad)
    ) {
      revealChildren(place.targetId);
    }

    announce(
      describeItems(ids, messages.treeView.moved, messages.treeView.movedMany),
    );
  };

  // The keyboard's move mode

  /** Picks up the item of `row` - with the selection it is part of. */
  const pickUp = (row: TreeRow<T>) => {
    const { canDrag, index, messages, rows, selected } = latestRef.current;
    const ids = getDraggedIds(row.id, { canDrag, index, selected });

    if (ids.length === 0) {
      announce(
        formatMessage(messages.treeView.cannotMove, { item: row.item.label }),
      );
      return;
    }

    const places = getDropPlaces(rows);
    const at = places.findIndex(
      (place) => place.position === "before" && place.targetId === row.id,
    );
    setSession({ cursor: { at, places }, ids, mode: "keyboard", place: null });
    announce(
      `${describeItems(ids, messages.treeView.moving, messages.treeView.movingMany)} ${messages.treeView.moveInstructions}`,
    );
  };

  /** Moves on to the next (or previous, first, last) place allowed. */
  const choose = (direction: "first" | "last" | "next" | "previous") => {
    const { messages, revealRow, rowIndexById, rows, session } =
      latestRef.current;
    if (!session) return;

    const places = getDropPlaces(rows);
    const step = direction === "previous" || direction === "last" ? -1 : 1;

    let at =
      direction === "first"
        ? 0
        : direction === "last"
          ? places.length - 1
          : stepFromCursor(places, session.cursor, step);
    while (
      at >= 0 &&
      at < places.length &&
      !isAllowed(places[at], session.ids)
    ) {
      at += step;
    }

    const place = places[at];
    if (!place) {
      // Nowhere further - says where it stays
      announce(
        session.place
          ? describePlace(session.place)
          : messages.treeView.moveInstructions,
      );
      return;
    }

    setSession({ ...session, cursor: { at, places }, place });
    announce(describePlace(place));

    const indicator = getPlaceRow(place, rows, rowIndexById);
    if (indicator) revealRow(indicator.rowIndex, indicator.status);
  };

  /** Drops the picked items at the chosen place. */
  const dropHere = () => {
    const { messages, session } = latestRef.current;
    if (!session) return;

    if (!session.place || !isAllowed(session.place, session.ids)) {
      announce(messages.treeView.moveInstructions);
      return;
    }

    setSession(null);
    commit(session.place, session.ids);
  };

  const cancel = () => {
    if (!latestRef.current.session) return;
    setSession(null);
    announce(latestRef.current.messages.treeView.moveCancelled);
  };

  /** Expands or collapses the item of the chosen place. */
  const toggleChosen = (expand: boolean) => {
    const { expandRow, rowIndexById, rows, session } = latestRef.current;
    const place = session?.place;
    const rowIndex = place ? rowIndexById.get(place.targetId) : undefined;
    if (rowIndex !== undefined) expandRow(rows[rowIndex], expand);
  };

  /**
   * The keys of the move mode on the focused item `row` - and Ctrl / ⌘ + X,
   * which starts it. Returns whether the key was handled.
   */
  const onKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    row: TreeRow<T>,
  ) => {
    const { enabled, session } = latestRef.current;
    if (!enabled) return false;

    const mod = (event.ctrlKey || event.metaKey) && !event.altKey;
    const letter = event.key.toLowerCase();

    if (session?.mode !== "keyboard") {
      if (!mod || event.shiftKey || letter !== "x") return false;
      event.preventDefault();
      pickUp(row);
      return true;
    }

    // Tab leaves the tree - which cancels the move
    if (event.key === "Tab") return false;
    event.preventDefault();

    // Left expands and Right collapses in a right-to-left page
    const key =
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      isRtl(event.currentTarget)
        ? event.key === "ArrowLeft"
          ? "ArrowRight"
          : "ArrowLeft"
        : event.key;

    if (mod && letter === "v") dropHere();
    else if (mod && letter === "x") pickUp(row);
    else if (key === "ArrowDown") choose("next");
    else if (key === "ArrowUp") choose("previous");
    else if (key === "Home") choose("first");
    else if (key === "End") choose("last");
    else if (key === "ArrowRight") toggleChosen(true);
    else if (key === "ArrowLeft") toggleChosen(false);
    else if (key === "Enter") dropHere();
    else if (key === "Escape") {
      // The Escape of the move - not of a dialog or popover around
      event.stopPropagation();
      cancel();
    }
    return true;
  };

  /** The focus left the tree - a move chosen with the keys is cancelled. */
  const onBlur = (event: React.FocusEvent<HTMLElement>) => {
    const { session, treeRef } = latestRef.current;
    if (session?.mode !== "keyboard") return;

    const next = event.relatedTarget;
    if (next instanceof Node && treeRef.current?.contains(next)) return;
    if (next) {
      cancel();
      return;
    }

    // Nothing took the focus: the window lost it (the move goes on when it
    // is back), or the focused row went away (the tree focuses another)
    setTimeout(() => {
      const { session, treeRef } = latestRef.current;
      if (
        session?.mode === "keyboard" &&
        document.hasFocus() &&
        !treeRef.current?.contains(document.activeElement)
      ) {
        cancel();
      }
    });
  };

  // The pointer

  const moveBadge = (press: Press) => {
    const badge = badgeRef.current;
    if (badge) {
      badge.style.translate = `${press.pointer.x + 16}px ${press.pointer.y + 12}px`;
    }
  };

  /** A collapsed item hovered for a while expands - it loads its children. */
  const scheduleExpand = (press: Press) => {
    const { rowIndexById, rows } = latestRef.current;
    const place = press.place;
    const rowIndex =
      place?.position === "inside"
        ? rowIndexById.get(place.targetId)
        : undefined;
    const row = rowIndex === undefined ? undefined : rows[rowIndex];
    const id = row && row.expandable && !row.expanded ? row.id : null;
    if (id === press.expandId) return;

    clearTimeout(press.expandTimer);
    press.expandId = id;
    if (id === null) return;

    press.expandTimer = setTimeout(() => {
      press.expandId = null;
      const { expandRow, rowIndexById, rows } = latestRef.current;
      const index = rowIndexById.get(id);
      const current = index === undefined ? undefined : rows[index];
      if (
        pressRef.current === press &&
        !press.cancelled &&
        current &&
        !current.expanded
      ) {
        expandRow(current, true);
      }
    }, AUTO_EXPAND_DELAY);
  };

  /** The place under the pointer. */
  const updatePointerPlace = (press: Press) => {
    const { index, rowIndexById, rowIndexOfElement, rows, treeRef } =
      latestRef.current;
    const tree = treeRef.current;
    const { x, y } = press.pointer;

    const hit =
      typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(x, y)
        : press.target instanceof Element
          ? press.target
          : null;
    const rowElement = hit?.closest("[role='treeitem']");
    const rowIndex =
      rowElement && tree?.contains(rowElement)
        ? rowIndexOfElement(rowElement)
        : undefined;

    // Over the dragged items (or their descendants) nothing is dropped - not
    // even next to them
    const moved = new Set(press.ids);
    const rowId = rowIndex === undefined ? undefined : rows[rowIndex].id;
    const isOverMoved =
      rowId !== undefined &&
      (moved.has(rowId) ||
        getAncestors(index.parentOf, rowId).some((id) => moved.has(id)));

    let place: DropPlace | null = null;
    if (rowElement && rowIndex !== undefined && !isOverMoved) {
      const rect = rowElement.getBoundingClientRect();
      const rem =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const offset = isRtl(rowElement) ? rect.right - x : x - rect.left;

      const { items, loads } = latestRef.current;
      place = getPointerPlace(rows, rowIndexById, {
        isAllowed: (candidate) => isAllowed(candidate, press.ids),
        isNoop: (candidate) =>
          isNoopMove(candidate, press.ids, { index, items, loads }),
        level: levelAt(offset / rem),
        ratio: rect.height > 0 ? (y - rect.top) / rect.height : 0.5,
        rowIndex,
      });
    }

    if (samePlace(place, press.place)) return;
    press.place = place;
    setSession((current) =>
      current?.mode === "pointer" ? { ...current, place } : current,
    );
    scheduleExpand(press);
  };

  /** How fast the view scrolls: towards -1 / 1 the nearer its top / bottom edge. */
  const edgeSpeed = (press: Press) => {
    const { y } = press.pointer;
    const rect = press.scroller?.getBoundingClientRect();
    const top = rect ? rect.top : 0;
    const bottom = rect ? rect.bottom : window.innerHeight;

    if (y < top + AUTO_SCROLL_EDGE) {
      return -Math.min(1, (top + AUTO_SCROLL_EDGE - y) / AUTO_SCROLL_EDGE);
    }
    if (y > bottom - AUTO_SCROLL_EDGE) {
      return Math.min(1, (y - bottom + AUTO_SCROLL_EDGE) / AUTO_SCROLL_EDGE);
    }
    return 0;
  };

  /** Scrolls the view while the pointer is near its edge. */
  const autoScroll = (press: Press) => {
    if (press.frame || edgeSpeed(press) === 0) return;

    const step = () => {
      press.frame = 0;
      if (pressRef.current !== press || !press.dragging || press.cancelled) {
        return;
      }

      const speed = edgeSpeed(press);
      if (speed === 0) return;

      const delta =
        Math.sign(speed) *
        Math.max(1, Math.round(Math.abs(speed) * AUTO_SCROLL_SPEED));
      const scroller = press.scroller ?? document.scrollingElement;
      if (!scroller) return;

      const before = scroller.scrollTop;
      scroller.scrollTop += delta;
      // At the end of what it can scroll - the next move of the pointer
      // starts it again
      if (scroller.scrollTop === before) return;

      updatePointerPlace(press);
      press.frame = requestAnimationFrame(step);
    };

    press.frame = requestAnimationFrame(step);
  };

  const startDragging = (press: Press) => {
    press.dragging = true;
    press.scroller = findScroller(latestRef.current.treeRef.current);
    setSession({
      cursor: { at: -1, places: [] },
      ids: press.ids,
      mode: "pointer",
      place: null,
    });
    updatePointerPlace(press);
    autoScroll(press);
  };

  const finishPointerDrag = (press: Press) => {
    setSession(null);
    if (press.place && isAllowed(press.place, press.ids)) {
      commit(press.place, press.ids);
    }
  };

  /** A press on the row of the item `id` - it may become a drag. */
  const onPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    id: TreeItemId,
  ) => {
    const { canDrag, enabled, index, selected, session } = latestRef.current;
    if (
      !enabled ||
      event.button !== 0 ||
      !event.isPrimary ||
      // The Ctrl + click that opens the context menu on a Mac
      (event.ctrlKey && isMac()) ||
      isFromControl(event)
    ) {
      return;
    }

    if (pressRef.current) endPress(pressRef.current);
    if (session?.mode === "keyboard") cancel();

    const ids = getDraggedIds(id, { canDrag, index, selected });
    if (ids.length === 0) return;

    const point = { x: event.clientX, y: event.clientY };
    const press: Press = {
      cancelled: false,
      dragging: false,
      expandId: null,
      expandTimer: undefined,
      frame: 0,
      ids,
      longPress: undefined,
      place: null,
      pointer: point,
      pointerId: event.pointerId,
      scroller: null,
      start: point,
      stop: () => {},
      target: event.target,
      touch: event.pointerType === "touch",
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

      moveBadge(press);
      updatePointerPlace(press);
      autoScroll(press);
    };

    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== press.pointerId) return;
      if (press.dragging) {
        swallowNextClick();
        if (!press.cancelled) finishPointerDrag(press);
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

    // Picked up, the finger moves the items - not the page
    const handleTouchMove = (touchEvent: TouchEvent) => {
      if (press.dragging) touchEvent.preventDefault();
    };
    // Nor does resting on the item open the menu of the browser
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

  // A press going on when the tree unmounts
  useEffect(
    () => () => {
      const press = pressRef.current;
      if (!press) return;
      press.stop();
      clearTimeout(press.longPress);
      clearTimeout(press.expandTimer);
      cancelAnimationFrame(press.frame);
      pressRef.current = null;
    },
    [],
  );

  /** The badge beside the pointer - placed where the pointer is. */
  const attachBadge = useCallback((element: HTMLElement | null) => {
    badgeRef.current = element;
    const press = pressRef.current;
    if (element && press) {
      element.style.translate = `${press.pointer.x + 16}px ${press.pointer.y + 12}px`;
    }
  }, []);

  const ids = active?.ids ?? [];

  return {
    /** What the live region says - a repeated text differs by a space. */
    announcement: announcement.text + (announcement.count % 2 === 1 ? " " : ""),
    attachBadge,
    /** The text of the badge of a pointer drag. */
    badgeText:
      ids.length === 1
        ? (options.index.byId.get(ids[0])?.label ?? "")
        : formatPlural(locale.code, messages.treeView.itemCount, ids.length),
    mode: active?.mode ?? null,
    movedIds: active ? new Set(active.ids) : EMPTY_IDS,
    onBlur,
    onKeyDown,
    onPointerDown,
    place: active?.place ?? null,
  };
}
