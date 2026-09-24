/**
 * The size math of `Splitter`. Sizes are percentages of the space the panes
 * share, adding up to 100; a handle moves the space between the two panes
 * next to it - the one before it (its primary pane) and the one after it.
 */

/** Differences below this are rounding - a pane this small is collapsed. */
export const EPSILON = 0.001;

/** What the panes may be, in percent. */
export interface PaneLimits {
  /** Which panes may collapse to 0. */
  collapsible: readonly boolean[];
  max: readonly number[];
  min: readonly number[];
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * `sizes` for `count` panes scaled to add up to 100 - equal sizes when they
 * do not fit (another count, negative or no numbers).
 */
export function normalizeSizes(
  sizes: readonly number[] | null | undefined,
  count: number,
): number[] {
  const equal = Array.from({ length: count }, () => 100 / count);

  if (
    !sizes ||
    sizes.length !== count ||
    sizes.some((size) => !Number.isFinite(size) || size < 0)
  ) {
    return equal;
  }

  const total = sizes.reduce((sum, size) => sum + size, 0);
  return total > 0 ? sizes.map((size) => (size / total) * 100) : equal;
}

/**
 * `sizes` (adding up to 100) within the limits of their panes: a pane below
 * its minimum or above its maximum is moved to it, and the others give or
 * take the difference - each as much as it has room for. A collapsed pane
 * that may collapse stays collapsed. Sizes within their limits come back as
 * they are; limits that cannot all hold are kept as far as they go.
 */
export function fitSizes(sizes: number[], limits: PaneLimits): number[] {
  const collapsed = sizes.map(
    (size, pane) => limits.collapsible[pane] && size <= EPSILON,
  );
  const low = (pane: number) => (collapsed[pane] ? 0 : limits.min[pane]);
  const high = (pane: number) =>
    collapsed[pane] ? 0 : Math.max(limits.max[pane], low(pane));

  if (
    sizes.every(
      (size, pane) =>
        size >= low(pane) - EPSILON && size <= high(pane) + EPSILON,
    )
  ) {
    return sizes;
  }

  const clamped = sizes.map((size, pane) => clamp(size, low(pane), high(pane)));
  const rest = 100 - clamped.reduce((sum, size) => sum + size, 0);
  // What each pane can give (rest < 0) or take (rest > 0)
  const room = clamped.map((size, pane) =>
    rest > 0 ? high(pane) - size : size - low(pane),
  );
  const total = room.reduce((sum, size) => sum + size, 0);
  const share = total > 0 ? Math.min(1, Math.abs(rest) / total) : 0;

  return normalizeSizes(
    clamped.map((size, pane) => size + Math.sign(rest) * room[pane] * share),
    sizes.length,
  );
}

export const sameSizes = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length &&
  a.every((size, index) => Math.abs(size - b[index]) < EPSILON);

export interface PairRange {
  /** Whether the primary pane can collapse - its neighbor taking it all. */
  canCollapsePrimary: boolean;
  /** Whether the secondary pane can collapse - the primary taking it all. */
  canCollapseSecondary: boolean;
  /** The largest size of the primary pane, both panes within their limits. */
  max: number;
  /** The smallest size of the primary pane, both panes within their limits. */
  min: number;
  /** The space of the two panes together. */
  total: number;
}

/** How far the handle `handle` can move - as sizes of its primary pane. */
export function getPairRange(
  sizes: readonly number[],
  handle: number,
  limits: PaneLimits,
): PairRange {
  const primary = handle;
  const secondary = handle + 1;
  const total = sizes[primary] + sizes[secondary];

  const max = Math.min(limits.max[primary], total - limits.min[secondary]);
  // Limits that cannot all hold leave a single position
  const min = Math.min(
    Math.max(limits.min[primary], total - limits.max[secondary]),
    max,
  );

  return {
    canCollapsePrimary:
      limits.collapsible[primary] && total <= limits.max[secondary] + EPSILON,
    canCollapseSecondary:
      limits.collapsible[secondary] && total <= limits.max[primary] + EPSILON,
    max: Math.max(max, 0),
    min: Math.max(min, 0),
    total,
  };
}

/** `sizes` with the primary pane of `handle` at `size` - its neighbor taking the rest. */
export function withPrimarySize(
  sizes: readonly number[],
  handle: number,
  size: number,
): number[] {
  const next = [...sizes];
  const total = sizes[handle] + sizes[handle + 1];
  next[handle] = size;
  next[handle + 1] = total - size;
  return next;
}

/**
 * The sizes with the primary pane of `handle` dragged to `size`: within the
 * limits of both panes - or collapsed, when a collapsible pane is dragged
 * below half its minimum size.
 */
export function resizeTo(
  sizes: readonly number[],
  handle: number,
  size: number,
  limits: PaneLimits,
): number[] {
  const range = getPairRange(sizes, handle, limits);
  const secondaryMin = limits.min[handle + 1];

  const primary =
    range.canCollapsePrimary && size < limits.min[handle] / 2
      ? 0
      : range.canCollapseSecondary && range.total - size < secondaryMin / 2
        ? range.total
        : clamp(size, range.min, range.max);

  return withPrimarySize(sizes, handle, primary);
}

/**
 * The sizes after a key moved the handle `handle` by `delta`: it stops at
 * the minimum and maximum, and from there a collapsible pane collapses; a
 * collapsed pane comes back at its minimum.
 */
export function stepSize(
  sizes: readonly number[],
  handle: number,
  delta: number,
  limits: PaneLimits,
): number[] {
  const range = getPairRange(sizes, handle, limits);
  const primary = sizes[handle];
  let next: number;

  if (delta < 0) {
    // From a collapsed secondary pane - back to its minimum
    if (primary > range.max + EPSILON) next = range.max;
    else if (primary > range.min + EPSILON) {
      next = Math.max(primary + delta, range.min);
    } else next = range.canCollapsePrimary ? 0 : range.min;
  } else {
    // From a collapsed primary pane - back to its minimum
    if (primary < range.min - EPSILON) next = range.min;
    else if (primary < range.max - EPSILON) {
      next = Math.min(primary + delta, range.max);
    } else next = range.canCollapseSecondary ? range.total : range.max;
  }

  return withPrimarySize(sizes, handle, next);
}

/**
 * The sizes with the panes of `handle` in the ratio of their default sizes -
 * the other panes stay as they are.
 */
export function resetPair(
  sizes: readonly number[],
  handle: number,
  defaults: readonly number[],
  limits: PaneLimits,
): number[] {
  const range = getPairRange(sizes, handle, limits);
  const pair = defaults[handle] + defaults[handle + 1];
  const ratio = pair > 0 ? defaults[handle] / pair : 0.5;

  return withPrimarySize(
    sizes,
    handle,
    clamp(range.total * ratio, range.min, range.max),
  );
}
