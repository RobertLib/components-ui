import { useLayoutEffect, useRef, useState } from "react";
import cn from "../utils/cn";
import Skeleton from "./skeleton";
import { isActivePath } from "../providers/router";
import { useRouter } from "../providers/ui-context";

/** A tab that navigates to a page. */
export interface LinkTabItem {
  href: string;
  label: React.ReactNode;
}

/** A tab that switches local state - use with `value` and `onChange`. */
export interface ValueTabItem {
  label: React.ReactNode;
  value: string;
}

export type TabItem = LinkTabItem | ValueTabItem;

export interface TabsProps extends Omit<
  React.ComponentProps<"ul">,
  "onChange"
> {
  /**
   * Link tabs only: compare the query string too, so `?tab=a` and `?tab=b`
   * are different tabs of one page. The first tab is active while none of
   * the tab parameters is in the URL.
   */
  includeQueryParams?: boolean;
  /** The tabs - links (`href`) or buttons (`value`), not mixed. */
  items: TabItem[];
  /** Shows placeholder tabs. */
  loading?: boolean;
  /** Number of placeholder tabs while `loading`. */
  loadingTabsCount?: number;
  /** Value tabs only: called with the `value` of the clicked tab. */
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  /** Value tabs only: the selected tab. */
  value?: string;
}

const isLinkTab = (item: TabItem): item is LinkTabItem => "href" in item;

// Resolves relative URLs of the tabs - the origin itself is never used
const URL_BASE = "http://localhost";

/**
 * A segmented tab bar with an animated indicator. Tabs are either links
 * (`href`, active by the current URL) or buttons (`value` + `onChange`);
 * button tabs are one tab stop, the arrow keys (and Home / End) select the
 * next one.
 */
