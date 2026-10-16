import { LoaderCircle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { attachRef } from "../../../hooks/use-form-control";
import { useMessages } from "../../../providers/ui-context";
import cn from "../../../utils/cn";
import isPromiseLike from "../../../utils/is-promise-like";
import logger from "../../../utils/logger";
import Button from "../button";
import useVirtualList, {
  type VirtualListScrollOptions,
} from "./use-virtual-list";

/** What `handleRef` of a `VirtualList` gives. */
export interface VirtualListHandle {
  /**
   * Scrolls the item at `index` into view - also one that is not rendered:
   * it is placed again as the items it passed are measured, until the user
   * scrolls.
   */
  scrollToIndex: (index: number, options?: VirtualListScrollOptions) => void;
}

export interface VirtualListProps<T> extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /**
   * Accessible name of the list - also of the scroll container, which is
   * a named region then.
   */
  "aria-label"?: string;
  /** Id of the element naming the list - see `aria-label`. */
  "aria-labelledby"?: string;
  /**
   * Shown in place of the list when it has no items - and has no more to
   * load (`onEndReached` with `hasMore`), e.g. an `EmptyState`.
   */
  empty?: React.ReactNode;
  /**
   * How close (px) the view must come to the end of the list - or the start
   * - for `onEndReached` (`onStartReached`) to be called.
   * @default 200
   */
  endReachedThreshold?: number;
  /**
   * Height (px) of an item that has not been rendered yet - or a function of
   * the item. Rendered items are measured; with a number, the items not
   * measured yet are taken to be as high as the measured ones are on
   * average.
   * @default 48
   */
  estimateSize?: number | ((item: T, index: number) => number);
  /**
   * Stable key of an item, e.g. its id - its measured height, the focus in
   * it and the scroll position stay with the item when items are added
   * before it (items sorted anew keep the scroll position). The index by
   * default, which is enough for a list that only grows at the end.
   */
  getItemKey?: (item: T, index: number) => React.Key;
  /**
   * Gives `scrollToIndex` - e.g. to show the last message of a chat (with
   * `{ align: "end" }`).
   */
  handleRef?: React.Ref<VirtualListHandle>;
  /**
   * Whether `onEndReached` can load more items. Once it is `false` the list
   * is complete.
   * @default true
   */
  hasMore?: boolean;
  /**
   * Height of the scroll container - a number of px or any CSS length. Give
   * it a `height` or a `maxHeight` (or a height by `className`), unless
   * the page scrolls the list (`useWindowScroll`).
   */
  height?: number | string;
  /**
   * Classes of each item element (`role="listitem"`) - or a function of
   * the item. Pad the items rather than give them margins, which are not
   * measured.
   */
  itemClassName?: string | ((item: T, index: number) => string | undefined);
  /**
   * The number of all items, when only some are loaded - e.g. the total of
   * the server. Screen readers hear it with each item. Without it the list
   * is as long as `items` - or of an unknown length while `hasMore`.
   */
  itemCount?: number;
  /** The items of the list - thousands of them are fine. */
  items: readonly T[];
  /** Classes of the list element (`role="list"`) - do not pad it. */
  listClassName?: string;
  /**
   * Shows the loading row at the end of the list - by default it shows
   * while the promise `onEndReached` returned is pending.
   */
  loadingMore?: boolean;
  /**
   * Shows the error row at the end of the list, with a "Try again" button
   * calling `onEndReached` - `true` with the text of the locale, or a
   * message; `false` hides it. By default it shows when the promise of
   * `onEndReached` rejects.
   */
  loadMoreError?: boolean | React.ReactNode;
  /** Max height of the scroll container - a number of px or any CSS length. */
  maxHeight?: number | string;
  /**
   * Called as the view comes within `endReachedThreshold` of the end of
   * the list - load the next page and append it to `items`. Called once
   * for each length of `items` while `hasMore`; also at once for a list too
   * short to fill the view. A returned promise shows the loading row while
   * it is pending, and the error row when it rejects.
   */
  onEndReached?: () => void | PromiseLike<unknown>;
  /**
   * Called as the view comes within `endReachedThreshold` of the start of
   * the list - e.g. to load older messages and put them before the others.
   * The view stays on the items it showed (give `getItemKey`). Called once
   * for each length of `items`; a returned promise shows a loading
   * indicator at the top while it is pending, and an error with a "Try
   * again" button when it rejects.
   */
  onStartReached?: () => void | PromiseLike<unknown>;
  /**
   * Items rendered above and below the view, so that scrolling and Tab
   * find them ready.
   * @default 4
   */
  overscan?: number;
  /**
   * Renders an item - the content of its `role="listitem"` element. Called
   * only for the items in view (and `overscan` around them).
   */
  renderItem: (item: T, index: number) => React.ReactNode;
  /**
   * The page scrolls the list instead of a container of its own - e.g. a
   * long feed. `height` and `maxHeight` are not used then.
   */
  useWindowScroll?: boolean;
}

