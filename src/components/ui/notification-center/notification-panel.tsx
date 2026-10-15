import { BellOff, Check, CheckCheck, CircleDot } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Avatar from "../avatar";
import Button from "../button";
import IconButton from "../icon-button";
import SegmentedControl from "../segmented-control";
import Skeleton from "../skeleton";
import cn from "../../../utils/cn";
import isPromiseLike from "../../../utils/is-promise-like";
import logger from "../../../utils/logger";
import { getTabbableElements } from "../../../utils/tabbable";
import useFormatDate from "../../../hooks/use-format-date";
import useFormatRelativeTime, {
  type FormatRelativeTime,
} from "../../../hooks/use-format-relative-time";
import { useMessages, useRouterActions } from "../../../providers/ui-context";
import type {
  NotificationFilter,
  NotificationId,
  NotificationItem,
} from "./types";

export interface NotificationPanelProps {
  absoluteAfterDays?: number;
  error?: boolean | string;
  filter: NotificationFilter;
  footer?: React.ReactNode;
  hasMore: boolean;
  heading: string;
  /** Whether the panel shows its heading - a Sheet has one of its own. */
  headingShown: boolean;
  infinite: boolean;
  loading: boolean;
  loadingMore: boolean;
  notifications: NotificationItem[];
  /** A notification was opened - the panel closes. */
  onActivate: () => void;
  onFilterChange: (filter: NotificationFilter) => void;
  onLoadMore?: () => unknown;
  onMarkAllRead?: () => void;
  onReadChange?: (notification: NotificationItem, read: boolean) => void;
  onRetry?: () => void;
  unread: number;
}

// The link or the button of the title covers the whole row - its focus ring
// is drawn by the row
const stretchedClassName =
  "text-start after:absolute after:inset-0 after:z-0 after:content-[''] focus:outline-hidden";

const toDate = (value: NotificationItem["time"]) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

interface NotificationRowProps {
  absoluteAfterDays?: number;
  formatTime: FormatRelativeTime;
  notification: NotificationItem;
  onOpen: (notification: NotificationItem) => void;
  onReadChange?: (notification: NotificationItem, read: boolean) => void;
}

/**
 * A notification of the list - a component of its own, so that the compiler
 * memoizes every row: a new notification renders that one, not the list.
 */
