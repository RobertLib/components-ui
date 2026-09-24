import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Button from "./button";
import { useState } from "react";
import { formatMessage, formatNumber } from "../i18n/format";
import { useLocale } from "../providers/ui-context";

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
  /** 1-based number of the shown page. */
  currentPage?: number;
  /**
   * Called with the requested direction. In cursor mode the second argument
   * is the cursor to continue from (`startCursor` for `prev`, `endCursor`
   * for `next`).
   */
  onChange: (direction: PaginationDirection, cursor?: string) => void;
  /**
   * The requested page is loading - the buttons do nothing meanwhile (they
   * stay focusable). In cursor mode they also wait after a move until a new
   * `pageInfo` arrives, since the old cursors would page from the old page.
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
 * First / previous / next (/ last) buttons with the shown range. Works with
 * cursor pagination (GraphQL connections) and offset pagination (REST). A
 * button that becomes unavailable while it has the focus (Last page, Next
 * onto the last page) keeps the focus, announced as unavailable, until the
 * focus moves on.
 */
export default function Pagination({
  currentPage = 1,
  loading = false,
  onChange,
  pageInfo,
  pageSize = 20,
  total,
  ...props
}: PaginationProps) {
  const locale = useLocale();
  const { messages } = locale;

  const isCursorMode = pageInfo !== undefined;

  // The cursors a move started from - until `pageInfo` brings others (or a
  // load ends, e.g. with an error) they would repeat the same move
  const cursorKey = pageInfo
    ? `${pageInfo.startCursor ?? ""}\n${pageInfo.endCursor ?? ""}`
    : null;
  const [movedFrom, setMovedFrom] = useState<string | null>(null);
  const [wasLoading, setWasLoading] = useState(loading);

  if (wasLoading !== loading) {
    setWasLoading(loading);
    if (!loading) setMovedFrom(null);
  }
  if (movedFrom !== null && movedFrom !== cursorKey) setMovedFrom(null);

  const isBusy = loading || (movedFrom !== null && movedFrom === cursorKey);

  // The button with the focus - one that becomes unavailable (the last page
  // reached) must not drop it to the page
  const [focused, setFocused] = useState<PaginationDirection | null>(null);

  const lastPage =
    total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;

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
    if (args[1] && cursorKey !== null) setMovedFrom(cursorKey);
    onChange(...args);
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

  return (
    <nav aria-label={messages.pagination.label} {...props}>
      <ul className="flex items-center gap-1.5">
        {range && (
          <li className="mr-1.25 flex items-center text-sm">
            <span aria-live="polite">{range}</span>
          </li>
        )}
        <li className="flex items-center">
          <Button
            aria-label={messages.pagination.first}
            color="default"
            onClick={() => move("first")}
            {...buttonProps("first")}
            size="sm"
          >
            <ChevronsLeft size={18} />
          </Button>
        </li>
        <li className="flex items-center">
          <Button
            aria-label={messages.pagination.previous}
            color="default"
            onClick={() => move("prev", pageInfo?.startCursor || undefined)}
            {...buttonProps("prev")}
            size="sm"
          >
            <ChevronLeft size={18} />
          </Button>
        </li>
        <li className="flex items-center">
          <Button
            aria-label={messages.pagination.next}
            color="default"
            onClick={() => move("next", pageInfo?.endCursor || undefined)}
            {...buttonProps("next")}
            size="sm"
          >
            <ChevronRight size={18} />
          </Button>
        </li>
        {/* A cursor connection cannot jump to its end */}
        {!isCursorMode && lastPage !== undefined && (
          <li className="flex items-center">
            <Button
              aria-label={messages.pagination.last}
              color="default"
              onClick={() => move("last")}
              {...buttonProps("last")}
              size="sm"
            >
              <ChevronsRight size={18} />
            </Button>
          </li>
        )}
      </ul>
    </nav>
  );
}