/** A CSS length - a number is in pixels. */
const toLength = (value: number | string | undefined) =>
  typeof value === "number" ? `${value}px` : value;

/**
 * Calls `load` - and, while the promise it returns is pending, says so.
 * Returns whether it is pending and whether it rejected.
 */
function useLoader(load: (() => void | PromiseLike<unknown>) | undefined) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = () => {
    if (!load) return;
    setFailed(false);
    const result = load();
    if (!isPromiseLike(result)) return;

    setPending(true);
    result.then(
      () => setPending(false),
      (reason: unknown) => {
        // For the developer - the user is told by the text of the locale
        logger.error(reason);
        setPending(false);
        setFailed(true);
      },
    );
  };

  return { failed, pending, run };
}

/**
 * What a request for more items was made for - the length of the list and
 * its first item (by its key, when there is `getItemKey`): other items of
 * the same length (another search) may ask again.
 */
interface LoadRequest {
  count: number;
  first: unknown;
}

const isSameRequest = (a: LoadRequest | null, b: LoadRequest) =>
  !!a && a.count === b.count && a.first === b.first;

/**
 * A list of thousands of items that renders only those in view - of any
 * height, measured as they are rendered. It scrolls in a container of its
 * own (`height` / `maxHeight`) or with the page (`useWindowScroll`), loads
 * more items as the view nears the end (`onEndReached`) - or the start
 * (`onStartReached`), keeping the view on its items as older ones are put
 * before them - and scrolls to any item (`handleRef`). A list
 * (`role="list"`) whose items tell their position (`aria-posinset`,
 * `aria-setsize`); the server renders the first items. The other
 * attributes and the `ref` go to the scroll container (to the element
 * around the list with `useWindowScroll`).
 */
