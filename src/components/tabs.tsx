import { X } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { attachRef } from "../hooks/use-form-control";
import cn from "../utils/cn";
import Skeleton from "./skeleton";
import { createLinkMatcher } from "../providers/active-path";
import { useMessages, useRouter } from "../providers/ui-context";

/** A tab that navigates to a page. */
export interface LinkTabItem {
  /**
   * Shows the tab dimmed - it does not navigate and is left out of the tab
   * order.
   */
  disabled?: boolean;
  /**
   * URL of the page - also a relative one: a path (`settings`) is resolved
   * against the current page as the browser resolves it, a query
   * (`?tab=archived`) needs `includeQueryParams` to mark the tab.
   */
  href: string;
  /** Shown before the label, e.g. a lucide-react icon. */
  icon?: React.ReactNode;
  /** Content of the tab. */
  label: React.ReactNode;
}

/**
 * A tab that switches local state - with `content` it shows its tab panel,
 * otherwise use `value` and `onChange` to show what it stands for.
 */
export interface ValueTabItem {
  /**
   * The tab panel of the tab - rendered under the bar (beside a vertical
   * one) while the tab is selected, named by the tab. See `keepMounted`.
   */
  content?: React.ReactNode;
  /** Shows the tab dimmed - it cannot be selected, the arrow keys skip it. */
  disabled?: boolean;
  /** Shown before the label, e.g. a lucide-react icon. */
  icon?: React.ReactNode;
  /**
   * Id of the tab - point `aria-labelledby` of its tab panel at it. A
   * generated one for a tab with `content`.
   */
  id?: string;
  /** Content of the tab. */
  label: React.ReactNode;
  /**
   * Makes the tab closable: a × after the label, and the Delete key on the
   * focused tab, call this - remove the tab from `items` then. Closing the
   * selected tab selects the next one (the previous one after the last),
   * which takes the focus.
   */
  onClose?: () => void;
  /**
   * Id of the tab panel the tab shows - becomes its `aria-controls`. A
   * generated one for a tab with `content`.
   */
  panelId?: string;
  /** Passed to `onChange` - the tab is selected while it equals `value`. */
  value: string;
}

export type TabItem = LinkTabItem | ValueTabItem;

export interface TabsProps extends Omit<
  React.ComponentProps<"ul">,
  "defaultValue" | "onChange"
> {
  /**
   * Value tabs only: the tab selected at first in an uncontrolled bar - one
   * without `value`, which then selects the tabs itself. Tabs with
   * `content` select the first enabled one without it.
   */
  defaultValue?: string;
  /**
   * Link tabs only: compare the query string too, so `?tab=a` and `?tab=b`
   * are different tabs of one page. Of the tabs of the current page, the one
   * whose parameters all match the URL is active - the one with the most of
   * them, so `/orders?tab=archived` wins over `/orders` there. The first tab
   * is active while none of the tab parameters is in the URL.
   */
  includeQueryParams?: boolean;
  /** The tabs - links (`href`) or buttons (`value`), not mixed. */
  items: TabItem[];
  /**
   * Keeps the tab panels (`content`) of the tabs not selected in the page,
   * hidden - their state (a form, a scroll position) stays. By default only
   * the panel of the selected tab is rendered.
   */
  keepMounted?: boolean;
  /** Shows placeholder tabs. */
  loading?: boolean;
  /** Number of placeholder tabs while `loading`. */
  loadingTabsCount?: number;
  /** Value tabs only: called with the `value` of the clicked tab. */
  onChange?: (value: string) => void;
  /**
   * `vertical` stacks the tabs in a column, e.g. beside the sections of a
   * settings page - value tabs are then switched with the up and down
   * arrows. A horizontal bar too wide for its container scrolls sideways.
   */
  orientation?: "horizontal" | "vertical";
  /** Classes of each tab panel (`content`) - `pt-4` under a horizontal bar. */
  panelClassName?: string;
  /** Padding and text size of the tabs. */
  size?: "sm" | "md" | "lg";
  /**
   * Value tabs only: the selected tab of a controlled bar - use with
   * `onChange`. Leave out for one that selects its tabs itself (see
   * `defaultValue`).
   */
  value?: string;
}

