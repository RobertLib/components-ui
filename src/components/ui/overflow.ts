/**
 * The layout of a row of items that move into a "More" menu once the row
 * has no room for them - shared by `Tabs` and `Toolbar`. The items are
 * measured where they are rendered: those in the menu stay in the page,
 * out of sight (`OVERFLOW_HIDDEN_CLASSES`), so their widths are known for
 * when the row has room again - measured back in the flow of the row
 * (`measureInFlow`), also the room of a row as wide as its content.
 */

/**
 * An item in the menu, out of the flow of the row and out of sight - also
 * of assistive technology and the focus. At the end of the row, so it can
 * only reach past the start of it, where nothing scrolls to it.
 */
export const OVERFLOW_HIDDEN_CLASSES =
  "pointer-events-none invisible absolute inset-e-0 top-0";

// Room the measurements may lack - the widths are fractional, the room of
// the row is rounded by the browser
const TOLERANCE = 0.5;

export interface OverflowLayout {
  /** Width of the room of the row - its content box. */
  available: number;
  /**
   * Show the "More" button anyway, e.g. for items that are always in the
   * menu.
   */
  forceMore?: boolean;
  /** Space between two items. */
  gap: number;
  /** Width the "More" button takes, with the space before it. */
  moreWidth: number;
  /**
   * The items that may move into the menu, in the order they go - the
   * others stay in the row whatever its width.
   */
  order: readonly number[];
  /**
   * The items that are separators - shown only between two shown items,
   * once.
   */
  separators?: ReadonlySet<number>;
  /** Width of each item, in their order. */
  widths: readonly number[];
}

/**
 * Which of `count` items are shown - those not `hidden`, and of the
 * separators only one between two shown items.
 */
export function getShownItems(
  count: number,
  hidden: ReadonlySet<number>,
  separators?: ReadonlySet<number>,
) {
  const shown: boolean[] = Array.from({ length: count }, () => false);
  let hasItem = false;
  let pendingSeparator = -1;

  for (let index = 0; index < count; index++) {
    if (hidden.has(index)) continue;

    if (separators?.has(index)) {
      // The first of separators in a row - after an item only
      if (hasItem && pendingSeparator === -1) pendingSeparator = index;
      continue;
    }

    if (pendingSeparator !== -1) shown[pendingSeparator] = true;
    pendingSeparator = -1;
    shown[index] = true;
    hasItem = true;
  }

  return shown;
}

/** The width of the shown items with the space between them. */
function getRowWidth(
  widths: readonly number[],
  hidden: ReadonlySet<number>,
  gap: number,
  separators?: ReadonlySet<number>,
) {
  const shown = getShownItems(widths.length, hidden, separators);
  let width = 0;
  let count = 0;

  shown.forEach((isShown, index) => {
    if (!isShown) return;
    width += widths[index];
    count++;
  });

  return width + gap * Math.max(count - 1, 0);
}

/**
 * The items that move into the menu, in their order - none while all fit
 * the row. Otherwise the row makes room for the "More" button too, and the
 * items go in `order` until the rest fits (or none may go any more).
 */
export function getOverflowingItems({
  available,
  forceMore = false,
  gap,
  moreWidth,
  order,
  separators,
  widths,
}: OverflowLayout): number[] {
  const hidden = new Set<number>();

  if (
    !forceMore &&
    getRowWidth(widths, hidden, gap, separators) <= available + TOLERANCE
  ) {
    return [];
  }

  const room = available - moreWidth;
  for (const index of order) {
    if (getRowWidth(widths, hidden, gap, separators) <= room + TOLERANCE) {
      break;
    }
    hidden.add(index);
  }

  return [...hidden].sort((a, b) => a - b);
}

/**
 * Calls `measure` with `elements` - the items out of sight in the menu -
 * back in the flow of the row, and takes them out again before anything
 * is painted. A bar as wide as its content (in a flex row, beside a title)
 * narrows as its items move into the menu - measured with all of them, it
 * takes the room it has for them, also once the row around it widens.
 */
export function measureInFlow<T>(
  elements: readonly HTMLElement[],
  measure: () => T,
): T {
  for (const element of elements) element.style.position = "static";
  try {
    return measure();
  } finally {
    for (const element of elements) element.style.removeProperty("position");
  }
}

/**
 * Whether a `ResizeObserver` reports a change the layout of a row follows -
 * of an element but `parent`, or of the width of `parent`, the element
 * around the row (`lastWidth` holds its width as last seen). A change of
 * its height alone - the content under a bar - is none.
 */
export function isRowResize(
  entries: readonly ResizeObserverEntry[],
  parent: Element | null,
  lastWidth: { current: number | null },
) {
  let resized = entries.length === 0;
  for (const entry of entries) {
    if (entry.target !== parent) {
      resized = true;
    } else if (entry.contentRect.width !== lastWidth.current) {
      lastWidth.current = entry.contentRect.width;
      resized = true;
    }
  }
  return resized;
}

/** The width of the content box of `element` - without its padding. */
export function getContentWidth(element: Element) {
  const style = getComputedStyle(element);
  const padding =
    (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0) +
    (parseFloat(style.borderLeftWidth) || 0) +
    (parseFloat(style.borderRightWidth) || 0);
  return Math.max(element.getBoundingClientRect().width - padding, 0);
}

/** The space between the items of a flex row. */
export function getColumnGap(element: Element) {
  return parseFloat(getComputedStyle(element).columnGap) || 0;
}

/** Whether two lists have the same items in the same order. */
export const isSameList = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);
