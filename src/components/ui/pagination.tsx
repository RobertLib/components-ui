import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Button from "./button";
import { useEffect, useId, useState } from "react";
import cn from "../../utils/cn";
import { formatMessage, formatNumber } from "../../i18n/ui/format";
import Select from "./select";
import { useLocale } from "../../providers/ui-context";

/**
 * Cursor-based pagination state, shaped like the `pageInfo` of a Relay
 * connection so that a GraphQL `PageInfo` can be passed straight through.
 */
export interface PageInfo {
  /** Cursor of the last row - requested as `after` for the next page. */
  endCursor?: string | null;
  /** There is a page after this one - enables the next button. */
  hasNextPage: boolean;
  /**
   * There is a page before this one - enables the previous button (so does
   * a `currentPage` above 1).
   */
  hasPreviousPage: boolean;
  /** Cursor of the first row - requested as `before` for the previous page. */
  startCursor?: string | null;
}

export type PaginationDirection = "first" | "prev" | "next" | "last";

/** The other props go to the `<nav>` - an `aria-label` replaces the default one. */
export interface PaginationProps extends Omit<
  React.ComponentProps<"nav">,
  "onChange"
> {
  /**
   * `pages` only: the numbered pages shown at each end - the first and the
   * last page with 1.
   * @default 1
   */
  boundaryCount?: number;
  /** 1-based number of the shown page. */
  currentPage?: number;
  /**
   * Called with the requested direction. In cursor mode the second argument
   * is the cursor to continue from (`startCursor` for `prev`, `endCursor`
   * for `next`). The numbered pages and the jump to a page call
   * `onPageChange` only.
   */
  onChange?: (direction: PaginationDirection, cursor?: string) => void;
  /**
   * Offset mode: called with the number of the page to show - by the
   * buttons, the numbered pages (`variant="pages"`) and the jump to a page
   * (`showJumpTo`).
   */
  onPageChange?: (page: number) => void;
  /** Called with the page size picked in the select of `pageSizeOptions`. */
  onPageSizeChange?: (pageSize: number) => void;
  /**
   * Number of pages, in place of a `total` - for an API that reports the
   * pages rather than the rows. No range is shown with it alone.
   */
  pageCount?: number;
  /**
   * Shows a select of the page size with these choices, e.g.
   * `[10, 20, 50]` - see `onPageSizeChange`. Its value is `pageSize`.
   */
  pageSizeOptions?: number[];
  /**
   * Offset mode: shows a number field that goes to the page typed into it
   * (Enter, or its button) - for long lists of pages.
   */
  showJumpTo?: boolean;
  /**
   * `pages` only: the numbered pages shown on each side of the current one.
   * @default 1
   */
  siblingCount?: number;
  /**
   * `compact` - first / previous / next / last buttons. `pages` - previous
   * and next around numbered pages, the gaps between them "…"; it needs a
   * `total` or a `pageCount` (offset mode) and is compact otherwise.
   * @default "compact"
   */
  variant?: "compact" | "pages";
  /**
   * The requested page is loading - the buttons do nothing meanwhile (they
   * stay focusable). In cursor mode they also wait after a move until a new
   * `pageInfo` arrives or the load ends (e.g. with an error), since the old
   * cursors would page from the old page. Pass it there: without it a move
   * whose load fails waits for a new `pageInfo` only 10 seconds.
   */
  loading?: boolean;
  /**
   * Cursor mode (GraphQL / Relay): the next button follows `hasNextPage`,
   * the previous one `hasPreviousPage` or a `currentPage` above 1 (servers
   * paging forward need not report earlier pages). Leave out for offset
   * mode, where the buttons are derived from `currentPage`, `pageSize` and
   * `total`.
   */
  pageInfo?: PageInfo;
  /** Rows per page. */
  pageSize?: number;
  /** Total number of rows - shows the "1–20 of 135" range. */
  total?: number;
}

/**
 * How long a move of a cursor connection waits for the page info of the
 * requested page at most, when no `loading` state tells when its load ends.
 */
const MOVE_TIMEOUT = 10_000;

// Previous points to the start - to the right in a right-to-left page
const CHEVRON_CLASS = "rtl:-scale-x-100";

/** The props of a button with `className` added to its own. */
function withClass<T extends { className?: string }>(
  props: T,
  className: string | undefined,
): T {
  return className
    ? { ...props, className: cn(className, props.className) }
    : props;
}

