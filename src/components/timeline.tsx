import cn from "../utils/cn";
import { toIntlLocale } from "../i18n/format";
import type { Locale } from "../i18n/types";
import { useLocale } from "../providers/ui-context";
import { usesHour12 } from "../utils/date";

export type TimelineColor =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral";

/** One event of the timeline - who did what and when. */
export interface TimelineItem {
  /**
   * Color of the marker - e.g. `success` for an approval, `danger` for a
   * deletion. Say in the title what it means: screen readers do not see it.
   */
  color?: TimelineColor;
  /** More under the description - e.g. the changed values or a comment. */
  content?: React.ReactNode;
  /** A line of detail under the title. */
  description?: React.ReactNode;
  /**
   * Shown in the marker instead of a dot: an icon - a lucide-react icon is
   * sized to the marker - or small content such as an `Avatar`. Decorative:
   * say in the title what it shows.
   */
  icon?: React.ReactNode;
  /** Unique id of the item - its index when left out. */
  id?: string | number;
  /**
   * Not done yet, e.g. an approval nobody has given: the marker spins (or
   * shows the `icon` in a dashed circle) and the line to the item is dashed.
   * Screen readers hear "Pending" after the title.
   */
  pending?: boolean;
  /**
   * When it happened - a `Date` is written by the locale (see
   * `timeFormat`) in a `<time>` element, a string is shown as it is (e.g.
   * "2 hours ago").
   */
  time?: Date | string;
  /** What happened, e.g. "Jana Nováková approved the order". */
  title: React.ReactNode;
}

export interface TimelineProps extends React.ComponentProps<"ol"> {
  /**
   * Puts the items on both sides of the line in turn, with their time on
   * the other side. On phones (below the `md` breakpoint) they stay on one
   * side.
   */
  alternate?: boolean;
  /** The events, in the order they are listed - newest or oldest first. */
  items: TimelineItem[];
  /** Shows placeholder items, e.g. while the history loads. */
  loading?: boolean;
  /** Number of placeholder items while `loading`. */
  loadingItemsCount?: number;
  /** `sm` - compact: smaller markers and less space between the items. */
  size?: "sm" | "md";
  /**
   * `Intl.DateTimeFormat` options of the times given as dates - the medium
   * date and the short time on the clock of the locale by default, e.g.
   * `{ timeStyle: "short" }` for the time alone. Rendered on the server,
   * add the `timeZone` of the user - the server writes its own otherwise.
   */
  timeFormat?: Intl.DateTimeFormatOptions;
}

const DEFAULT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

/** Writes the times given as dates - on the clock of the locale. */
const createTimeFormat = (
  locale: Locale,
  options: Intl.DateTimeFormatOptions = DEFAULT_TIME_FORMAT,
) =>
  new Intl.DateTimeFormat(toIntlLocale(locale.code), {
    // The locale's time format decides - `h:mm A` is the 12-hour clock.
    // An `hour12` of the options wins over it.
    hourCycle: usesHour12(locale.formats.time) ? "h12" : "h23",
    ...options,
  });

const sizeClasses = {
  sm: {
    // The space before the dot - centered where an icon marker would be
    dotOffset: "h-2",
    dot: "h-2 w-2",
    gap: "pb-3",
    // An svg icon (and the spinner) sized to the marker
    icon: "h-6 w-6 [&>svg]:size-3.5",
    rail: "w-6",
    // The first line of the text centered on the marker
    text: "pt-0.5",
  },
  md: {
    dotOffset: "h-[11px]",
    dot: "h-2.5 w-2.5",
    gap: "pb-6",
    icon: "h-8 w-8 [&>svg]:size-4",
    rail: "w-8",
    text: "pt-1.5",
  },
};

type SizeClasses = (typeof sizeClasses)[keyof typeof sizeClasses];

