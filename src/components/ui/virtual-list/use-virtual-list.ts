import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

// Height (px) of an item until items are measured
const DEFAULT_ESTIMATE = 48;

/** How `scrollToIndex` places the item in the view. */
export type VirtualListAlign = "auto" | "start" | "center" | "end";

export interface VirtualListScrollOptions {
  /**
   * `start`, `center` or `end` of the view - `auto` scrolls only as far as
   * needed to show the item, not at all when it is in view.
   * @default "auto"
   */
  align?: VirtualListAlign;
  /**
   * `smooth` scrolls in an animation - the place is worked out from the
   * heights known when it starts, and the view is not held on its items
   * while it runs. Otherwise the view jumps there at once, also in a page
   * with `scroll-behavior: smooth`.
   * @default "auto"
   */
  behavior?: ScrollBehavior;
}

export interface UseVirtualListOptions {
  /** Number of items of the list. */
  count: number;
  /**
   * Height (px) of an item that has not been rendered yet - or a function
   * of its index. Rendered items are measured; with a number, the items
   * not measured yet are taken to be as high as the measured ones are on
   * average.
   * @default 48
   */
  estimateSize?: number | ((index: number) => number);
  /**
   * Stable key of the item at `index` - its measured height, the focus in
   * it and the scroll position stay with the item when items are added
   * before it (items sorted anew keep the scroll position). The index by
   * default.
   */
  getItemKey?: (index: number) => React.Key;
  /**
   * Items rendered before the list is measured - also by the server.
   * @default 20
   */
  initialCount?: number;
  /**
   * Items rendered above and below the view, so that scrolling and Tab
   * find them ready.
   * @default 4
   */
  overscan?: number;
  /**
   * How close (px) the view must come to the start or the end of the list
   * for `nearStart` / `nearEnd`.
   * @default 200
   */
  threshold?: number;
  /**
   * The page scrolls the list, not an element of its own - `scrollRef` is
   * not used then.
   */
  useWindowScroll?: boolean;
}

/** An item to render. */
export interface VirtualItem {
  /** Index of the item. */
  index: number;
  /** Key of the item - `getItemKey`, or the index. */
  key: React.Key;
  /** Height of the item - measured, or estimated. */
  size: number;
  /** Where the item starts, in px from the start of the list. */
  start: number;
  /**
   * Put it on the item element - it places an item rendered out of the
   * range (the one with the focus) where it belongs. `undefined` for the
   * others, which are laid out one after another.
   */
  style?: React.CSSProperties;
}

export interface UseVirtualListResult {
  /**
   * Put on the element around the items, inside the scroll container (or
   * the page) - it gets `listStyle`. A focus in an item keeps the item
   * rendered while it is scrolled away.
   */
  listRef: (element: HTMLElement | null) => void | (() => void);
  /**
   * Spread on the element of `listRef` - its padding holds the room of the
   * items left out above and below, so do not pad it otherwise.
   */
  listStyle: React.CSSProperties;
  /**
   * Put on each rendered item, which needs `data-index={index}` - it is
   * measured while it is in the page.
   */
  measureRef: (element: HTMLElement | null) => void | (() => void);
  /** The view is within `threshold` of the end of the list. */
  nearEnd: boolean;
  /** The view is within `threshold` of the start of the list. */
  nearStart: boolean;
  /**
   * Put on the scroll container (with `overflow-y: auto` and a height) -
   * best positioned (`relative`), with the element of `listRef` inside.
   */
  scrollRef: (element: HTMLElement | null) => void | (() => void);
  /** Scrolls the item at `index` into view - rendered or not. */
  scrollToIndex: (index: number, options?: VirtualListScrollOptions) => void;
  /** Height of all the items - measured and estimated. */
  totalSize: number;
  /** The items to render, in their order. */
  virtualItems: VirtualItem[];
}

/** Where each item starts, and the items by their key. */
interface Layout {
  indexOf: ReadonlyMap<React.Key, number>;
  keys: React.Key[];
  /** Where each item starts - and, last, where they end. */
  offsets: Float64Array;
}

/** The part of the list in view - in px from its start. */
interface View {
  height: number;
  top: number;
}

/**
 * What the observer of the items of each list does with their sizes - set
 * by its hook once it is in the page.
 */
