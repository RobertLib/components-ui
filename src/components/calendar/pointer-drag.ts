/** Pixels the pointer may move before a press becomes a drag. */
export const DRAG_THRESHOLD = 5;

/** How near an edge of the view a drag scrolls it, in pixels. */
const AUTO_SCROLL_EDGE = 40;

/** Pixels per frame the view scrolls with the pointer right at its edge. */
const AUTO_SCROLL_SPEED = 16;

// Controls of their own inside a tile - a press on them starts no drag
const OWN_CONTROLS =
  "a[href], button, input, select, textarea, [data-event-actions]";

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Whether a press may start a drag: the primary button of the primary
 * pointer - not a right click nor the Ctrl + click that opens the context
 * menu on a Mac - and not on a control inside the pressed element, like an
 * event action or a link of a title.
 */
export function isDragPress(event: React.PointerEvent) {
  if (event.button !== 0 || !event.isPrimary) return false;
  if (event.ctrlKey && isMac()) return false;

  const control =
    event.target instanceof Element ? event.target.closest(OWN_CONTROLS) : null;
  return !control || !event.currentTarget.contains(control);
}

function capturePointer(element: Element, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // A pointer that is gone already
  }
}

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

export interface PointerDragOffset {
  /** Pixels to the right of the press point (negative: to the left). */
  x: number;
  /** Pixels below the press point (negative: above it). */
  y: number;
}

export interface PointerDragOptions {
  /** `y`: only a vertical move makes the press a drag. */
  axis?: "both" | "y";
  /**
   * The element holding the slots. The pointer is measured in it, so the
   * view scrolling during a drag moves the pointer over the slots too.
   */
  grid: HTMLElement | null;
  /**
   * The scroll container of the view - it scrolls along when a drag nears
   * its top or bottom edge.
   */
  scroller?: HTMLElement | null;
  /**
   * The scroller scrolls sideways too, near its left and right edges - for
   * a move to columns out of view.
   */
  scrollSideways?: boolean;
  /**
   * The pointer moved past the threshold, or the grid scrolled under it -
   * `offset` is how far it is from where it was pressed, measured in the
   * grid.
   */
  onMove: (offset: PointerDragOffset) => void;
  /**
   * The pointer was released after a drag. Returns whether the drag changed
   * something, or showed a change on the way (and was dragged back) - the
   * click that ends it is swallowed then.
   */
  onDrop: () => boolean;
  /**
   * No drop after all: the pointer was released without a drag, Escape
   * cancelled it, the browser took the pointer over (e.g. to zoom), a
   * context menu opened or its release got lost.
   */
  onCancel: () => void;
}

/**
 * How fast the view scrolls with the pointer at `position`: 0 between
 * `start` and `end`, towards -1 / 1 the farther it is before / after them.
 */
function edgeSpeed(position: number, start: number, end: number) {
  if (position < start) {
    return -Math.min(1, (start - position) / AUTO_SCROLL_EDGE);
  }
  if (position > end) {
    return Math.min(1, (position - end) / AUTO_SCROLL_EDGE);
  }
  return 0;
}

/** Pixels a frame scrolls at `speed` - at least one. */
const scrollStep = (speed: number) =>
  Math.sign(speed) *
  Math.max(1, Math.round(Math.abs(speed) * AUTO_SCROLL_SPEED));

/**
 * Follows a press on a tile or a slot until the pointer is released. Only
 * the pressed pointer counts - a second finger does not take the drag over.
 * Escape cancels the drag; the click ending a drag that changed something
 * (or was cancelled) is swallowed. Returns a function that ends it without
 * a callback, e.g. when the view unmounts.
 */