const dotColors: Record<TimelineColor, string> = {
  primary: "bg-primary-500",
  secondary: "bg-secondary-500",
  success: "bg-success-600 dark:bg-success-500",
  danger: "bg-danger-500",
  warning: "bg-warning-700 dark:bg-warning-500",
  info: "bg-info-600 dark:bg-info-500",
  neutral: "bg-neutral-500",
};

const iconColors: Record<TimelineColor, string> = {
  primary:
    "border-primary-200 bg-primary-50 text-primary-600 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-300",
  secondary:
    "border-secondary-200 bg-secondary-50 text-secondary-600 dark:border-secondary-700 dark:bg-secondary-900 dark:text-secondary-300",
  success:
    "border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950 dark:text-success-300",
  danger:
    "border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-950 dark:text-danger-300",
  warning:
    "border-warning-300 bg-warning-50 text-warning-700 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-300",
  info: "border-info-200 bg-info-50 text-info-700 dark:border-info-800 dark:bg-info-950 dark:text-info-300",
  neutral:
    "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
};

/** A part of the line between the markers - dashed next to a pending item. */
const lineClassName = (visible: boolean, dashed: boolean) =>
  cn(
    "w-0.5",
    visible &&
      (dashed
        ? "border-s-2 border-dashed border-neutral-300 dark:border-neutral-600"
        : "bg-neutral-200 dark:bg-neutral-700"),
  );

// Predefined widths of the placeholder titles to ensure the classes exist
const skeletonWidths = ["w-48", "w-64", "w-40", "w-56"];

/** The dot, the icon or the spinner of an item. */
function TimelineMarker({
  item,
  sizes,
}: {
  item: TimelineItem;
  sizes: SizeClasses;
}) {
  if (item.pending) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400",
          sizes.icon,
        )}
      >
        {item.icon ?? (
          <svg
            className="animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              fill="currentColor"
            />
          </svg>
        )}
      </span>
    );
  }

  const color = item.color ?? "primary";

  if (item.icon) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border",
          iconColors[color],
          sizes.icon,
        )}
      >
        {item.icon}
      </span>
    );
  }

  return (
    <span
      className={cn("shrink-0 rounded-full", dotColors[color], sizes.dot)}
    />
  );
}

/** Whether there is something to render - `false`, `null` and `""` are not. */
const isShown = (node: React.ReactNode) =>
  node !== undefined &&
  node !== null &&
  node !== "" &&
  typeof node !== "boolean";

/** Whether an item has a time to show - an invalid date would throw. */
const hasTime = (time: Date | string | undefined): time is Date | string =>
  typeof time === "string"
    ? time !== ""
    : !!time && !Number.isNaN(time.getTime());

/** The time of an item - a date in a `<time>` element. */
function TimelineTime({
  className,
  format,
  time,
}: {
  className?: string;
  format: Intl.DateTimeFormat;
  time: Date | string;
}) {
  if (typeof time === "string") {
    return <span className={className}>{time}</span>;
  }

  return (
    <time className={className} dateTime={time.toISOString()}>
      {format.format(time)}
    </time>
  );
}

/**
 * Events in order along a line - an activity or audit log of who changed
 * what and when. Each item has a title, a time, an optional description,
 * content, icon and color; a `pending` one is still to come. An ordered
 * list; `alternate` puts the items on both sides of the line.
 */
