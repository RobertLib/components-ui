import cn from "../../utils/cn";
import { formatMessage, formatNumber } from "../../i18n/ui/format";
import { useLocale } from "../../providers/ui-context";

export type BadgeColor =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral";

export type BadgePlacement =
  "top-end" | "top-start" | "bottom-end" | "bottom-start";

export interface BadgeProps extends Omit<
  React.ComponentProps<"span">,
  "color"
> {
  /**
   * What the badge marks - an icon, an `Avatar`, a button. The badge sits
   * on its corner (see `placement`). Without children the badge stands on
   * its own, e.g. after the text of a menu item.
   */
  children?: React.ReactNode;
  /**
   * Color of the badge - its text stands out from it by at least 4.5:1.
   * @default "danger"
   */
  color?: BadgeColor;
  /**
   * The number shown - `max` limits it ("99+"). A 0 hides the badge, unless
   * `showZero`.
   */
  count?: number;
  /** A small dot instead of the number - "something new", without a count. */
  dot?: boolean;
  /**
   * Hides the badge - it shrinks away (fades for users who prefer reduced
   * motion) and comes back when this turns `false` again.
   */
  invisible?: boolean;
  /**
   * Accessible text of the badge, rendered visually hidden - e.g. "3 unread
   * messages". The badge is decorative without it: say what it says in the
   * name of the element it marks instead (`aria-label` of the button).
   */
  label?: string;
  /**
   * The largest count shown as it is - a larger one is "99+".
   * @default 99
   */
  max?: number;
  /**
   * `circular` pulls the badge in from the corner of the box onto the edge
   * of a round child, e.g. an `Avatar`.
   * @default "rectangular"
   */
  overlap?: "rectangular" | "circular";
  /**
   * The corner of the child the badge sits on - the start and the end are
   * the left and the right in a left-to-right page, swapped in a
   * right-to-left one.
   * @default "top-end"
   */
  placement?: BadgePlacement;
  /** Shows a count of 0 instead of hiding the badge. */
  showZero?: boolean;
  /**
   * Height and text size of the badge.
   * @default "md"
   */
  size?: "sm" | "md";
}

// The text stands out from the fill by at least 4.5:1, in the light and
// the dark - warning is yellow, with dark text
const colorClasses: Record<BadgeColor, string> = {
  danger: "bg-danger-600 text-white",
  info: "bg-info-700 text-white",
  neutral: "bg-neutral-600 text-white dark:bg-neutral-500",
  primary: "bg-primary-600 text-white",
  secondary: "bg-secondary-600 text-white",
  success: "bg-success-700 text-white",
  warning: "bg-warning-400 text-warning-950",
};

const sizeClasses = {
  md: { count: "h-5 min-w-5 px-1.5 text-xs", dot: "size-2.5" },
  sm: { count: "h-4 min-w-4 px-1 text-[10px]", dot: "size-2" },
};

// On the corner of the child - half of the badge outside of it. The start
// and the end swap in a right-to-left page, the shift across with them.
const placementClasses: Record<
  BadgePlacement,
  Record<"circular" | "rectangular", string>
> = {
  "bottom-end": {
    circular:
      "inset-e-[14%] bottom-[14%] translate-x-1/2 translate-y-1/2 origin-bottom-right rtl:-translate-x-1/2 rtl:origin-bottom-left",
    rectangular:
      "inset-e-0 bottom-0 translate-x-1/2 translate-y-1/2 origin-bottom-right rtl:-translate-x-1/2 rtl:origin-bottom-left",
  },
  "bottom-start": {
    circular:
      "inset-s-[14%] bottom-[14%] -translate-x-1/2 translate-y-1/2 origin-bottom-left rtl:translate-x-1/2 rtl:origin-bottom-right",
    rectangular:
      "inset-s-0 bottom-0 -translate-x-1/2 translate-y-1/2 origin-bottom-left rtl:translate-x-1/2 rtl:origin-bottom-right",
  },
  "top-end": {
    circular:
      "inset-e-[14%] top-[14%] translate-x-1/2 -translate-y-1/2 origin-top-right rtl:-translate-x-1/2 rtl:origin-top-left",
    rectangular:
      "inset-e-0 top-0 translate-x-1/2 -translate-y-1/2 origin-top-right rtl:-translate-x-1/2 rtl:origin-top-left",
  },
  "top-start": {
    circular:
      "inset-s-[14%] top-[14%] -translate-x-1/2 -translate-y-1/2 origin-top-left rtl:translate-x-1/2 rtl:origin-top-right",
    rectangular:
      "inset-s-0 top-0 -translate-x-1/2 -translate-y-1/2 origin-top-left rtl:translate-x-1/2 rtl:origin-top-right",
  },
};

/**
 * A count or a dot on the corner of an icon, an avatar or a button - e.g.
 * of unread notifications - or on its own after a text. Above `max` it says
 * "99+", a count of 0 hides it (see `showZero`). It is decorative: put what
 * it says into the name of what it marks, or give it a `label`.
 */
export default function Badge({
  children,
  className,
  color = "danger",
  count,
  dot = false,
  invisible = false,
  label,
  max = 99,
  overlap = "rectangular",
  placement = "top-end",
  showZero = false,
  size = "md",
  ...props
}: BadgeProps) {
  const locale = useLocale();
  const isAnchored =
    children !== undefined && children !== null && children !== false;

  const hasCount = typeof count === "number" && Number.isFinite(count);
  const isEmpty = !dot && (!hasCount || (count === 0 && !showZero));
  const isHidden = invisible || isEmpty;

  const limit = Math.max(Math.floor(max), 0);
  const text =
    dot || !hasCount
      ? null
      : count > limit
        ? formatMessage(locale.messages.ui.badge.overflow, {
            max: formatNumber(locale.code, limit),
          })
        : formatNumber(locale.code, count);

  const badge = (
    <span
      // What it says is in the `label`, or in the name of what it marks
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold whitespace-nowrap tabular-nums",
        "transition duration-200 ease-out motion-reduce:transition-opacity",
        dot ? sizeClasses[size].dot : sizeClasses[size].count,
        colorClasses[color],
        // Its colors stay in forced colors mode - without its fill a dot
        // would be gone, a count a number over the child
        "forced-color-adjust-none",
        isAnchored && [
          // Apart from the child, in the color of the surface around it
          "pointer-events-none absolute z-10 ring-2 ring-surface dark:ring-surface-dark",
          placementClasses[placement][overlap],
        ],
        isHidden && "scale-0 opacity-0",
        !isAnchored && isEmpty && "hidden",
        !isAnchored && className,
      )}
      data-badge=""
      {...(isAnchored ? {} : props)}
    >
      {text}
    </span>
  );

  const hiddenLabel = label && !isHidden && (
    <span className="sr-only">{label}</span>
  );

  if (!isAnchored) {
    return (
      <>
        {badge}
        {hiddenLabel}
      </>
    );
  }

  return (
    <span
      {...props}
      className={cn("relative inline-flex shrink-0 align-middle", className)}
    >
      {children}
      {badge}
      {hiddenLabel}
    </span>
  );
}
