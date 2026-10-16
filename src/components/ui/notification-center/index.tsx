import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Badge from "../badge";
import IconButton from "../icon-button";
import Popover from "../popover";
import Sheet from "../sheet";
import NotificationPanel from "./notification-panel";
import cn from "../../../utils/cn";
import { formatPlural } from "../../../i18n/ui/format";
import useIsMobile from "../../../hooks/use-is-mobile";
import isPromiseLike from "../../../utils/is-promise-like";
import logger from "../../../utils/logger";
import { useLocale } from "../../../providers/ui-context";
import type { NotificationFilter, NotificationItem } from "./types";

export type {
  NotificationAction,
  NotificationFilter,
  NotificationId,
  NotificationItem,
} from "./types";

export interface NotificationCenterProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "title"
> {
  /**
   * Past this many days a time is written as a date and time instead of
   * "3 weeks ago".
   */
  absoluteAfterDays?: number;
  /** Uncontrolled: the filter the list starts with. @default "all" */
  defaultFilter?: NotificationFilter;
  /** Uncontrolled: whether the panel starts open. */
  defaultOpen?: boolean;
  /**
   * Loading the notifications failed - the message (a text of your own or
   * the localized one) with "Try again" (`onRetry`): in place of the list,
   * or at its end when some notifications are shown (loading more failed).
   */
  error?: boolean | string;
  /**
   * Shows the notifications of a filter - All or Unread. The list filters
   * the notifications it has; `onFilterChange` may load others.
   */
  filter?: NotificationFilter;
  /** Content at the bottom of the panel - e.g. a link to all notifications. */
  footer?: React.ReactNode;
  /** More notifications can be loaded by `onLoadMore`. */
  hasMore?: boolean;
  /**
   * Loads more as the end of the list scrolls into view - "Load more" at
   * its end does it too.
   * @default true
   */
  infinite?: boolean;
  /** The first notifications load - placeholder rows are shown. */
  loading?: boolean;
  /** `onLoadMore` runs - a spinner on "Load more". */
  loadingMore?: boolean;
  /**
   * The largest count the badge shows as it is - a larger one is "99+".
   * @default 99
   */
  max?: number;
  /**
   * The notifications, newest first - controlled by the app, which adds
   * new ones as they come (e.g. from a WebSocket).
   */
  notifications: NotificationItem[];
  /** Called with the filter the user chose. */
  onFilterChange?: (filter: NotificationFilter) => void;
  /**
   * Loads older notifications - "Load more", or the end of the list
   * scrolled into view. While a returned promise is pending (or
   * `loadingMore`), it is not called again - also once the panel is closed
   * and opened again.
   */
  onLoadMore?: () => unknown;
  /** "Mark all as read" - without it the button is not shown. */
  onMarkAllRead?: () => void;
  /** Called when the panel opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Called with a notification and whether it is read now - by its button,
   * and as an unread one is opened. Without it the rows have no button.
   */
  onReadChange?: (notification: NotificationItem, read: boolean) => void;
  /** "Try again" after an `error`. */
  onRetry?: () => void;
  /** Controls whether the panel is open. */
  open?: boolean;
  /** Heading of the panel and name of the bell - the localized "Notifications". */
  title?: string;
  /**
   * The unread notifications in all - also those not loaded yet. The unread
   * among `notifications` by default.
   */
  unreadCount?: number;
}

// New notifications in a burst are announced once - after this pause
const ANNOUNCE_DELAY = 1500;

/**
 * A bell with the count of unread notifications - for the `actions` of a
 * `Navbar` - that opens them in a panel: a popover, a sheet from the bottom
 * on phones. The list shows a title, a text, the time, an icon or an avatar
 * of each notification, marks the unread ones, opens a notification by its
 * `href` or `onClick`, and has All / Unread filters, "Mark all as read",
 * a button that marks one read or unread, and "Load more" (also as the list
 * scrolls). The notifications come from the app, which also handles new
 * ones; screen readers hear a new unread count. `ref` and the other props
 * go to the wrapper around the bell.
 */