export default function Timeline({
  alternate = false,
  className,
  items,
  loading = false,
  loadingItemsCount = 3,
  size = "md",
  timeFormat,
  ...props
}: TimelineProps) {
  const locale = useLocale();
  const sizes = sizeClasses[size];
  const format = createTimeFormat(locale, timeFormat);

  return (
    <ol
      aria-busy={loading || undefined}
      // Safari drops the list semantics of a list without bullets
      role="list"
      {...props}
      className={cn("text-sm", className)}
    >
      {loading
        ? Array.from({ length: loadingItemsCount }, (_, index) => {
            const isLast = index === loadingItemsCount - 1;

            return (
              <li
                aria-hidden="true"
                className="flex gap-3"
                key={`skeleton-${index}`}
              >
                <div
                  className={cn(
                    "flex shrink-0 flex-col items-center",
                    sizes.rail,
                  )}
                >
                  <div className={cn("shrink-0", sizes.dotOffset)} />
                  <span
                    className={cn(
                      "shrink-0 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800",
                      sizes.dot,
                    )}
                  />
                  <div
                    className={cn(
                      "w-0.5 flex-1",
                      !isLast && "bg-neutral-100 dark:bg-neutral-900",
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 space-y-2",
                    sizes.text,
                    !isLast && sizes.gap,
                  )}
                >
                  <div
                    className={cn(
                      "h-3.5 max-w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-900",
                      skeletonWidths[index % skeletonWidths.length],
                    )}
                  />
                  <div className="h-3 w-32 max-w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
                </div>
              </li>
            );
          })
        : items.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === items.length - 1;
            // Alternating sides - the first item on the right of the line
            const isLeft = alternate && index % 2 === 1;
            const hasIconMarker = !!item.icon || !!item.pending;
            const previous = items[index - 1];
            const next = items[index + 1];

            const time = hasTime(item.time) ? item.time : undefined;

            return (
              <li
                className={cn(
                  "flex gap-3",
                  alternate &&
                    "md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-4",
                )}
                key={item.id ?? index}
              >
                {/* The marker and the line through it - decorative */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex shrink-0 flex-col items-center",
                    sizes.rail,
                    alternate && "md:col-start-2 md:row-start-1",
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0",
                      !hasIconMarker && sizes.dotOffset,
                      lineClassName(
                        !isFirst,
                        !!item.pending || !!previous?.pending,
                      ),
                    )}
                  />
                  <TimelineMarker item={item} sizes={sizes} />
                  <div
                    className={cn(
                      "flex-1",
                      lineClassName(!isLast, !!item.pending || !!next?.pending),
                    )}
                  />
                </div>

                <div
                  className={cn(
                    "min-w-0 flex-1",
                    sizes.text,
                    !isLast && sizes.gap,
                    alternate &&
                      (isLeft
                        ? "md:col-start-1 md:row-start-1 md:text-end"
                        : "md:col-start-3 md:row-start-1"),
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <div
                      className={cn(
                        "min-w-0 grow font-medium",
                        item.pending
                          ? "text-neutral-500 dark:text-neutral-400"
                          : "text-neutral-900 dark:text-neutral-100",
                      )}
                    >
                      {item.title}
                      {item.pending && (
                        <span className="sr-only">
                          , {locale.messages.timeline.pending}
                        </span>
                      )}
                    </div>
                    {time !== undefined && (
                      <TimelineTime
                        className={cn(
                          "shrink-0 text-xs whitespace-nowrap text-neutral-500 dark:text-neutral-400",
                          alternate && "md:hidden",
                        )}
                        format={format}
                        time={time}
                      />
                    )}
                  </div>
                  {isShown(item.description) && (
                    <div className="mt-0.5 text-neutral-500 dark:text-neutral-400">
                      {item.description}
                    </div>
                  )}
                  {isShown(item.content) && (
                    <div className="mt-2">{item.content}</div>
                  )}
                </div>

                {/* The time across the line from the item - one of the two
                    is displayed, the other is not even read */}
                {alternate && time !== undefined && (
                  <div
                    className={cn(
                      "hidden md:block",
                      sizes.text,
                      isLeft
                        ? "md:col-start-3 md:row-start-1"
                        : "md:col-start-1 md:row-start-1 md:text-end",
                    )}
                  >
                    <TimelineTime
                      className="text-xs leading-5 whitespace-nowrap text-neutral-500 dark:text-neutral-400"
                      format={format}
                      time={time}
                    />
                  </div>
                )}
              </li>
            );
          })}
    </ol>
  );
}