type PageItem = number | "end-ellipsis" | "start-ellipsis";

const pageRange = (start: number, end: number) =>
  Array.from({ length: Math.max(end - start + 1, 0) }, (_, i) => start + i);

/**
 * The numbered pages of `count` shown around `current`: `boundaries` at
 * each end, `siblings` on each side of the current one, and a gap ("…")
 * for more than one page left out - a page alone is shown in its place.
 * Always the same number of items while there are enough pages, so the
 * buttons do not jump around.
 */
function getPageItems(
  current: number,
  count: number,
  siblings = 1,
  boundaries = 1,
): PageItem[] {
  const startPages = pageRange(1, Math.min(boundaries, count));
  const endPages = pageRange(
    Math.max(count - boundaries + 1, boundaries + 1),
    count,
  );

  const siblingsStart = Math.max(
    Math.min(current - siblings, count - boundaries - siblings * 2 - 1),
    boundaries + 2,
  );
  const siblingsEnd = Math.min(
    Math.max(current + siblings, boundaries + siblings * 2 + 2),
    endPages.length > 0 ? endPages[0] - 2 : count - 1,
  );

  const items: (PageItem | null)[] = [
    ...startPages,
    siblingsStart > boundaries + 2
      ? "start-ellipsis"
      : boundaries + 1 < count - boundaries
        ? boundaries + 1
        : null,
    ...pageRange(siblingsStart, siblingsEnd),
    siblingsEnd < count - boundaries - 1
      ? "end-ellipsis"
      : count - boundaries > boundaries
        ? count - boundaries
        : null,
    ...endPages,
  ];

  // Few pages - each once, in order
  const seen = new Set<PageItem>();
  return items.filter((item): item is PageItem => {
    if (item === null || seen.has(item)) return false;
    if (typeof item === "number" && (item < 1 || item > count)) return false;
    seen.add(item);
    return true;
  });
}

/**
 * First / previous / next (/ last) buttons with the shown range - or, with
 * `variant="pages"`, numbered pages between previous and next. Works with
 * cursor pagination (GraphQL connections) and offset pagination (REST),
 * with a page size select and a jump to a page on request. A button that
 * becomes unavailable while it has the focus (Last page, Next onto the
 * last page) keeps the focus, announced as unavailable, until the focus
 * moves on. The button of the current page has `data-current` and
 * `data-selected`.
 */