type Orientation = NonNullable<TabsProps["orientation"]>;

interface IndicatorBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

/**
 * Whether the scrolled bar hides tabs before / after what it shows - the
 * start is on the right in a right-to-left page.
 */
interface Overflow {
  end: boolean;
  rtl: boolean;
  start: boolean;
}

const NO_OVERFLOW: Overflow = { end: false, rtl: false, start: false };

// Width of the fade at an edge with more tabs behind it - the active tab is
// kept at least this far from the edge
const FADE_WIDTH = 24;

const isLinkTab = (item: TabItem): item is LinkTabItem => "href" in item;

/** Whether a node renders anything - `false` and `null` are no content. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && typeof node !== "boolean";

/** Whether a value tab shows a tab panel of its own. */
const hasPanel = (item: TabItem): item is ValueTabItem =>
  !isLinkTab(item) && hasContent(item.content);

/**
 * The tab that takes the place of the closed one at `index` - the next
 * enabled value tab, or the previous one after the last.
 */
function getNeighborValue(items: TabItem[], index: number) {
  const isCandidate = (item: TabItem | undefined) =>
    !!item && !isLinkTab(item) && !item.disabled;
  const next = items.slice(index + 1).find(isCandidate);
  const previous = items.slice(0, index).findLast(isCandidate);
  const neighbor = (next ?? previous) as ValueTabItem | undefined;
  return neighbor?.value ?? null;
}

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

/**
 * The active one of link tabs that differ by their query: of the tabs of the
 * current page, the one whose parameters all match the URL, preferring the
 * one with the most - and the first while the URL has none of the
 * parameters of the tabs.
 */
