import { Children, cloneElement, isValidElement } from "react";
import cn from "../utils/cn";
import Tooltip from "./tooltip";
import type { AvatarProps, AvatarSize } from "./avatar";
import { formatNumber, formatPlural } from "../i18n/format";
import { useLocale } from "../providers/ui-context";

export interface AvatarGroupProps extends React.ComponentProps<"div"> {
  /** The `Avatar`s, in order - the first ones are shown. */
  children?: React.ReactNode;
  /**
   * The most circles shown, the "+N" included: with more avatars, the last
   * place shows "+N" for the rest - it never stands for a single one.
   * All are shown without it.
   */
  max?: number;
  /** Size of the avatars that set none of their own, and of the "+N". */
  size?: AvatarSize;
  /**
   * The number of all people when only some avatars are passed, e.g. the
   * first three members of a team of 24 - the others count into the "+N".
   */
  total?: number;
}

// Less than the margin around the initials - they stay whole
const overlapClasses: Record<AvatarSize, string> = {
  sm: "-space-x-1",
  md: "-space-x-1.5",
  lg: "-space-x-2.5",
  xl: "-space-x-3",
};

// A pill rather than a circle once the number gets long ("+128"). The last
// avatar covers its left side - the number keeps clear of it.
const restSizeClasses: Record<AvatarSize, string> = {
  sm: "h-6 min-w-6 pr-1 pl-1.5 text-[10px]",
  md: "h-8 min-w-8 pr-1.5 pl-2.5 text-xs",
  lg: "h-12 min-w-12 pr-2 pl-3.5 text-base",
  xl: "h-16 min-w-16 pr-2.5 pl-4.5 text-xl",
};

// Separates the overlapping circles - in the color of the surface under them
const ringClasses = "relative ring-2 ring-surface dark:ring-surface-dark";

// How many names the tooltip of the "+N" lists - the others are counted
const LISTED_NAMES = 10;

/**
 * Overlapping avatars of several people, e.g. the assignees of a task.
 * `max` limits the circles shown - the last of them then says "+N"; its
 * tooltip lists the names of the people it stands for (on hover, keyboard
 * focus and tap), and screen readers hear "+N more".
 */
export default function AvatarGroup({
  children,
  className,
  max,
  size = "sm",
  total,
  ...props
}: AvatarGroupProps) {
  const locale = useLocale();
  const avatars = Children.toArray(children).filter(
    (child): child is React.ReactElement<AvatarProps> => isValidElement(child),
  );
  const count = Math.max(total ?? 0, avatars.length);
  const limit =
    max === undefined ? Number.POSITIVE_INFINITY : Math.max(Math.floor(max), 1);
  // Without room for all of them, the last place counts the rest
  const shownCount = Math.min(
    count > limit ? limit - 1 : avatars.length,
    avatars.length,
  );
  const restCount = count - shownCount;

  const names = avatars
    .slice(shownCount)
    .map(({ props: avatar }) => avatar.alt || avatar.name)
    .filter((name): name is string => !!name);
  const listedNames = names.slice(0, LISTED_NAMES);
  const unlistedCount = restCount - listedNames.length;

  const restText = `+${formatNumber(locale.code, restCount)}`;
  const restName = formatPlural(
    locale.code,
    locale.messages.avatar.more,
    restCount,
  );
  const restClassName = cn(
    "inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-200 font-semibold whitespace-nowrap text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100",
    restSizeClasses[size],
    ringClasses,
  );

  return (
    <div
      role="group"
      {...props}
      // Its own stacking context - the order of the avatars stays inside
      className={cn(
        "isolate flex items-center",
        overlapClasses[size],
        className,
      )}
    >
      {avatars.slice(0, shownCount).map((avatar, index) =>
        cloneElement(avatar, {
          className: cn(ringClasses, avatar.props.className),
          size: avatar.props.size ?? size,
          // The first on top - the status dot in the corner of each avatar
          // stays in sight over the next one
          style: { zIndex: shownCount - index, ...avatar.props.style },
        }),
      )}

      {restCount > 0 &&
        (listedNames.length > 0 ? (
          <Tooltip
            delay={300}
            openOnClick
            position="top"
            title={
              <span className="block max-w-64">
                {[
                  ...listedNames,
                  ...(unlistedCount > 0
                    ? [
                        formatPlural(
                          locale.code,
                          locale.messages.avatar.more,
                          unlistedCount,
                        ),
                      ]
                    : []),
                ].join(", ")}
              </span>
            }
          >
            {/* A button, so the keyboard reaches the names too - it counts
                them, the tooltip describes it with the names */}
            <button
              aria-label={restName}
              className={cn(
                restClassName,
                // Focused, its ring is on top of the avatar before it
                "cursor-pointer focus:outline-none focus-visible:z-[9999] focus-visible:ring-primary-500",
              )}
              type="button"
            >
              {restText}
            </button>
          </Tooltip>
        ) : (
          <span aria-label={restName} className={restClassName} role="img">
            {restText}
          </span>
        ))}
    </div>
  );
}