export default function Tabs({
  className,
  includeQueryParams = false,
  items,
  loading = false,
  loadingTabsCount = 3,
  onChange,
  size = "md",
  value,
  ...props
}: TabsProps) {
  const { Link, pathname, search } = useRouter();

  const isActiveTab = (item: TabItem, index: number) => {
    if (!isLinkTab(item)) return item.value === value;

    const { href } = item;

    if (includeQueryParams) {
      const currentUrlObj = new URL(pathname + search, URL_BASE);
      const hrefUrlObj = new URL(href, new URL(pathname, URL_BASE));

      // Check if pathnames match
      if (currentUrlObj.pathname !== hrefUrlObj.pathname) {
        return false;
      }

      // Get all query parameter keys from href
      const hrefParamKeys = Array.from(hrefUrlObj.searchParams.keys());

      // Check if current URL has any of the query parameters that tabs use
      const hasAnyTabParams = hrefParamKeys.some((key) =>
        currentUrlObj.searchParams.has(key),
      );

      // If no relevant tab parameters in current URL and this is the first tab, consider it active
      if (!hasAnyTabParams && index === 0) {
        return true;
      }

      // Check if all query parameters from href match exactly in current URL
      for (const [key, paramValue] of hrefUrlObj.searchParams.entries()) {
        if (currentUrlObj.searchParams.get(key) !== paramValue) {
          return false;
        }
      }

      return true;
    }

    return isActivePath(pathname, href);
  };

  // Predefined widths for skeleton tabs to ensure Tailwind classes exist
  const skeletonWidths = ["w-16", "w-20", "w-24", "w-28", "w-32"];

  // Size variants
  const sizeVariants = {
    sm: {
      container: "p-0.5 space-x-0.5",
      tab: "px-3 py-0.5 text-[13.5px]",
      skeleton: "px-2 py-1",
    },
    md: {
      container: "p-1 space-x-1",
      tab: "px-4 py-0.5 text-sm",
      skeleton: "px-4 py-2",
    },
    lg: {
      container: "p-1.5 space-x-1.5",
      tab: "px-5 py-0.5 text-base",
      skeleton: "px-6 py-3",
    },
  };

  const sizeClasses = sizeVariants[size];

  // Track active tab index and position for animation
  const [activeTabBounds, setActiveTabBounds] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const tabsRef = useRef<HTMLUListElement>(null);

  // Of several matching links the most specific wins - `/users/archive`
  // over `/users` on `/users/archive`
  const pathLength = (item: TabItem) =>
    isLinkTab(item) ? item.href.split(/[?#]/)[0].length : 0;
  const activeIndex = items.reduce(
    (best, item, index) =>
      isActiveTab(item, index) &&
      (best === -1 ||
        (!includeQueryParams && pathLength(item) > pathLength(items[best])))
        ? index
        : best,
    -1,
  );

  useLayoutEffect(() => {
    const list = tabsRef.current;

    if (!list || loading || activeIndex === -1) {
      setActiveTabBounds(null);
      return;
    }

    // Skip the first child if it's the animated background indicator
    const tabElements = Array.from(list.children).filter(
      (child) => child.tagName === "LI",
    ) as HTMLElement[];

    const measure = () => {
      const activeTab = tabElements[activeIndex];
      if (!activeTab) return;

      const containerRect = list.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      const left = tabRect.left - containerRect.left;
      const width = tabRect.width;

      setActiveTabBounds((prev) =>
        prev?.left === left && prev.width === width ? prev : { left, width },
      );
    };

    measure();

    // The tabs change size after the first measurement - a web font that
    // loads later, a label that changes, a container that narrows
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    tabElements.forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [activeIndex, loading, items]);

  // Value tabs are one tab stop - the arrow keys move between them and
  // select the one they move to
  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;

    const item = next === null ? undefined : items[next];
    if (next === null || !item || isLinkTab(item)) return;

    event.preventDefault();
    onChange?.(item.value);
    tabsRef.current
      ?.querySelectorAll<HTMLElement>("[role='tab']")
      [next]?.focus();
  };

  // The selected tab takes the focus - the first one while none is selected
  const tabStopIndex = activeIndex === -1 ? 0 : activeIndex;

  const tabClassName = cn("flex items-center font-medium", sizeClasses.tab);

  return (
    <div className="overflow-x-auto">
      <ul
        ref={tabsRef}
        role={isLinkTab(items[0] ?? { href: "" }) ? undefined : "tablist"}
        {...props}
        className={cn(
          "relative inline-flex rounded-md bg-background whitespace-nowrap dark:bg-background-dark",
          sizeClasses.container,
          className,
        )}
      >
        {/* Animated background indicator */}
        {!loading && activeTabBounds && (
          <div
            aria-hidden="true"
            className="absolute rounded-md bg-surface shadow transition-all duration-300 ease-in-out dark:bg-surface-dark"
            style={{
              left: `${activeTabBounds.left}px`,
              width: `${activeTabBounds.width}px`,
              top: size === "sm" ? "2px" : size === "md" ? "4px" : "6px",
              bottom: size === "sm" ? "2px" : size === "md" ? "4px" : "6px",
            }}
          />
        )}

        {loading
          ? // Loading skeleton tabs
            Array.from({ length: loadingTabsCount }).map((_, index) => (
              <li
                className={cn("rounded-md", sizeClasses.skeleton)}
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

              return (
                <li
                  className={cn(
                    "relative z-10 rounded-md transition-colors duration-200",
                    isActive
                      ? ""
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
                  )}
                  key={index}
                  role={isLinkTab(item) ? undefined : "presentation"}
                >
                  {isLinkTab(item) ? (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={tabClassName}
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      aria-selected={isActive}
                      className={cn(
                        tabClassName,
                        "cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                      )}
                      onClick={() => onChange?.(item.value)}
                      onKeyDown={(event) => handleTabKeyDown(event, index)}
                      role="tab"
                      tabIndex={index === tabStopIndex ? 0 : -1}
                      type="button"
                    >
                      {item.label}
                    </button>
                  )}
                </li>
              );
            })}
      </ul>
    </div>
  );
}