function NotificationRow({
  absoluteAfterDays,
  formatTime,
  notification,
  onOpen,
  onReadChange,
}: NotificationRowProps) {
  const messages = useMessages().ui.notificationCenter;
  const { Link } = useRouterActions();
  const formatDate = useFormatDate();
  const id = useId();
  const { actions, avatar, body, href, icon, read, title } = notification;
  const unread = !read;
  const date = toDate(notification.time);
  const bodyId = body ? `${id}-body` : undefined;
  const timeId = `${id}-time`;
  const isOpenable = href !== undefined || notification.onClick !== undefined;

  const titleContent = (
    <>
      {/* Read before the title - the dot is for the eye. The space is
          collapsed at the start of the line. */}
      {unread && (
        <>
          <span className="sr-only">{messages.unread}</span>{" "}
        </>
      )}
      {title}
    </>
  );

  const primaryProps = {
    // The text and the time describe it - the title names it
    "aria-describedby": [bodyId, timeId].filter(Boolean).join(" "),
    "data-notification-primary": "",
    onClick: () => onOpen(notification),
  };

  return (
    <li
      className={cn(
        "relative flex gap-3 px-4 py-3 transition-colors motion-reduce:transition-none",
        unread && "bg-primary-50/70 dark:bg-primary-950/40",
        isOpenable && "hover:bg-neutral-50 dark:hover:bg-neutral-800/60",
        // The ring of the stretched link, inside the row
        "has-[[data-notification-primary]:focus-visible]:ring-2 has-[[data-notification-primary]:focus-visible]:ring-primary-500 has-[[data-notification-primary]:focus-visible]:ring-inset forced-colors:has-[[data-notification-primary]:focus-visible]:outline-2 forced-colors:has-[[data-notification-primary]:focus-visible]:-outline-offset-2",
      )}
      data-notification=""
      data-state={unread ? "unread" : "read"}
    >
      {unread && (
        <span
          aria-hidden="true"
          className="absolute inset-s-1.5 top-5 size-2 rounded-full bg-primary-600 forced-color-adjust-none dark:bg-primary-400"
        />
      )}
      {avatar ? (
        <Avatar
          aria-hidden="true"
          className="shrink-0"
          name={avatar.name}
          size="md"
          src={avatar.src}
        />
      ) : (
        icon && (
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 [&_svg]:size-4"
          >
            {icon}
          </span>
        )
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm wrap-break-word",
            unread
              ? "font-semibold text-neutral-900 dark:text-neutral-100"
              : "font-medium text-neutral-700 dark:text-neutral-300",
          )}
        >
          {href !== undefined ? (
            <Link {...primaryProps} className={stretchedClassName} href={href}>
              {titleContent}
            </Link>
          ) : notification.onClick ? (
            <button
              {...primaryProps}
              className={cn(stretchedClassName, "cursor-pointer")}
              type="button"
            >
              {titleContent}
            </button>
          ) : (
            titleContent
          )}
        </p>
        {body && (
          <div
            className="mt-0.5 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400"
            id={bodyId}
          >
            {body}
          </div>
        )}
        <time
          className="mt-1 block text-xs text-neutral-600 dark:text-neutral-400"
          dateTime={date?.toISOString()}
          id={timeId}
          title={date ? formatDate(date, "dateTime") : undefined}
        >
          {formatTime(date, { absoluteAfterDays })}
        </time>
        {actions && actions.length > 0 && (
          // Above the stretched link of the title
          <div className="relative z-10 mt-2 flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <Button
                color={action.color ?? "default"}
                key={index}
                onClick={action.onClick}
                size="sm"
                startIcon={action.icon}
                variant="outline"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {onReadChange && (
        <IconButton
          aria-label={unread ? messages.markRead : messages.markUnread}
          className="relative z-10 self-start"
          onClick={() => onReadChange(notification, unread)}
          size="sm"
          tooltip
          tooltipPosition="start"
        >
          {unread ? <Check /> : <CircleDot />}
        </IconButton>
      )}
    </li>
  );
}

/** Placeholders of the rows while the notifications load. */
function LoadingRows({ label }: { label: string }) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex gap-3 px-4 py-3" key={index}>
          <Skeleton
            className="shrink-0"
            height="h-8"
            variant="circle"
            width="w-8"
          />
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            <Skeleton variant="text" width="w-3/4" />
            <Skeleton lines={2} variant="text" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The content of the panel of `NotificationCenter` - its toolbar, the list
 * with its states, and the footer.
 */
export default function NotificationPanel({
  absoluteAfterDays,
  error,
  filter,
  footer,
  hasMore,
  heading,
  headingShown,
  infinite,
  loading,
  loadingMore,
  notifications,
  onActivate,
  onFilterChange,
  onLoadMore,
  onMarkAllRead,
  onReadChange,
  onRetry,
  unread,
}: NotificationPanelProps) {
  const ui = useMessages().ui;
  const messages = ui.notificationCenter;
  const formatTime = useFormatRelativeTime();
  const headingId = useId();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // A promise of `onLoadMore` is pending
  const [pending, setPending] = useState(false);
  // The notifications read while the Unread filter shows them - they stay
  // until the filter changes, so the row and the focus in it do not vanish
  const [kept, setKept] = useState<ReadonlySet<NotificationId>>(
    () => new Set(),
  );

  const busy = loadingMore || pending;
  const failed = error !== undefined && error !== false;
  const errorText = typeof error === "string" && error ? error : messages.error;

  const shown =
    filter === "unread"
      ? notifications.filter((item) => !item.read || kept.has(item.id))
      : notifications;

  const keep = (notification: NotificationItem) => {
    if (filter === "unread" && !notification.read) {
      setKept((current) => new Set(current).add(notification.id));
    }
  };

  const changeFilter = (next: NotificationFilter) => {
    setKept(new Set());
    onFilterChange(next);
  };

  const handleReadChange =
    onReadChange &&
    ((notification: NotificationItem, read: boolean) => {
      if (read) keep(notification);
      onReadChange(notification, read);
    });

  const open = (notification: NotificationItem) => {
    if (!notification.read) {
      keep(notification);
      onReadChange?.(notification, true);
    }
    notification.onClick?.();
    onActivate();
  };

  const loadMore = () => {
    if (busy || !onLoadMore) return;
    const result = onLoadMore();
    if (!isPromiseLike(result)) return;

    setPending(true);
    Promise.resolve(result).then(
      () => setPending(false),
      (reason: unknown) => {
        setPending(false);
        logger.error("The onLoadMore of NotificationCenter failed.", reason);
      },
    );
  };

  // The latest `loadMore` - for the observer below
  const loadMoreRef = useRef(loadMore);

  useLayoutEffect(() => {
    loadMoreRef.current = loadMore;
  });

  // Infinite: the end of the list scrolled into view loads more
  const canLoadMore =
    infinite && hasMore && !busy && !failed && !loading && shown.length > 0;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (
      !canLoadMore ||
      !sentinel ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreRef.current();
        }
      },
      { root: listRef.current, rootMargin: "0px 0px 120px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, shown.length]);

  // The arrow keys, Home and End move between the notifications - Tab
  // goes through their controls
  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const key = event.key;
    if (
      key !== "ArrowDown" &&
      key !== "ArrowUp" &&
      key !== "Home" &&
      key !== "End"
    ) {
      return;
    }
    const rows = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        "[data-notification]",
      ),
    ];
    const current = (event.target as Element).closest<HTMLElement>(
      "[data-notification]",
    );
    const index = current ? rows.indexOf(current) : -1;
    if (index === -1) return;

    const nextIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? rows.length - 1
          : Math.min(
              Math.max(index + (key === "ArrowDown" ? 1 : -1), 0),
              rows.length - 1,
            );
    const row = rows[nextIndex];
    const target =
      row.querySelector<HTMLElement>("[data-notification-primary]") ??
      getTabbableElements(row)[0];
    event.preventDefault();
    target?.focus();
  };

  const markAllRead = () => {
    onMarkAllRead?.();
    // The button disables - the focus goes to the list, not to the page
    listRef.current?.focus({ preventScroll: true });
  };

  let content: React.ReactNode;
  if (loading) {
    content = <LoadingRows label={ui.common.loading} />;
  } else if (shown.length === 0 && failed) {
    content = (
      <div className="px-4 py-8 text-center" role="alert">
        <p className="text-sm text-danger-700 dark:text-danger-400">
          {errorText}
        </p>
        {onRetry && (
          <Button
            className="mt-3"
            onClick={onRetry}
            size="sm"
            variant="outline"
          >
            {messages.retry}
          </Button>
        )}
      </div>
    );
  } else if (shown.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-neutral-600 dark:text-neutral-400">
        <BellOff aria-hidden="true" className="text-neutral-400" size={28} />
        {filter === "unread" ? messages.emptyUnread : messages.empty}
      </div>
    );
  } else {
    content = (
      <>
        <ul
          aria-busy={busy || undefined}
          aria-labelledby={headingShown ? headingId : undefined}
          aria-label={headingShown ? undefined : heading}
          className="divide-y divide-neutral-100 dark:divide-neutral-800"
          id={listId}
          onKeyDown={handleListKeyDown}
        >
          {shown.map((notification) => (
            <NotificationRow
              absoluteAfterDays={absoluteAfterDays}
              formatTime={formatTime}
              key={notification.id}
              notification={notification}
              onOpen={open}
              onReadChange={handleReadChange}
            />
          ))}
        </ul>
        {failed ? (
          <div
            className="flex flex-wrap items-center justify-center gap-3 border-t border-neutral-100 px-4 py-3 dark:border-neutral-800"
            role="alert"
          >
            <span className="text-sm text-danger-700 dark:text-danger-400">
              {errorText}
            </span>
            {onRetry && (
              <Button onClick={onRetry} size="sm" variant="outline">
                {messages.retry}
              </Button>
            )}
          </div>
        ) : (
          hasMore &&
          onLoadMore && (
            <div className="border-t border-neutral-100 p-2 dark:border-neutral-800">
              <div aria-hidden="true" ref={sentinelRef} />
              <Button
                fullWidth
                loading={busy}
                onClick={loadMore}
                size="sm"
                variant="ghost"
              >
                {messages.loadMore}
              </Button>
            </div>
          )
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        {headingShown && (
          <h2
            className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            id={headingId}
          >
            {heading}
          </h2>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <SegmentedControl<NotificationFilter>
            aria-label={messages.filter}
            onChange={changeFilter}
            options={[
              { label: messages.filterAll, value: "all" },
              { label: messages.filterUnread, value: "unread" },
            ]}
            size="sm"
            value={filter}
          />
          {onMarkAllRead && (
            <Button
              disabled={unread === 0 || loading}
              onClick={markAllRead}
              size="sm"
              startIcon={<CheckCheck size={16} />}
              variant="link"
            >
              {messages.markAllRead}
            </Button>
          )}
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-hidden"
        ref={listRef}
        tabIndex={-1}
      >
        {content}
      </div>
      {footer && (
        <div className="border-t border-neutral-100 px-4 py-2 text-sm dark:border-neutral-800">
          {footer}
        </div>
      )}
    </div>
  );
}