export default function Pagination({
  boundaryCount = 1,
  className,
  currentPage = 1,
  loading: loadingProp,
  onChange,
  onPageChange,
  onPageSizeChange,
  pageCount,
  pageInfo,
  pageSize = 20,
  pageSizeOptions,
  showJumpTo = false,
  siblingCount = 1,
  total,
  variant = "compact",
  ...props
}: PaginationProps) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const controlsId = useId();
  const [jumpText, setJumpText] = useState("");

  const isCursorMode = pageInfo !== undefined;
  const loading = loadingProp ?? false;
  // A parent that tells when a load ends also tells when it failed
  const reportsLoading = loadingProp !== undefined;

  // The cursors a move started from - until `pageInfo` brings others (or a
  // load ends, e.g. with an error) they would repeat the same move. An
  // offset API can supply only the pageInfo flags, without any cursors.
  const cursorKey =
    pageInfo?.startCursor || pageInfo?.endCursor
      ? `${pageInfo.startCursor ?? ""}\n${pageInfo.endCursor ?? ""}`
      : null;
  const [movedFrom, setMovedFrom] = useState<string | null>(null);
  const [wasLoading, setWasLoading] = useState(loading);

  if (wasLoading !== loading) {
    setWasLoading(loading);
    if (!loading) setMovedFrom(null);
  }
  if (movedFrom !== null && movedFrom !== cursorKey) setMovedFrom(null);

  // Without a `loading` state nothing tells a failed load - the page info
  // stays as it was. The move waits for a while, not for good.
  useEffect(() => {
    if (movedFrom === null || reportsLoading) return;

    const timer = setTimeout(() => setMovedFrom(null), MOVE_TIMEOUT);
    return () => clearTimeout(timer);
  }, [movedFrom, reportsLoading]);

  const isBusy = loading || (movedFrom !== null && movedFrom === cursorKey);

  // The button with the focus - one that becomes unavailable (the last page
  // reached) must not drop it to the page
  const [focused, setFocused] = useState<PaginationDirection | null>(null);

  const lastPage =
    pageCount !== undefined
      ? Math.max(1, Math.floor(pageCount))
      : total !== undefined
        ? Math.max(1, Math.ceil(total / pageSize))
        : undefined;

  const hasPreviousPage =
    currentPage > 1 || (isCursorMode && pageInfo.hasPreviousPage);
  const hasNextPage = isCursorMode
    ? pageInfo.hasNextPage
    : lastPage !== undefined && currentPage < lastPage;

  // A page past the end (its rows were deleted) shows no rows
  const isEmptyPage =
    total === 0 || (lastPage !== undefined && currentPage > lastPage);

  // Numbers as the language writes them - "1–20 of 1,234"
  const range =
    total === undefined
      ? null
      : formatMessage(messages.pagination.range, {
          from: formatNumber(
            locale.code,
            isEmptyPage ? 0 : (currentPage - 1) * pageSize + 1,
          ),
          to: formatNumber(
            locale.code,
            isEmptyPage ? 0 : Math.min(currentPage * pageSize, total),
          ),
          total: formatNumber(locale.code, total),
        });

  const available: Record<PaginationDirection, boolean> = {
    first: hasPreviousPage,
    last: hasNextPage,
    next: hasNextPage,
    prev: hasPreviousPage,
  };

  const move = (...args: [PaginationDirection, (string | undefined)?]) => {
    if (isBusy || !available[args[0]]) return;
    if (cursorKey !== null) setMovedFrom(cursorKey);
    onChange?.(...args);

    // The number of the page too - of an offset list, which knows it
    if (!isCursorMode && onPageChange) {
      const pages: Record<PaginationDirection, number> = {
        first: 1,
        last: lastPage ?? currentPage + 1,
        next: currentPage + 1,
        prev: Math.max(1, Math.min(currentPage - 1, lastPage ?? currentPage)),
      };
      onPageChange(pages[args[0]]);
    }
  };

  // Offset mode: straight to a page - a numbered one, or one typed in
  const goTo = (page: number) => {
    if (isBusy || isCursorMode || !Number.isFinite(page)) return;

    const target = Math.min(
      Math.max(Math.round(page), 1),
      lastPage ?? Math.max(Math.round(page), 1),
    );
    if (target !== currentPage) onPageChange?.(target);
  };

  const jump = () => {
    const page = Number.parseInt(jumpText, 10);
    if (Number.isNaN(page)) return;
    setJumpText("");
    goTo(page);
  };

  // An unavailable button is `disabled` - unless it has the focus, which it
  // keeps (`aria-disabled`) until the focus moves on. So is a busy one: a
  // pressed button keeps the focus while the page loads.
  const buttonProps = (direction: PaginationDirection) => {
    const isKept = !available[direction] && focused === direction;

    return {
      ...((isBusy || isKept) && {
        "aria-disabled": true,
        className: isKept
          ? "cursor-not-allowed opacity-60"
          : "cursor-wait opacity-60",
      }),
      disabled: !available[direction] && !isKept,
      onBlur: () => setFocused(null),
      onFocus: () => setFocused(direction),
    };
  };

  // Numbered pages need their count - a cursor connection has none
  const showPages =
    variant === "pages" && !isCursorMode && lastPage !== undefined;
  const pageItems = showPages
    ? getPageItems(
        Math.min(Math.max(currentPage, 1), lastPage),
        lastPage,
        Math.max(Math.floor(siblingCount), 0),
        Math.max(Math.floor(boundaryCount), 0),
      )
    : [];
  const hasPageSizeSelect = !!pageSizeOptions && pageSizeOptions.length > 0;
  const hasJumpTo = showJumpTo && !isCursorMode;
  // Square buttons of one height beside the numbers
  const pagesIconClass = showPages ? "h-7 w-7 justify-center px-0" : undefined;

  const pageButtons = pageItems.map((item) => {
    if (typeof item !== "number") {
      return (
        // The numbers around it tell the gap - no stop for screen readers
        <li
          aria-hidden="true"
          className="flex h-7 min-w-5 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400"
          key={item}
        >
          …
        </li>
      );
    }

    const isCurrent = item === currentPage;

    return (
      // Keyed by the number - the pressed page keeps its button and the focus
      <li className="flex items-center" key={item}>
        <Button
          aria-current={isCurrent ? "page" : undefined}
          aria-label={formatMessage(messages.pagination.page, {
            page: formatNumber(locale.code, item),
          })}
          className={cn(
            "h-7 min-w-7 justify-center px-1.5 tabular-nums",
            // Forced colors mode draws every button alike - the current
            // page in the colors of a selection
            isCurrent &&
              "forced-colors:border-[Highlight] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
            isBusy && "cursor-wait opacity-60",
          )}
          color={isCurrent ? "primary" : "default"}
          data-current={isCurrent ? "" : undefined}
          data-selected={isCurrent ? "" : undefined}
          onClick={() => goTo(item)}
          size="sm"
          {...(isBusy && { "aria-disabled": true })}
        >
          {formatNumber(locale.code, item)}
        </Button>
      </li>
    );
  });

  const list = (
    // Numbered pages wrap onto a second line on a phone
    <ul className={cn("flex items-center gap-1.5", showPages && "flex-wrap")}>
      {range && (
        <li className="me-1.25 flex items-center text-sm">
          <span aria-live="polite">{range}</span>
        </li>
      )}
      {/* The numbered pages have the first one */}
      {!showPages && (
        <li className="flex items-center">
          <Button
            aria-label={messages.pagination.first}
            color="default"
            onClick={() => move("first")}
            {...buttonProps("first")}
            size="sm"
          >
            <ChevronsLeft className={CHEVRON_CLASS} size={18} />
          </Button>
        </li>
      )}
      <li className="flex items-center">
        <Button
          aria-label={messages.pagination.previous}
          color="default"
          onClick={() => move("prev", pageInfo?.startCursor || undefined)}
          {...withClass(buttonProps("prev"), pagesIconClass)}
          size="sm"
        >
          <ChevronLeft className={CHEVRON_CLASS} size={18} />
        </Button>
      </li>
      {pageButtons}
      <li className="flex items-center">
        <Button
          aria-label={messages.pagination.next}
          color="default"
          onClick={() => move("next", pageInfo?.endCursor || undefined)}
          {...withClass(buttonProps("next"), pagesIconClass)}
          size="sm"
        >
          <ChevronRight className={CHEVRON_CLASS} size={18} />
        </Button>
      </li>
      {/* A cursor connection cannot jump to its end - the numbered pages
          have the last one */}
      {!isCursorMode && lastPage !== undefined && !showPages && (
        <li className="flex items-center">
          <Button
            aria-label={messages.pagination.last}
            color="default"
            onClick={() => move("last")}
            {...buttonProps("last")}
            size="sm"
          >
            <ChevronsRight className={CHEVRON_CLASS} size={18} />
          </Button>
        </li>
      )}
    </ul>
  );

  if (!hasPageSizeSelect && !hasJumpTo) {
    return (
      <nav
        aria-label={messages.pagination.label}
        {...props}
        className={className}
      >
        {list}
      </nav>
    );
  }

  const pageSizeId = `${controlsId}-page-size`;
  const jumpId = `${controlsId}-jump`;

  return (
    <nav
      aria-label={messages.pagination.label}
      {...props}
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}
    >
      {list}

      {hasPageSizeSelect && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={pageSizeId}>{messages.pagination.pageSize}</label>
          <Select
            dim="xs"
            id={pageSizeId}
            onChange={({ target }) => onPageSizeChange?.(Number(target.value))}
            options={pageSizeOptions.map((option) => ({
              label: formatNumber(locale.code, option),
              value: option,
            }))}
            value={pageSize}
          />
        </div>
      )}

      {hasJumpTo && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={jumpId}>{messages.pagination.goTo}</label>
          <input
            className="h-7 form-control w-16 px-1 py-0 text-sm tabular-nums"
            // Navigation is not a field of a form around the table: an
            // out-of-range page must not block that form's submission.
            form=""
            id={jumpId}
            inputMode="numeric"
            max={lastPage}
            min={1}
            onChange={(event) => setJumpText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) {
                return;
              }
              // Not the submit of a form around
              event.preventDefault();
              jump();
            }}
            type="number"
            value={jumpText}
          />
          <Button className="h-7" color="default" onClick={jump} size="sm">
            {messages.pagination.go}
          </Button>
        </div>
      )}
    </nav>
  );
}