const measureHandlers = new WeakMap<
  ResizeObserver,
  (entries: ResizeObserverEntry[]) => void
>();

/** Whether two lists have the same items in the same order. */
function isSameList(a: readonly unknown[], b: readonly unknown[]) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

/**
 * Whether the items of `previous` that `layout` still has come in the same
 * order there - items were added or removed, not sorted.
 */
function keepsOrder(previous: Layout, layout: Layout) {
  if (previous.keys === layout.keys) return true;
  let last = -1;
  for (const key of previous.keys) {
    const index = layout.indexOf.get(key);
    if (index === undefined) continue;
    if (index < last) return false;
    last = index;
  }
  return true;
}

/** The first index whose item ends past `position` (binary search). */
function findIndex(offsets: Float64Array, position: number) {
  let low = 0;
  let high = Math.max(offsets.length - 2, 0);

  while (low < high) {
    const middle = (low + high) >> 1;
    if (offsets[middle + 1] <= position) low = middle + 1;
    else high = middle;
  }

  return low;
}

/**
 * How far the list starts below the top of the content of the scroll
 * container - by the offsets up to it, else by where they are drawn.
 */
function listTopIn(scroller: HTMLElement, list: HTMLElement) {
  let top = 0;
  let element: HTMLElement = list;

  while (element !== scroller) {
    top += element.offsetTop;
    const parent = element.offsetParent;
    // None without a layout (hidden, or jsdom) - nothing to work out
    if (!parent) return top;
    if (!(parent instanceof HTMLElement) || !scroller.contains(parent)) {
      // The container is not positioned - the offsets pass it by
      return (
        list.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        scroller.clientTop +
        scroller.scrollTop
      );
    }
    element = parent;
  }

  return top;
}

/** The scroll container scrolls, and is scrolled as far as it goes. */
const isAtEnd = (scroller: HTMLElement) =>
  scroller.clientHeight > 0 &&
  scroller.scrollHeight > scroller.clientHeight &&
  scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;

/** Whether the page scrolls, and is scrolled as far as it goes. */
const isWindowAtEnd = () => {
  const { scrollHeight } = document.documentElement;
  return (
    scrollHeight > window.innerHeight &&
    window.innerHeight + window.scrollY >= scrollHeight - 1
  );
};

/**
 * Where to scroll for the item at `index` to be placed by `align` - `null`
 * when it is in view already (`auto`).
 */
function scrollTarget(
  offsets: Float64Array,
  index: number,
  align: VirtualListAlign,
  view: View,
) {
  const start = offsets[index];
  const end = offsets[index + 1];

  switch (align) {
    case "start":
      return start;
    case "end":
      return end - view.height;
    case "center":
      return start - (view.height - (end - start)) / 2;
    default:
      if (start < view.top) return start;
      if (end > view.top + view.height) {
        // An item taller than the view shows its start
        return end - start > view.height ? start : end - view.height;
      }
      return null;
  }
}

/**
 * Virtualization of a list of items of any height: which items to render
 * for the part of the list in view (and `overscan` items above and below),
 * and the room of the others. Rendered items are measured; the others are
 * estimated. When the items above the view change their height - measured
 * at last, or added before it (older messages of a chat) - the view stays
 * on the item it showed; items sorted anew keep the scroll position. Works
 * in a scroll container of its own or in the scrolling page
 * (`useWindowScroll`), and renders the first items on the server.
 */