export default function NotificationCenter({
  absoluteAfterDays,
  className,
  defaultFilter = "all",
  defaultOpen = false,
  error,
  filter: filterProp,
  footer,
  hasMore = false,
  infinite = true,
  loading = false,
  loadingMore = false,
  max = 99,
  notifications,
  onFilterChange,
  onLoadMore,
  onMarkAllRead,
  onOpenChange,
  onReadChange,
  onRetry,
  open: openProp,
  title,
  unreadCount,
  ...props
}: NotificationCenterProps) {
  const locale = useLocale();
  const messages = locale.messages.ui.notificationCenter;
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = openProp ?? internalOpen;
  const [internalFilter, setInternalFilter] = useState(defaultFilter);
  const filter = filterProp ?? internalFilter;

  const heading = title ?? messages.title;
  const unread =
    unreadCount ??
    notifications.filter((notification) => !notification.read).length;

  const changeOpen = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    if (next !== isOpen) onOpenChange?.(next);
  };

  const changeFilter = (next: NotificationFilter) => {
    if (filterProp === undefined) setInternalFilter(next);
    onFilterChange?.(next);
  };

  // A promise of `onLoadMore` is pending - kept here, as the panel is gone
  // while closed: opened again meanwhile, it does not load the same again
  const [pending, setPending] = useState(false);
  const busy = loadingMore || pending;

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

  // A new unread count, announced once a burst of notifications settles -
  // not the count of the first load, nor a count going down
  const [announcement, setAnnouncement] = useState({ id: 0, text: "" });
  const previousRef = useRef({ loading, unread });

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { loading, unread };
    if (loading || previous.loading || unread <= previous.unread) return;

    const timer = setTimeout(
      () =>
        setAnnouncement((current) => ({
          id: current.id + 1,
          text: formatPlural(locale.code, messages.unreadCount, unread),
        })),
      ANNOUNCE_DELAY,
    );
    return () => clearTimeout(timer);
  }, [loading, locale.code, messages.unreadCount, unread]);

  const bellLabel =
    unread > 0
      ? formatPlural(locale.code, messages.unreadLabel, unread)
      : heading;

  const bell = (
    <IconButton aria-label={bellLabel} size="md" tooltip>
      {/* Decorative - the count is in the name of the button */}
      <Badge count={unread} max={max} size="sm">
        <Bell />
      </Badge>
    </IconButton>
  );

  const panel = (
    <NotificationPanel
      absoluteAfterDays={absoluteAfterDays}
      error={error}
      filter={filter}
      footer={footer}
      hasMore={hasMore}
      heading={heading}
      headingShown={!isMobile}
      infinite={infinite}
      loading={loading}
      loadingMore={busy}
      notifications={notifications}
      onActivate={() => changeOpen(false)}
      onFilterChange={changeFilter}
      onLoadMore={onLoadMore && loadMore}
      onMarkAllRead={onMarkAllRead}
      onReadChange={onReadChange}
      onRetry={onRetry}
      unread={unread}
    />
  );

  return (
    <div {...props} className={cn("relative inline-flex", className)}>
      {isMobile ? (
        <>
          <IconButton
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-label={bellLabel}
            data-state={isOpen ? "open" : "closed"}
            onClick={() => changeOpen(!isOpen)}
            size="md"
          >
            <Badge count={unread} max={max} size="sm">
              <Bell />
            </Badge>
          </IconButton>
          <Sheet
            bodyClassName="flex flex-col overflow-hidden p-0"
            closeOnBackdropClick
            onClose={() => changeOpen(false)}
            open={isOpen}
            side="bottom"
            size="xl"
            title={heading}
          >
            {panel}
          </Sheet>
        </>
      ) : (
        <Popover
          align="end"
          buttonTrigger
          contentClassName="flex max-h-[min(36rem,80vh)] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden"
          contentLabel={heading}
          onOpenChange={changeOpen}
          open={isOpen}
          position="bottom"
          trigger={bell}
          triggerType="click"
          width="auto"
        >
          {panel}
        </Popover>
      )}

      {/* Beside the bell - in the page while the panel is closed */}
      <span aria-live="polite" className="sr-only">
        <span key={announcement.id}>{announcement.text}</span>
      </span>
    </div>
  );
}
