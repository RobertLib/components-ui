/** A box in viewport coordinates - a `DOMRect`, or a point with no size. */
export interface AnchorRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface Size {
  height: number;
  width: number;
}

export interface MenuPosition {
  /**
   * The edge of the anchor the menu lines up with - `start` / `end` in the
   * writing direction (the left / right edge, the other way round right to
   * left) for a menu above or below it, the top (`start`) for one beside it.
   */
  align: "start" | "end";
  left: number;
  /** Set when the menu is taller than the viewport - it scrolls then. */
  maxHeight?: number;
  /** The side of the anchor the menu is on. */
  side: "top" | "bottom" | "left" | "right";
  top: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Space kept between a menu and the edges of the viewport. */
export const VIEWPORT_MARGIN = 8;

// From the edge of an item to the outer edge of its menu: the margin of the
// item (m-1) and the border of the menu - a submenu starts right there
const ITEM_INSET = 5;

/**
 * `value` held to `min` - `max`; to `min` when the range is empty (a panel
 * wider than the room).
 */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** The point as a box of no size - the anchor of a menu at the pointer. */
export const pointRect = ({ x, y }: Point): AnchorRect => ({
  bottom: y,
  left: x,
  right: x,
  top: y,
});

/**
 * Held to the height of the viewport - a taller menu starts at its top and
 * scrolls.
 */
function fitHeight(top: number, height: number, viewport: Size) {
  const room = viewport.height - 2 * VIEWPORT_MARGIN;
  if (height > room) {
    return { maxHeight: Math.max(room, 0), top: VIEWPORT_MARGIN };
  }
  return {
    top: clamp(
      top,
      VIEWPORT_MARGIN,
      viewport.height - VIEWPORT_MARGIN - height,
    ),
  };
}

/**
 * Where a context menu goes: below the anchor and from its left edge - the
 * pointer, or the focused element it was opened from with the keyboard -
 * or, right to left (`rtl`), from its right edge. Without room there, it
 * opens above the anchor and from its other edge, and it is pushed inside
 * the viewport at last.
 */
export function placeAtAnchor(
  anchor: AnchorRect,
  size: Size,
  viewport: Size,
  gap: number,
  rtl = false,
): MenuPosition {
  const fitsRight =
    anchor.left + size.width <= viewport.width - VIEWPORT_MARGIN;
  const fitsLeft = anchor.right - size.width >= VIEWPORT_MARGIN;
  const endsAtRight = rtl ? fitsLeft || !fitsRight : !fitsRight;
  const alignedLeft = clamp(
    endsAtRight ? anchor.right - size.width : anchor.left,
    VIEWPORT_MARGIN,
    viewport.width - VIEWPORT_MARGIN - size.width,
  );

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const isBelow =
    below + size.height <= viewport.height - VIEWPORT_MARGIN ||
    above < VIEWPORT_MARGIN;

  return {
    align: endsAtRight !== rtl ? "end" : "start",
    left: alignedLeft,
    side: isBelow ? "bottom" : "top",
    ...fitHeight(isBelow ? below : above, size.height, viewport),
  };
}

/**
 * Where a submenu goes: right of its item - left of it right to left
 * (`rtl`) - its first item level with it. Near that edge of the viewport it
 * opens on the other side; with room on neither side (a phone) it opens
 * below the item, over the rest of its menu.
 */
export function placeSubmenu(
  item: AnchorRect,
  size: Size,
  viewport: Size,
  rtl = false,
): MenuPosition {
  const right = item.right + ITEM_INSET - 1;
  const left = item.left - ITEM_INSET + 1 - size.width;
  const top = item.top - ITEM_INSET;
  const fitsRight = right + size.width <= viewport.width - VIEWPORT_MARGIN;
  const fitsLeft = left >= VIEWPORT_MARGIN;

  for (const side of rtl
    ? (["left", "right"] as const)
    : (["right", "left"] as const)) {
    if (side === "right" ? fitsRight : fitsLeft) {
      return {
        align: "start",
        left: side === "right" ? right : left,
        side,
        ...fitHeight(top, size.height, viewport),
      };
    }
  }

  return {
    align: "start",
    side: "bottom",
    left: clamp(
      rtl ? item.right - 12 - size.width : item.left + 12,
      VIEWPORT_MARGIN,
      viewport.width - VIEWPORT_MARGIN - size.width,
    ),
    ...fitHeight(item.bottom + 2, size.height, viewport),
  };
}

/**
 * The area the pointer crosses on its way from an item to its open submenu
 * - the triangle from where it left the item to the near edge of the
 * submenu, and the submenu itself. Other items it passes on the way do not
 * take over meanwhile.
 */
export function getGracePolygon(exit: Point, submenu: AnchorRect): Point[] {
  const toRight = submenu.left >= exit.x;
  // A few pixels back into the item, so a move along its edge counts too
  const bleed = toRight ? -5 : 5;
  const near = toRight ? submenu.left : submenu.right;
  const far = toRight ? submenu.right : submenu.left;

  return [
    { x: exit.x + bleed, y: exit.y },
    { x: near, y: submenu.top },
    { x: far, y: submenu.top },
    { x: far, y: submenu.bottom },
    { x: near, y: submenu.bottom },
  ];
}

/** Whether a point lies inside a polygon (ray casting). */
export function isPointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }

  return inside;
}