export default function VirtualList<T>({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  empty,
  endReachedThreshold = 200,
  estimateSize = 48,
  getItemKey,
  handleRef,
  hasMore = true,
  height,
  itemClassName,
  itemCount,
  items,
  listClassName,
  loadingMore,
  loadMoreError,
  maxHeight,
  onEndReached,
  onStartReached,
  overscan = 4,
  ref,
  renderItem,
  style,
  useWindowScroll = false,
  ...props
}: VirtualListProps<T>) {
  const messages = useMessages().ui.virtualList;
  // By the index - stable while the items and the functions are
  const itemEstimate = useCallback(
    (index: number) =>
      typeof estimateSize === "function"
        ? estimateSize(items[index], index)
        : estimateSize,
    [estimateSize, items],
  );
  const itemKey = useCallback(
    (index: number) => (getItemKey ? getItemKey(items[index], index) : index),
    [getItemKey, items],
  );

  const {
    listRef,
    listStyle,
    measureRef,
    nearEnd,
    nearStart,
    scrollRef,
    scrollToIndex,
    virtualItems,
  } = useVirtualList({
    count: items.length,
    // A number lets the measured items stand for the others
    estimateSize:
      typeof estimateSize === "function" ? itemEstimate : estimateSize,
    getItemKey: itemKey,
    initialCount:
      typeof height === "number" || typeof maxHeight === "number"
        ? Math.ceil(
            Math.max(Number(height) || 0, Number(maxHeight) || 0) /
              Math.max(typeof estimateSize === "number" ? estimateSize : 48, 1),
          ) + overscan
        : 20,
    overscan,
    threshold: endReachedThreshold,
    useWindowScroll,
  });

  useImperativeHandle(handleRef, () => ({ scrollToIndex }), [scrollToIndex]);

  const end = useLoader(onEndReached);
  const start = useLoader(onStartReached);
  const isLoadingMore = loadingMore ?? end.pending;
  const showError =
    loadMoreError === undefined ? end.failed : loadMoreError !== false;

  // Each list asks for more once - a page that brought nothing new must
  // not be asked for again and again
  const endRequestedRef = useRef<LoadRequest | null>(null);
  const startRequestedRef = useRef<LoadRequest | null>(null);
  const count = items.length;
  const request: LoadRequest = {
    count,
    first: count && getItemKey ? getItemKey(items[0], 0) : items[0],
  };

  useEffect(() => {
    if (
      !onEndReached ||
      !nearEnd ||
      !hasMore ||
      isLoadingMore ||
      showError ||
      isSameRequest(endRequestedRef.current, request)
    ) {
      return;
    }
    endRequestedRef.current = request;
    end.run();
  });

  useEffect(() => {
    if (
      !onStartReached ||
      !nearStart ||
      start.pending ||
      start.failed ||
      count === 0 ||
      isSameRequest(startRequestedRef.current, request)
    ) {
      return;
    }
    startRequestedRef.current = request;
    start.run();
  });

  const rootRef = useCallback(
    (element: HTMLDivElement | null) => {
      const detachScroll = useWindowScroll ? undefined : scrollRef(element);
      const detach = attachRef(ref, element);
      return () => {
        detachScroll?.();
        detach();
      };
    },
    [ref, scrollRef, useWindowScroll],
  );

  const setSize = itemCount ?? (hasMore && onEndReached ? -1 : count);
  const isNamed = !!ariaLabel || !!ariaLabelledBy;
  const errorMessage =
    loadMoreError !== undefined &&
    loadMoreError !== false &&
    loadMoreError !== true
      ? loadMoreError
      : messages.loadError;

  return (
    <div
      // The scroll container is a Tab stop - the keyboard scrolls it - and
      // a region, when it has a name to tell it by
      aria-label={!useWindowScroll && isNamed ? ariaLabel : undefined}
      aria-labelledby={!useWindowScroll && isNamed ? ariaLabelledBy : undefined}
      role={!useWindowScroll && isNamed ? "region" : undefined}
      tabIndex={useWindowScroll ? undefined : 0}
      {...props}
      className={cn(
        !useWindowScroll && [
          "relative overflow-y-auto [overflow-anchor:none] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500",
        ],
        className,
      )}
      data-virtual-list=""
      ref={rootRef}
      style={
        useWindowScroll
          ? style
          : {
              height: toLength(height),
              maxHeight: toLength(maxHeight),
              ...style,
            }
      }
    >
      {onStartReached && (
        // Over the items, taking no room - they must not move as it comes
        <div className="sticky top-0 z-10 h-0">
          <div aria-live="polite">
            {start.pending && (
              <div className="flex justify-center pt-2">
                <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm text-neutral-600 shadow-sm ring-1 ring-neutral-200 dark:bg-surface-dark dark:text-neutral-300 dark:ring-neutral-700">
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                  {messages.loading}
                </span>
              </div>
            )}
          </div>
          {start.failed && !start.pending && (
            <div className="flex justify-center px-3 pt-2" role="alert">
              <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-surface px-3 py-1 text-sm text-danger-700 shadow-sm ring-1 ring-neutral-200 dark:bg-surface-dark dark:text-danger-300 dark:ring-neutral-700">
                {messages.loadError}
                <Button
                  onClick={() => {
                    startRequestedRef.current = request;
                    start.run();
                  }}
                  size="sm"
                  variant="outline"
                >
                  {messages.retry}
                </Button>
              </span>
            </div>
          )}
        </div>
      )}
      {
        // Not while the first page is still to be asked for
        count === 0 &&
          !isLoadingMore &&
          !showError &&
          !(onEndReached && hasMore) &&
          empty
      }
      <div
        aria-busy={isLoadingMore || start.pending || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={listClassName}
        ref={listRef}
        role="list"
        style={listStyle}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              aria-posinset={virtualItem.index + 1}
              aria-setsize={setSize}
              className={
                typeof itemClassName === "function"
                  ? itemClassName(item, virtualItem.index)
                  : itemClassName
              }
              data-index={virtualItem.index}
              key={virtualItem.key}
              ref={measureRef}
              role="listitem"
              style={virtualItem.style}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
      {onEndReached && (
        <div aria-live="polite">
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 px-3 py-3 text-sm text-neutral-600 dark:text-neutral-300">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {messages.loading}
            </div>
          )}
        </div>
      )}
      {showError && !isLoadingMore && (
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-3 py-3 text-sm text-danger-700 dark:text-danger-300"
          role="alert"
        >
          <span>{errorMessage}</span>
          {onEndReached && (
            <Button
              onClick={() => {
                endRequestedRef.current = request;
                end.run();
              }}
              size="sm"
              variant="outline"
            >
              {messages.retry}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