export default function useVirtualList({
  count,
  estimateSize = DEFAULT_ESTIMATE,
  getItemKey,
  initialCount = 20,
  overscan = 4,
  threshold = 200,
  useWindowScroll = false,
}: UseVirtualListOptions): UseVirtualListResult {
  const [heights, setHeights] = useState<ReadonlyMap<React.Key, number>>(
    () => new Map(),
  );
  const [range, setRange] = useState(() => ({
    end: Math.max(0, initialCount),
    start: 0,
  }));
  // Whether the view is near the start and the end - of the layout they were
  // worked out by. A new layout (items added, the view yet to be held on its
  // item) is near neither until they are worked out again, right after
  const [edges, setEdges] = useState<{
    layout: Layout | null;
    nearEnd: boolean;
    nearStart: boolean;
  }>({ layout: null, nearEnd: false, nearStart: false });
  // The item with the focus - rendered also while it is scrolled away
  const [focusedKey, setFocusedKey] = useState<React.Key | null>(null);

  const scrollerRef = useRef<HTMLElement | null>(null);
  const listElementRef = useRef<HTMLElement | null>(null);

  const currentKeys = useMemo(
    () =>
      Array.from({ length: count }, (_, index) =>
        getItemKey ? getItemKey(index) : index,
      ),
    [count, getItemKey],
  );

  // The keys by value - a new `getItemKey` of each render (an inline
  // function) gives the same keys, which must not lay the list out anew
  const [keys, setKeys] = useState(currentKeys);
  if (keys !== currentKeys && !isSameList(keys, currentKeys)) {
    setKeys(currentKeys);
    // Only the heights of the items there are - those of items gone must
    // neither pile up nor weigh in the estimate
    if (heights.size > 0) {
      const present = new Set(currentKeys);
      const kept = new Map([...heights].filter(([key]) => present.has(key)));
      if (kept.size !== heights.size) setHeights(kept);
    }
  }
  const total = keys.length;

  const layout = useMemo((): Layout => {
    const estimate =
      typeof estimateSize === "function" ? null : Math.max(0, estimateSize);
    let average = estimate ?? DEFAULT_ESTIMATE;
    if (estimate !== null && heights.size > 0) {
      let total = 0;
      for (const height of heights.values()) total += height;
      average = total / heights.size;
    }

    const offsets = new Float64Array(keys.length + 1);
    const indexOf = new Map<React.Key, number>();
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      indexOf.set(key, index);
      const size =
        heights.get(key) ??
        (typeof estimateSize === "function"
          ? Math.max(0, estimateSize(index) || 0)
          : average);
      offsets[index + 1] = offsets[index] + size;
    }

    return { indexOf, keys, offsets };
  }, [estimateSize, heights, keys]);

  // The latest values for the listeners, which run between renders
  const latest = useRef({ layout, overscan, threshold, useWindowScroll });
  useLayoutEffect(() => {
    latest.current = { layout, overscan, threshold, useWindowScroll };
  });

  // One observer for the rendered items, where there is one (not on the
  // server, nor in jsdom) - it hands what it sees to the hook
  const [observer] = useState(() =>
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries, self) =>
          measureHandlers.get(self)?.(entries),
        ),
  );

  useLayoutEffect(() => {
    if (!observer) return;
    measureHandlers.set(observer, (entries) => {
      const { keys } = latest.current.layout;
      const measured: [React.Key, number][] = [];
      for (const { target } of entries) {
        const key = keys[Number((target as HTMLElement).dataset.index)];
        // An item on its way out of the page, or hidden, measures 0
        if (key === undefined || !target.isConnected) continue;
        const height = target.getBoundingClientRect().height;
        if (height > 0) measured.push([key, height]);
      }
      if (measured.length === 0) return;

      setHeights((previous) => {
        if (measured.every(([key, height]) => previous.get(key) === height)) {
          return previous;
        }
        const next = new Map(previous);
        for (const [key, height] of measured) next.set(key, height);
        return next;
      });
    });
    return () => {
      observer.disconnect();
      measureHandlers.delete(observer);
    };
  }, [observer]);

  /** The part of the list in view - `null` before it is in the page. */
  const readView = useCallback((): View | null => {
    const list = listElementRef.current;
    if (!list) return null;

    if (latest.current.useWindowScroll) {
      return {
        height: window.innerHeight || document.documentElement.clientHeight,
        top: -list.getBoundingClientRect().top,
      };
    }

    const scroller = scrollerRef.current;
    if (!scroller) return null;
    return {
      height: scroller.clientHeight,
      top: scroller.scrollTop - listTopIn(scroller, list),
    };
  }, []);

  /** How far the view is scrolled, and how far it can be - in px. */
  const readScroll = useCallback(() => {
    if (latest.current.useWindowScroll) {
      return {
        max: document.documentElement.scrollHeight - window.innerHeight,
        position: window.scrollY,
      };
    }
    const scroller = scrollerRef.current;
    return scroller
      ? {
          max: scroller.scrollHeight - scroller.clientHeight,
          position: scroller.scrollTop,
        }
      : null;
  }, []);

  // Where the view was last scrolled to here - a scroll to elsewhere is the
  // user's own
  const scrolledToRef = useRef<number | null>(null);
  // Where a smooth scroll goes - while it is on its way, the view is not held
  // on its items: scrolling it there would stop the animation
  const smoothToRef = useRef<number | null>(null);

  /**
   * Scrolls the view to `position` in the list - at once unless `smooth`,
   * also in a page that scrolls smoothly (`scroll-behavior`), as the items
   * there are worked out right after.
   */
  const scrollViewTo = useCallback(
    (position: number, behavior: ScrollBehavior = "instant") => {
      const list = listElementRef.current;
      if (!list) return;
      let smooth = behavior === "smooth";
      let top: number;

      if (latest.current.useWindowScroll) {
        top = Math.max(
          0,
          window.scrollY + list.getBoundingClientRect().top + position,
        );
        window.scrollTo({ behavior: smooth ? "smooth" : "instant", top });
      } else {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        top = Math.max(0, listTopIn(scroller, list) + position);
        if (typeof scroller.scrollTo === "function") {
          scroller.scrollTo({ behavior: smooth ? "smooth" : "instant", top });
        } else {
          scroller.scrollTop = top;
          smooth = false;
        }
      }

      const scroll = readScroll();
      if (!scroll) return;
      if (smooth) {
        // On its way until it gets there - or as far as it can
        const to = Math.min(top, Math.max(0, scroll.max));
        smoothToRef.current = Math.abs(to - scroll.position) > 1 ? to : null;
        scrolledToRef.current = null;
      } else {
        smoothToRef.current = null;
        scrolledToRef.current = scroll.position;
      }
    },
    [readScroll],
  );

  // Where the view was when the items in view were last worked out, and
  // whether it was at the end of the content
  const seenRef = useRef<{ atEnd: boolean; top: number } | null>(null);

  // The items in view, with `overscan` items above and below
  const update = useCallback(() => {
    const view = readView();
    if (!view) return;
    const { layout, overscan, threshold, useWindowScroll } = latest.current;
    const { offsets } = layout;
    const total = offsets.length - 1;
    const scroller = scrollerRef.current;

    seenRef.current = {
      atEnd: useWindowScroll
        ? isWindowAtEnd()
        : !!scroller && scroller.scrollTop > 0 && isAtEnd(scroller),
      top: view.top,
    };

    // Not laid out (yet) - as many items as before a measurement
    const height = view.height || offsets[Math.min(total, 20)] || 0;
    const bottom = view.top + height;
    const start =
      total === 0
        ? 0
        : Math.max(0, findIndex(offsets, Math.max(0, view.top)) - overscan);
    // The last item in view - not the one starting where the view ends
    const end =
      total === 0
        ? 0
        : Math.min(
            total,
            findIndex(offsets, Math.max(0, bottom - 1)) + 1 + overscan,
          );

    setRange((previous) =>
      previous.start === start && previous.end === end
        ? previous
        : { end, start },
    );

    const nearStart = view.top <= threshold;
    const nearEnd = bottom >= offsets[total] - threshold;
    setEdges((previous) =>
      previous.layout === layout &&
      previous.nearStart === nearStart &&
      previous.nearEnd === nearEnd
        ? previous
        : { layout, nearEnd, nearStart },
    );
  }, [readView]);

  // A `scrollToIndex` whose item is placed again as the heights of the
  // items it passed are measured - until the user scrolls
  const pendingRef = useRef<{
    align: VirtualListAlign;
    attempts: number;
    key: React.Key;
  } | null>(null);

  const scrollToIndex = useCallback(
    (index: number, options: VirtualListScrollOptions = {}) => {
      const { align = "auto", behavior = "auto" } = options;
      const { layout } = latest.current;
      const total = layout.offsets.length - 1;
      const view = readView();
      if (total === 0 || !view || !Number.isFinite(index)) return;

      const target = Math.min(Math.max(Math.trunc(index), 0), total - 1);
      const position = scrollTarget(layout.offsets, target, align, view);
      pendingRef.current =
        behavior === "smooth" || position === null
          ? null
          : { align, attempts: 10, key: layout.keys[target] };
      if (position === null) return;

      scrollViewTo(position, behavior);
      // The items there are rendered at once - the scroll event comes later
      update();
    },
    [readView, scrollViewTo, update],
  );

  // The layout the items were last rendered by
  const committedRef = useRef<Layout | null>(null);

  // Items above the view that take another room than they did - measured,
  // or added - must not move the items in view: the item at the top of the
  // view stays where it is. A `scrollToIndex` places its item again. Not
  // while a smooth scroll is on its way, which scrolling would stop.
  useLayoutEffect(() => {
    const previous = committedRef.current;
    committedRef.current = layout;

    const view = readView();
    if (
      previous &&
      previous !== layout &&
      view &&
      smoothToRef.current === null
    ) {
      const pending = pendingRef.current;
      const pendingIndex = pending
        ? layout.indexOf.get(pending.key)
        : undefined;

      if (pending) {
        pending.attempts -= 1;
        if (pending.attempts <= 0 || pendingIndex === undefined) {
          pendingRef.current = null;
        }
      }

      if (pending && pendingIndex !== undefined) {
        const position = scrollTarget(
          layout.offsets,
          pendingIndex,
          pending.align,
          view,
        );
        if (position !== null && Math.abs(position - view.top) >= 0.5) {
          scrollViewTo(position);
        }
      } else {
        const { useWindowScroll } = latest.current;
        const scroller = scrollerRef.current;
        const atEnd = useWindowScroll
          ? isWindowAtEnd()
          : !!scroller && isAtEnd(scroller);
        const seen = seenRef.current;
        // Items that shrank may have cut the content short of the view -
        // the browser has taken it back to the new end then. A view at the
        // end stays there; another one was where it was last seen.
        const top = atEnd && seen && seen.top > view.top ? seen.top : view.top;

        if (
          !(atEnd && seen?.atEnd) &&
          top >= 0 &&
          // Sorted, the item at the top went elsewhere - the view stays
          // scrolled as it was
          keepsOrder(previous, layout)
        ) {
          const { offsets, keys } = previous;
          const total = offsets.length - 1;
          if (total > 0 && top < offsets[total]) {
            const index = findIndex(offsets, top);
            const newIndex = layout.indexOf.get(keys[index]);
            if (newIndex !== undefined) {
              const shift =
                layout.offsets[newIndex] + (top - offsets[index]) - view.top;
              if (Math.abs(shift) >= 0.5) scrollViewTo(view.top + shift);
            }
          }
        }
      }
    }

    update();
  }, [layout, readView, scrollViewTo, update]);

  /**
   * The user scrolls - a `scrollToIndex` does not hold its item any more,
   * nor is a smooth one on its way.
   */
  const releasePending = useCallback(() => {
    pendingRef.current = null;
    smoothToRef.current = null;
  }, []);

  /** A scroll came to its end - a smooth one too. */
  const endSmoothScroll = useCallback(() => {
    smoothToRef.current = null;
  }, []);

  /**
   * The view scrolled. Not to where it was scrolled here, it is the user's
   * scroll - by the scroll bar too: a `scrollToIndex` does not hold its item
   * any more. A smooth scroll is over once it gets where it goes, or as far
   * as it can.
   */
  const handleScroll = useCallback(() => {
    const scroll = readScroll();
    const smoothTo = smoothToRef.current;
    if (scroll && smoothTo !== null) {
      if (
        Math.abs(scroll.position - smoothTo) <= 1 ||
        (smoothTo > scroll.position && scroll.position >= scroll.max - 1)
      ) {
        smoothToRef.current = null;
      }
    } else if (
      !scroll ||
      scrolledToRef.current === null ||
      Math.abs(scroll.position - scrolledToRef.current) > 1
    ) {
      pendingRef.current = null;
    }
    update();
  }, [readScroll, update]);

  const scrollRef = useCallback(
    (element: HTMLElement | null) => {
      scrollerRef.current = element;
      if (!element) return;

      element.addEventListener("scroll", handleScroll, { passive: true });
      element.addEventListener("scrollend", endSmoothScroll);
      element.addEventListener("wheel", releasePending, { passive: true });
      element.addEventListener("touchstart", releasePending, {
        passive: true,
      });
      element.addEventListener("keydown", releasePending);
      // A press on the scroll bar too
      element.addEventListener("pointerdown", releasePending);
      // A taller view shows more items
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(update);
      resizeObserver?.observe(element);
      update();

      return () => {
        element.removeEventListener("scroll", handleScroll);
        element.removeEventListener("scrollend", endSmoothScroll);
        element.removeEventListener("wheel", releasePending);
        element.removeEventListener("touchstart", releasePending);
        element.removeEventListener("keydown", releasePending);
        element.removeEventListener("pointerdown", releasePending);
        resizeObserver?.disconnect();
        if (scrollerRef.current === element) scrollerRef.current = null;
      };
    },
    [endSmoothScroll, handleScroll, releasePending, update],
  );

  const listRef = useCallback(
    (element: HTMLElement | null) => {
      listElementRef.current = element;
      if (!element) return;

      const onFocusIn = (event: FocusEvent) => {
        const item = (event.target as Element).closest?.("[data-index]");
        if (!item || !element.contains(item)) return;
        const key =
          latest.current.layout.keys[
            Number((item as HTMLElement).dataset.index)
          ];
        setFocusedKey(key ?? null);
      };
      const onFocusOut = (event: FocusEvent) => {
        if (!element.contains(event.relatedTarget as Node | null)) {
          setFocusedKey(null);
        }
      };
      element.addEventListener("focusin", onFocusIn);
      element.addEventListener("focusout", onFocusOut);

      const windowScroll = useWindowScroll;
      if (windowScroll) {
        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("scrollend", endSmoothScroll);
        window.addEventListener("resize", update);
        window.addEventListener("wheel", releasePending, { passive: true });
        window.addEventListener("touchstart", releasePending, {
          passive: true,
        });
      }
      update();

      return () => {
        element.removeEventListener("focusin", onFocusIn);
        element.removeEventListener("focusout", onFocusOut);
        if (windowScroll) {
          window.removeEventListener("scroll", handleScroll);
          window.removeEventListener("scrollend", endSmoothScroll);
          window.removeEventListener("resize", update);
          window.removeEventListener("wheel", releasePending);
          window.removeEventListener("touchstart", releasePending);
        }
        if (listElementRef.current === element) {
          listElementRef.current = null;
        }
      };
    },
    [endSmoothScroll, handleScroll, releasePending, update, useWindowScroll],
  );

  const measureRef = useCallback(
    (element: HTMLElement | null) => {
      if (!element || !observer) return;
      observer.observe(element);
      return () => observer.unobserve(element);
    },
    [observer],
  );

  const { offsets } = layout;
  // Worked out for these items - see `edges`
  const edgesKnown = edges.layout === layout;
  const end = Math.min(range.end, total);
  const start = Math.min(range.start, end);
  const focusedIndex =
    focusedKey === null ? undefined : layout.indexOf.get(focusedKey);
  const virtualItems: VirtualItem[] = [];
  const keptItem = (index: number): VirtualItem => ({
    index,
    key: keys[index],
    size: offsets[index + 1] - offsets[index],
    start: offsets[index],
    // Out of the flow of the others - where it would be among them
    style: {
      insetInline: 0,
      position: "absolute",
      top: offsets[index],
    },
  });

  if (focusedIndex !== undefined && focusedIndex < start) {
    virtualItems.push(keptItem(focusedIndex));
  }
  for (let index = start; index < end; index++) {
    virtualItems.push({
      index,
      key: keys[index],
      size: offsets[index + 1] - offsets[index],
      start: offsets[index],
    });
  }
  if (focusedIndex !== undefined && focusedIndex >= end) {
    virtualItems.push(keptItem(focusedIndex));
  }

  return {
    listRef,
    listStyle: {
      // Items the browser would anchor the scroll to come and go - the
      // view is held on its item here
      overflowAnchor: "none",
      paddingBottom: offsets[total] - offsets[end],
      paddingTop: offsets[start],
      position: "relative",
    },
    measureRef,
    nearEnd: edgesKnown && edges.nearEnd,
    nearStart: edgesKnown && edges.nearStart,
    scrollRef,
    scrollToIndex,
    totalSize: offsets[total],
    virtualItems,
  };
}