/**
 * A side of its anchor a floating panel opens on - `start` and `end` are
 * logical: the left and the right side, the other way round right to left.
 */
export type FloatingSide =
  "top" | "bottom" | "left" | "right" | "start" | "end";

/** A side of the screen - `FloatingSide` with `start` / `end` resolved. */
export type PhysicalSide = "top" | "bottom" | "left" | "right";

/** The physical side `side` is in the writing direction (`rtl`). */
export const resolveSide = (side: FloatingSide, rtl: boolean): PhysicalSide =>
  side === "start"
    ? rtl
      ? "right"
      : "left"
    : side === "end"
      ? rtl
        ? "left"
        : "right"
      : side;

/**
 * What a floating panel can be placed at besides its trigger: an element, a
 * box in viewport coordinates (a `DOMRect`, e.g. of the text selection) or a
 * point (`{ x, y }`, e.g. of a click).
 */
export type VirtualAnchor = Element | AnchorRect | Point;

/** A box with its size - the anchor of a panel, as it is measured. */
export interface AnchorBox extends AnchorRect {
  height: number;
  width: number;
}

/** The box of `anchor` in viewport coordinates, measured now. */
export function measureAnchor(anchor: VirtualAnchor): AnchorBox {
  if (anchor instanceof Element) {
    const { bottom, height, left, right, top, width } =
      anchor.getBoundingClientRect();
    return { bottom, height, left, right, top, width };
  }

  const { bottom, left, right, top } =
    "top" in anchor ? anchor : pointRect(anchor);
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

/** Whether two measured boxes are the same - a panel keeps its place then. */
export const isSameBox = (a: AnchorBox | null, b: AnchorBox | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height);

/**
 * The part of the page that is seen, in viewport coordinates - on a phone
 * without the on-screen keyboard over it (the visual viewport).
 */
export function getVisibleArea(): AnchorRect {
  const viewport = window.visualViewport;
  if (!viewport) {
    return {
      bottom: window.innerHeight,
      left: 0,
      right: window.innerWidth,
      top: 0,
    };
  }
  return {
    bottom: viewport.offsetTop + viewport.height,
    left: viewport.offsetLeft,
    right: viewport.offsetLeft + viewport.width,
    top: viewport.offsetTop,
  };
}

// An `overflow` that clips what scrolls out of the element
const CLIPPING_OVERFLOW = /auto|scroll|hidden|clip|overlay/;

/**
 * The ancestors of `element` that clip it once it scrolls out of them - a
 * scrolling list, a table with `overflow-x-auto`. Not those around a
 * `fixed` element on the way up, which stays where it is as they scroll.
 * Read them once, when the panel opens: `getComputedStyle` of every
 * ancestor is too slow for every scroll event.
 */
export function getClippingAncestors(element: Element): Element[] {
  const ancestors: Element[] = [];
  const { body, documentElement } = element.ownerDocument;

  for (
    let current: Element | null = element;
    current && current !== documentElement && current !== body;
    current = current.parentElement
  ) {
    const { overflowX, overflowY, position } = getComputedStyle(current);
    if (
      current !== element &&
      CLIPPING_OVERFLOW.test(`${overflowX} ${overflowY}`)
    ) {
      ancestors.push(current);
    }
    if (position === "fixed") break;
  }

  return ancestors;
}

/**
 * Whether the box of an anchor is scrolled out of view - out of the part of
 * the page that is seen, or out of one of the clipping ancestors of the
 * anchor (see `getClippingAncestors`). A floating panel hides meanwhile,
 * instead of pointing at nothing.
 */
export function isOutOfView(anchor: AnchorRect, clips: readonly Element[]) {
  const areas = [
    getVisibleArea(),
    ...clips.map((clip) => clip.getBoundingClientRect()),
  ];
  return areas.some(
    (area) =>
      anchor.bottom < area.top ||
      anchor.top > area.bottom ||
      anchor.right < area.left ||
      anchor.left > area.right,
  );
}

/**
 * Where the arrow of a floating panel goes along the edge it is on: at the
 * center of the anchor, but kept `inset` pixels inside the panel - off its
 * rounded corners - when the panel was moved along that edge into the
 * viewport.
 */
export const getArrowOffset = (
  anchorStart: number,
  anchorEnd: number,
  panelStart: number,
  panelEnd: number,
  inset: number,
) => clamp((anchorStart + anchorEnd) / 2, panelStart + inset, panelEnd - inset);