function getQueryTabIndex(items: TabItem[], pathname: string, search: string) {
  const match = createLinkMatcher(pathname, search);

  const pageTabs = items.flatMap((item, index) => {
    if (!isLinkTab(item)) return [];

    // A link of just a query (`?tab=archived`) is one of the current page
    const href = item.href.split(/[?#]/)[0]
      ? item.href
      : `${pathname}${item.href}`;
    const result = match(href);
    return result?.exact ? [{ index, result }] : [];
  });

  if (pageTabs.length === 0) return -1;

  const current = new URLSearchParams(search);
  const hasTabParams = pageTabs.some(({ result }) =>
    result.params.some(([key]) => current.has(key)),
  );
  if (!hasTabParams) return pageTabs[0].index;

  let activeIndex = -1;
  let matchedCount = -1;

  for (const { index, result } of pageTabs) {
    if (result.query > matchedCount) {
      activeIndex = index;
      matchedCount = result.query;
    }
  }

  return activeIndex;
}

// The arrow keys that move to the previous (-1) and the next (1) tab - Left
// is the next one in a right-to-left page
const MOVE_KEYS: Record<Orientation | "rtl", Record<string, number>> = {
  horizontal: { ArrowLeft: -1, ArrowRight: 1 },
  rtl: { ArrowLeft: 1, ArrowRight: -1 },
  vertical: { ArrowDown: 1, ArrowUp: -1 },
};

/**
 * The tab a key moves to from `index` - the next enabled one in the
 * direction of the arrow (`keys` of `MOVE_KEYS`), around the ends, or the
 * first / last enabled one for Home / End. `null` for other keys.
 */
function getKeyTarget(
  items: TabItem[],
  index: number,
  key: string,
  keys: Record<string, number>,
) {
  const enabled = items.flatMap((item, itemIndex) =>
    item.disabled ? [] : [itemIndex],
  );
  if (enabled.length === 0) return null;
  if (key === "Home") return enabled[0];
  if (key === "End") return enabled[enabled.length - 1];

  const step = keys[key];
  if (!step) return null;

  const count = items.length;
  for (let offset = 1; offset <= count; offset++) {
    const candidate = (((index + step * offset) % count) + count) % count;
    if (!items[candidate].disabled) return candidate;
  }

  return null;
}

/** Where the indicator goes - over `tab`, in the coordinates of `list`. */
function measureIndicator(list: HTMLElement, tab: HTMLElement) {
  const listRect = list.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();

  // An absolute child is placed from the padding box - inside a border
  return {
    height: tabRect.height,
    left: tabRect.left - listRect.left - list.clientLeft,
    top: tabRect.top - listRect.top - list.clientTop,
    width: tabRect.width,
  };
}

const isSameBounds = (a: IndicatorBounds | null, b: IndicatorBounds) =>
  !!a &&
  a.height === b.height &&
  a.left === b.left &&
  a.top === b.top &&
  a.width === b.width;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scrolls the bar sideways so that `tab` is in view, clear of the fades -
 * only the bar, never the page.
 */
function scrollTabIntoView(
  scroller: HTMLElement,
  tab: HTMLElement,
  behavior: ScrollBehavior,
) {
  if (scroller.scrollWidth <= scroller.clientWidth) return;

  const scrollerRect = scroller.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const delta =
    tabRect.left < scrollerRect.left + FADE_WIDTH
      ? tabRect.left - scrollerRect.left - FADE_WIDTH
      : tabRect.right > scrollerRect.right - FADE_WIDTH
        ? tabRect.right - scrollerRect.right + FADE_WIDTH
        : 0;
  if (delta === 0) return;

  const left = scroller.scrollLeft + delta;

  if (typeof scroller.scrollTo === "function") {
    scroller.scrollTo({
      behavior: prefersReducedMotion() ? "instant" : behavior,
      left,
    });
  } else {
    scroller.scrollLeft = left;
  }
}

/** Whether the focus was moved by the keyboard, not by a click. */
function isKeyboardFocus(element: Element) {
  try {
    return element.matches(":focus-visible");
  } catch {
    // A browser (or jsdom) without the selector
    return false;
  }
}

/** Fades out the edges the bar hides more tabs behind. */
function getFadeMask({ end, rtl, start }: Overflow) {
  if (!start && !end) return undefined;

  return `linear-gradient(to ${rtl ? "left" : "right"}, ${start ? "transparent" : "#000"}, #000 ${FADE_WIDTH}px, #000 calc(100% - ${FADE_WIDTH}px), ${end ? "transparent" : "#000"})`;
}

// Predefined widths for skeleton tabs to ensure Tailwind classes exist
const skeletonWidths = ["w-16", "w-20", "w-24", "w-28", "w-32"];

// Size variants
const sizeVariants = {
  sm: {
    container: "gap-0.5",
    tab: "gap-1.5 px-3 py-1 text-[13.5px]",
    verticalTab: "gap-1.5 px-3 py-1 text-[13.5px]",
    skeleton: "px-3 py-2.5",
  },
  md: {
    container: "gap-1",
    tab: "gap-2 px-4 py-1.5 text-sm",
    verticalTab: "gap-2 px-3 py-1.5 text-sm",
    skeleton: "px-4 py-3",
  },
  lg: {
    container: "gap-1.5",
    tab: "gap-2 px-5 py-2 text-base",
    verticalTab: "gap-2.5 px-4 py-2 text-base",
    skeleton: "px-5 py-4",
  },
};

/**
 * A tab bar on a line, the active tab underlined by an animated indicator -
 * marked on the start side in a vertical one. Tabs are either links
 * (`href`, active by the current URL) or buttons (`value`), which show
 * their tab panel (`content`) or tell `onChange`; button tabs are one tab
 * stop, the arrow keys (and Home / End) select the next one, Delete closes
 * a closable one (`onClose`). Horizontal, or `vertical` in a column.
 *
 * The attributes and the `ref` go to the list of the tabs (the `<ul>`,
 * with `data-orientation`). The active tab has `data-selected` - a link
 * tab `data-current` too - a disabled one `data-disabled`.
 */
export default function Tabs({
  className,
  defaultValue,
  includeQueryParams = false,
  items,
  keepMounted = false,
  loading = false,
  loadingTabsCount = 3,
  onChange,
  orientation = "horizontal",
  panelClassName,
  ref,
  size = "md",
  value,
  ...props
}: TabsProps) {
  const { Link, pathname, search } = useRouter();
  const messages = useMessages();
  const baseId = useId();
  const isVertical = orientation === "vertical";
  const isLinkList = isLinkTab(items[0] ?? { href: "" });
  const hasPanels = !isLinkList && items.some(hasPanel);

  // Uncontrolled without `value` - the tabs with panels select the first
  // enabled one until another is picked, also once the picked one is gone
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const valueTabs = items.filter(
    (item): item is ValueTabItem => !isLinkTab(item),
  );
  const selectedValue = isControlled
    ? value
    : valueTabs.some((item) => item.value === internalValue)
      ? internalValue
      : hasPanels
        ? valueTabs.find((item) => !item.disabled)?.value
        : undefined;

  const select = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  };

  // The tab that takes the focus once the tab closed from the keyboard, or
  // with the focus in the bar, is gone
  const focusAfterCloseRef = useRef<string | null>(null);

  const sizeClasses = sizeVariants[size];

  // Track active tab index and position for animation
  const [activeTabBounds, setActiveTabBounds] =
    useState<IndicatorBounds | null>(null);
  const [overflow, setOverflow] = useState(NO_OVERFLOW);
  const tabsRef = useRef<HTMLUListElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // The list for the tabs themselves and for a `ref` passed to them - which
  // must not take it away from the arrow keys, the indicator and the fades
  const listRef = (element: HTMLUListElement | null) => {
    tabsRef.current = element;
    const detachRef = attachRef(ref, element);

    return () => {
      tabsRef.current = null;
      detachRef();
    };
  };
  // The tab the bar was last scrolled to - the first one it jumps to, later
  // ones it scrolls to smoothly. A re-render leaves a bar the user scrolled
  // alone.
  const scrolledToRef = useRef<number | null>(null);

  // Of several matching links the most specific wins - `/users/archive`
  // over `/users` on `/users/archive`: the length of the path of a link
  // tab, -1 for a tab that is not active
  const matchLink = createLinkMatcher(pathname);
  const tabMatches = items.map((item) =>
    isLinkTab(item)
      ? (matchLink(item.href)?.path ?? -1)
      : item.value === selectedValue
        ? 0
        : -1,
  );
  const activeIndex =
    includeQueryParams && items.some(isLinkTab)
      ? getQueryTabIndex(items, pathname, search)
      : tabMatches.reduce(
          (best, match, index) =>
            match > (tabMatches[best] ?? -1) ? index : best,
          -1,
        );

  useLayoutEffect(() => {
    const list = tabsRef.current;

    if (!list || loading || activeIndex === -1) {
      setActiveTabBounds(null);
      // The tabs that come next are scrolled to at once
      scrolledToRef.current = null;
      return;
    }

    // Skip the first child if it's the animated indicator
    const tabElements = Array.from(list.children).filter(
      (child) => child.tagName === "LI",
    ) as HTMLElement[];
    const activeTab = tabElements[activeIndex];

    if (!activeTab) {
      setActiveTabBounds(null);
      return;
    }

    const measure = () => {
      const bounds = measureIndicator(list, activeTab);
      setActiveTabBounds((prev) =>
        isSameBounds(prev, bounds) ? prev : bounds,
      );
    };

    measure();

    // On a phone the bar may be wider than the screen - the active tab
    // scrolled into view, also when the page opens on it
    const scroller = scrollerRef.current;
    if (isVertical) {
      scrolledToRef.current = null;
    } else if (scroller && scrolledToRef.current !== activeIndex) {
      scrollTabIntoView(
        scroller,
        activeTab,
        scrolledToRef.current === null ? "instant" : "smooth",
      );
      scrolledToRef.current = activeIndex;
    }

    // The tabs change size after the first measurement - a web font that
    // loads later, a label that changes, a container that narrows. A bar
    // that narrows (a phone turned) scrolls the active tab back into view.
    if (typeof ResizeObserver === "undefined") return;

    let width = scroller?.clientWidth;
    const observer = new ResizeObserver(() => {
      measure();
      if (!scroller || isVertical || scroller.clientWidth === width) return;
      width = scroller.clientWidth;
      scrollTabIntoView(scroller, activeTab, "instant");
    });
    observer.observe(list);
    tabElements.forEach((tab) => observer.observe(tab));
    if (scroller) observer.observe(scroller);
    return () => observer.disconnect();
  }, [activeIndex, isVertical, items, loading]);

  // A bar wider than its container fades out at the edges it hides tabs
  // behind - it scrolls there by touch, trackpad or its scrollbar
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const list = tabsRef.current;

    if (!scroller || !list || isVertical) {
      setOverflow(NO_OVERFLOW);
      return;
    }

    // Scrolled from the start - to the left in a right-to-left page, where
    // `scrollLeft` counts down from 0
    let rtl = isRtl(scroller);
    const update = () => {
      const scrolled = Math.abs(scroller.scrollLeft);
      const start = scrolled > 1;
      const end = scrolled + scroller.clientWidth < scroller.scrollWidth - 1;
      setOverflow((prev) =>
        prev.start === start && prev.end === end && prev.rtl === rtl
          ? prev
          : { end, rtl, start },
      );
    };

    update();

    scroller.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            rtl = isRtl(scroller);
            update();
          });
    observer?.observe(scroller);
    observer?.observe(list);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [isVertical]);

  // The tab after a closed one takes the focus - once the closed one is
  // gone, the list of tabs is another
  useLayoutEffect(() => {
    const pending = focusAfterCloseRef.current;
    if (pending === null) return;

    focusAfterCloseRef.current = null;
    const index = items.findIndex(
      (item) => !isLinkTab(item) && item.value === pending,
    );
    if (index === -1) return;
    tabsRef.current
      ?.querySelectorAll<HTMLElement>("[role='tab']")
      [index]?.focus();
  });

  /** Closes the tab at `index` - its `onClose` and the tab after it. */
  const closeTab = (index: number) => {
    const item = items[index];
    if (!item || isLinkTab(item) || !item.onClose || item.disabled) return;

    const neighbor = getNeighborValue(items, index);
    const tabs = Array.from(
      tabsRef.current?.querySelectorAll<HTMLElement>("[role='tab']") ?? [],
    );
    const focusedIndex = tabs.findIndex(
      (tab) => tab === document.activeElement,
    );

    if (focusedIndex === index) {
      focusAfterCloseRef.current = neighbor;
    } else if (focusedIndex !== -1) {
      // Another tab keeps the focus - wherever it moves in the list
      const focusedItem = items[focusedIndex];
      focusAfterCloseRef.current =
        focusedItem && !isLinkTab(focusedItem) ? focusedItem.value : null;
    }

    item.onClose();
    if (item.value === selectedValue && neighbor !== null) select(neighbor);
  };

  // Value tabs are one tab stop - the arrow keys move between them and
  // select the one they move to, past the disabled ones
  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    index: number,
  ) => {
    // Alt + ArrowLeft goes back in the browser history
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const current = items[index];
    if (event.key === "Delete" && current && !isLinkTab(current)) {
      // Holding the key would go on to close the tab that takes the focus
      if (current.onClose && !event.repeat) {
        event.preventDefault();
        closeTab(index);
      }
      return;
    }

    const keys =
      MOVE_KEYS[
        isVertical
          ? "vertical"
          : isRtl(event.currentTarget)
            ? "rtl"
            : "horizontal"
      ];
    const next = getKeyTarget(items, index, event.key, keys);
    const item = next === null ? undefined : items[next];
    if (next === null || !item || isLinkTab(item)) return;

    event.preventDefault();
    select(item.value);
    tabsRef.current
      ?.querySelectorAll<HTMLElement>("[role='tab']")
      [next]?.focus();
  };

  // The selected tab takes the focus - the first enabled one while none is
  // selected, or the selected one is disabled
  const tabStopIndex =
    activeIndex !== -1 && !items[activeIndex]?.disabled
      ? activeIndex
      : items.findIndex((item) => !item.disabled);

  const tabClassName = cn(
    "flex items-center rounded-md font-medium",
    isVertical
      ? ["w-full text-start", sizeClasses.verticalTab]
      : sizeClasses.tab,
  );
  // Inset - the scrolling bar would cut off a ring around the tab
  const focusClassName =
    "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500";

  const fadeMask = getFadeMask(overflow);

  // Tab stops at a tab under a fade - the browser scrolls it only to the
  // edge. Not after a click: the tab would move away under the pointer.
  const handleFocus = (event: React.FocusEvent) => {
    const scroller = scrollerRef.current;
    const tab = (event.target as Element).closest("li");

    if (scroller && tab && !isVertical && isKeyboardFocus(event.target)) {
      scrollTabIntoView(scroller, tab, "smooth");
    }
  };

  const bar = (
    <div
      className={
        isVertical
          ? hasPanels
            ? "shrink-0"
            : undefined
          : "[scrollbar-width:thin] overflow-x-auto"
      }
      onFocus={handleFocus}
      ref={scrollerRef}
      style={
        fadeMask
          ? { maskImage: fadeMask, WebkitMaskImage: fadeMask }
          : undefined
      }
    >
      <ul
        // Placeholders are no tabs - a tablist without any is none yet
        aria-busy={loading || undefined}
        aria-orientation={isLinkList || loading ? undefined : orientation}
        role={isLinkList || loading ? undefined : "tablist"}
        {...props}
        className={cn(
          "relative border-neutral-200 dark:border-neutral-800",
          // The line runs under the whole bar - past the last tab too
          isVertical
            ? "flex flex-col border-s"
            : "flex w-max min-w-full border-b whitespace-nowrap",
          sizeClasses.container,
          className,
        )}
        data-orientation={orientation}
        ref={listRef}
      >
        {/* Animated indicator - over the line, under or beside the tab. At
            the measured place of the tab, which is physical - `left` also
            right to left. A system color in forced colors mode, which
            would drop its fill. */}
        {!loading && activeTabBounds && (
          <div
            aria-hidden="true"
            className={cn(
              "absolute rounded-full bg-primary-600 transition-all duration-300 ease-in-out motion-reduce:transition-none dark:bg-primary-400 forced-colors:bg-[Highlight]",
              isVertical ? "-start-px w-0.5" : "-bottom-px h-0.5",
            )}
            style={
              isVertical
                ? {
                    height: `${activeTabBounds.height}px`,
                    top: `${activeTabBounds.top}px`,
                  }
                : {
                    left: `${activeTabBounds.left}px`,
                    width: `${activeTabBounds.width}px`,
                  }
            }
          />
        )}

        {loading
          ? // Loading skeleton tabs
            Array.from({ length: loadingTabsCount }).map((_, index) => (
              <li
                aria-hidden="true"
                className={sizeClasses.skeleton}
                key={`skeleton-${index}`}
              >
                <Skeleton
                  height="h-2"
                  width={skeletonWidths[index % skeletonWidths.length]}
                />
              </li>
            ))
          : // Normal tabs
            items.map((item, index) => {
              const isActive = index === activeIndex;
              const isClosable =
                !isLinkTab(item) && !!item.onClose && !item.disabled;
              const content = (
                <>
                  {item.icon && (
                    <span aria-hidden="true" className="flex shrink-0">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                  {isClosable && (
                    // For the pointer - the keyboard closes the tab with
                    // Delete (`aria-keyshortcuts`), and a button in a tab
                    // would be a control in a control
                    <span
                      aria-hidden="true"
                      className="-me-1.5 flex size-5 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                      data-tab-close=""
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(index);
                      }}
                      // The click leaves the focus where it is
                      onMouseDown={(event) => event.preventDefault()}
                      title={messages.tabs.close}
                    >
                      <X size={14} />
                    </span>
                  )}
                </>
              );

              return (
                <li
                  className={cn(
                    "relative z-10 transition-colors duration-200",
                    item.disabled && "opacity-50",
                    isActive && "text-primary-600 dark:text-primary-400",
                    !isActive && "text-neutral-500 dark:text-neutral-400",
                    !isActive &&
                      !item.disabled &&
                      "hover:text-neutral-700 dark:hover:text-neutral-300",
                  )}
                  key={index}
                  role={isLinkTab(item) ? undefined : "presentation"}
                >
                  {isLinkTab(item) ? (
                    item.disabled ? (
                      // Without an `href` nothing opens it - no click, no
                      // middle click, no "Open in new tab" - and Tab skips it
                      <a
                        aria-current={isActive ? "page" : undefined}
                        aria-disabled="true"
                        className={cn(tabClassName, "cursor-not-allowed")}
                        data-current={isActive ? "" : undefined}
                        data-disabled=""
                        data-selected={isActive ? "" : undefined}
                        role="link"
                      >
                        {content}
                      </a>
                    ) : (
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        className={cn(tabClassName, focusClassName)}
                        data-current={isActive ? "" : undefined}
                        data-selected={isActive ? "" : undefined}
                        href={item.href}
                      >
                        {content}
                      </Link>
                    )
                  ) : (
                    <button
                      aria-controls={
                        item.panelId ??
                        (hasPanel(item) && (isActive || keepMounted)
                          ? `${baseId}-panel-${index}`
                          : undefined)
                      }
                      aria-keyshortcuts={isClosable ? "Delete" : undefined}
                      aria-selected={isActive}
                      className={cn(
                        tabClassName,
                        focusClassName,
                        "cursor-pointer disabled:cursor-not-allowed",
                      )}
                      data-disabled={item.disabled ? "" : undefined}
                      data-selected={isActive ? "" : undefined}
                      disabled={item.disabled}
                      id={
                        item.id ??
                        (hasPanel(item) ? `${baseId}-tab-${index}` : undefined)
                      }
                      onClick={() => select(item.value)}
                      onKeyDown={(event) => handleTabKeyDown(event, index)}
                      role="tab"
                      tabIndex={index === tabStopIndex ? 0 : -1}
                      type="button"
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
      </ul>
    </div>
  );

  if (!hasPanels || loading) return bar;

  return (
    <div className={isVertical ? "flex items-start gap-6" : undefined}>
      {bar}
      {items.map((item, index) => {
        if (!hasPanel(item)) return null;

        const isActive = index === activeIndex;
        if (!isActive && !keepMounted) return null;

        return (
          <div
            aria-labelledby={item.id ?? `${baseId}-tab-${index}`}
            className={cn(
              "rounded-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500",
              isVertical ? "min-w-0 flex-1" : "pt-4",
              panelClassName,
            )}
            hidden={!isActive}
            id={item.panelId ?? `${baseId}-panel-${index}`}
            // The state of a kept panel stays with its tab - also when a
            // tab before it is closed
            key={`panel-${item.value}`}
            role="tabpanel"
            // Reached by Tab from the tab - also a panel without controls
            tabIndex={0}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}