export function startPointerDrag(
  event: React.PointerEvent,
  {
    axis = "both",
    grid,
    scroller,
    scrollSideways = false,
    onCancel,
    onDrop,
    onMove,
  }: PointerDragOptions,
): () => void {
  const { pointerId, pointerType } = event;
  const gridRect = grid?.getBoundingClientRect();
  // The press point in the grid
  const origin = {
    x: event.clientX - (gridRect?.left ?? 0),
    y: event.clientY - (gridRect?.top ?? 0),
  };
  const scrollerRect = scroller?.getBoundingClientRect();
  // The part of the scroller under its sticky header - its top edge for the
  // auto-scroll is below it
  const scrollsDown =
    !!scroller && scroller.scrollHeight > scroller.clientHeight;
  const headerHeight =
    scrollsDown && scrollerRect && gridRect
      ? gridRect.top - scrollerRect.top + scroller.scrollTop
      : 0;
  // The part right of its sticky time column - its left edge is there
  const scrollsSideways =
    scrollSideways && !!scroller && scroller.scrollWidth > scroller.clientWidth;
  const timeColumnWidth =
    scrollsSideways && scrollerRect && gridRect
      ? gridRect.left - scrollerRect.left + scroller.scrollLeft
      : 0;

  let pointer = { x: event.clientX, y: event.clientY };
  let dragging = false;
  let frame = 0;
  // Stops waiting for the release of a drag cancelled by Escape
  let stopRelease = () => {};

  // The moves and the release come to the pressed element even when the
  // pointer leaves it - so does the click that follows
  capturePointer(event.currentTarget, pointerId);

  const report = () => {
    const rect = grid?.getBoundingClientRect();
    const offset = {
      x: pointer.x - (rect?.left ?? 0) - origin.x,
      y: pointer.y - (rect?.top ?? 0) - origin.y,
    };

    // The pointer jittering during a click moves nothing
    if (!dragging) {
      dragging =
        Math.abs(offset.y) > DRAG_THRESHOLD ||
        (axis === "both" && Math.abs(offset.x) > DRAG_THRESHOLD);
      if (!dragging) return;
    }

    onMove(offset);
  };

  const autoScrollStep = () => {
    frame = 0;
    if (!scroller || !dragging || (!scrollsDown && !scrollsSideways)) return;

    const rect = scroller.getBoundingClientRect();
    // Faster the nearer the pointer is to the edge
    const speedY = scrollsDown
      ? edgeSpeed(
          pointer.y,
          rect.top + headerHeight + AUTO_SCROLL_EDGE,
          rect.bottom - AUTO_SCROLL_EDGE,
        )
      : 0;
    const speedX = scrollsSideways
      ? edgeSpeed(
          pointer.x,
          rect.left + timeColumnWidth + AUTO_SCROLL_EDGE,
          rect.right - AUTO_SCROLL_EDGE,
        )
      : 0;
    if (speedX === 0 && speedY === 0) return;

    const { scrollLeft, scrollTop } = scroller;
    if (speedY !== 0) scroller.scrollTop += scrollStep(speedY);
    if (speedX !== 0) scroller.scrollLeft += scrollStep(speedX);
    // Its end reached - the scroll event reports the rest
    if (
      scroller.scrollTop !== scrollTop ||
      scroller.scrollLeft !== scrollLeft
    ) {
      frame = requestAnimationFrame(autoScrollStep);
    }
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("pointermove", handleMove);
    document.removeEventListener("pointerup", handleUp);
    document.removeEventListener("pointercancel", handleCancel);
    document.removeEventListener("scroll", handleScroll, true);
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("contextmenu", handleContextMenu, true);
  };

  const cancel = () => {
    stop();
    onCancel();
  };

  /**
   * Escape cancelled the drag with the pointer still pressed - its release
   * brings a click that is no click either. Only that is waited for: the
   * listeners of the drag are gone, a lost release (a new press, a move
   * without a button) stops the waiting too.
   */
  const awaitRelease = () => {
    const handleRelease = (releaseEvent: PointerEvent) => {
      if (releaseEvent.pointerId !== pointerId) return;
      stopRelease();
      swallowNextClick();
    };
    const handleLost = (lostEvent: PointerEvent) => {
      if (lostEvent.pointerId !== pointerId) return;
      if (lostEvent.type === "pointermove" && lostEvent.buttons !== 0) return;
      stopRelease();
    };

    stopRelease = () => {
      document.removeEventListener("pointerup", handleRelease);
      document.removeEventListener("pointercancel", handleLost);
      document.removeEventListener("pointerdown", handleLost);
      document.removeEventListener("pointermove", handleLost);
    };

    document.addEventListener("pointerup", handleRelease);
    document.addEventListener("pointercancel", handleLost);
    document.addEventListener("pointerdown", handleLost);
    document.addEventListener("pointermove", handleLost);
  };

  function handleMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) return;

    // No button is pressed - its release went elsewhere, e.g. to a context
    // menu
    if (moveEvent.buttons === 0) {
      cancel();
      return;
    }

    pointer = { x: moveEvent.clientX, y: moveEvent.clientY };
    report();
    if (!frame) frame = requestAnimationFrame(autoScrollStep);
  }

  function handleUp(upEvent: PointerEvent) {
    if (upEvent.pointerId !== pointerId) return;
    stop();

    if (!dragging) {
      // A click - it follows
      onCancel();
    } else if (onDrop()) {
      swallowNextClick();
    }
  }

  function handleCancel(cancelEvent: PointerEvent) {
    if (cancelEvent.pointerId !== pointerId) return;
    cancel();
  }

  function handleScroll() {
    report();
  }

  function handleKeyDown(keyEvent: KeyboardEvent) {
    if (keyEvent.key !== "Escape" || !dragging) return;
    // It cancels the drag and nothing else - not a Dialog around
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    cancel();
    // The click ending a cancelled drag is no click either
    awaitRelease();
  }

  function handleContextMenu() {
    // A long press of a finger brings it too - and is how a drag starts
    if (pointerType === "touch") return;
    // The menu may take the release - the drag is off
    cancel();
  }

  document.addEventListener("pointermove", handleMove);
  document.addEventListener("pointerup", handleUp);
  document.addEventListener("pointercancel", handleCancel);
  // Any scrolling moves the grid under the pointer
  document.addEventListener("scroll", handleScroll, true);
  // Before the key handlers of the page and the overlays
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("contextmenu", handleContextMenu, true);

  return () => {
    stop();
    stopRelease();
  };
}
