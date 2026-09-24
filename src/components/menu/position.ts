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
  left: number;
  /** Set when the menu is taller than the viewport - it scrolls then. */
  maxHeight?: number;
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

const clamp = (value: number, min: number, max: number) =>
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
 * pointer, or the focused element it was opened from with the keyboard.
 * Without room there, it opens above the anchor and ends at its right edge,
 * and it is pushed inside the viewport at last.
 */
export function placeAtAnchor(
  anchor: AnchorRect,
  size: Size,
  viewport: Size,
  gap: number,
): MenuPosition {
  const fitsRight =
    anchor.left + size.width <= viewport.width - VIEWPORT_MARGIN;
  const left = clamp(
    fitsRight ? anchor.left : anchor.right - size.width,
    VIEWPORT_MARGIN,
    viewport.width - VIEWPORT_MARGIN - size.width,
  );

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const top =
    below + size.height <= viewport.height - VIEWPORT_MARGIN ||
    above < VIEWPORT_MARGIN
      ? below
      : above;

  return { left, ...fitHeight(top, size.height, viewport) };
}

/**
 * Where a submenu goes: right of its item, its first item level with it.
 * Near the right edge it opens to the left; with room on neither side (a
 * phone) it opens below the item, over the rest of its menu.
 */
export function placeSubmenu(
  item: AnchorRect,
  size: Size,
  viewport: Size,
): MenuPosition {
  const right = item.right + ITEM_INSET - 1;
  const left = item.left - ITEM_INSET + 1 - size.width;
  const top = item.top - ITEM_INSET;

  if (right + size.width <= viewport.width - VIEWPORT_MARGIN) {
    return { left: right, ...fitHeight(top, size.height, viewport) };
  }
  if (left >= VIEWPORT_MARGIN) {
    return { left, ...fitHeight(top, size.height, viewport) };
  }

  return {
    left: clamp(
      item.left + 12,
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
