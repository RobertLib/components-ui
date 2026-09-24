import { useId } from "react";
import cn from "../utils/cn";

export interface SeparatorProps extends React.ComponentProps<"div"> {
  /**
   * Only a line for the eye - hidden from assistive technology, e.g. between
   * the items of a list, or a toolbar that groups its buttons already.
   */
  decorative?: boolean;
  /**
   * Text in the line, e.g. "or" between two ways to sign in - also the
   * accessible name of the separator.
   */
  label?: React.ReactNode;
  /** Where the label sits - `start` and `end` put it at an end of the line. */
  labelPosition?: "start" | "center" | "end";
  /**
   * `vertical` - a line as high as the row it stands in (in a flex row, e.g.
   * a toolbar).
   */
  orientation?: "horizontal" | "vertical";
}

const lineClasses = "shrink-0 bg-neutral-200 dark:bg-neutral-800";

/**
 * A thin line between content, horizontal or vertical, optionally with a
 * label. A `separator` for assistive technology, unless `decorative`. It has
 * no margin - add one with `className` (`my-6`, `mx-2`).
 */
export default function Separator({
  className,
  decorative = false,
  label,
  labelPosition = "center",
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  const labelId = useId();
  const isVertical = orientation === "vertical";
  const hasLabel = label != null && label !== false && label !== "";

  const semantics = decorative
    ? { role: "none" }
    : {
        // Horizontal is what a separator is without saying
        "aria-orientation": isVertical ? ("vertical" as const) : undefined,
        // Its content is not read - the label names it instead
        "aria-labelledby": hasLabel ? labelId : undefined,
        role: "separator",
      };

  if (!hasLabel) {
    return (
      <div
        {...semantics}
        {...props}
        className={cn(
          lineClasses,
          isVertical ? "w-px self-stretch" : "h-px w-full",
          className,
        )}
      />
    );
  }

  const line = cn(lineClasses, isVertical ? "w-px flex-1" : "h-px flex-1");

  return (
    <div
      {...semantics}
      {...props}
      className={cn(
        "flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400",
        isVertical ? "flex-col self-stretch" : "w-full",
        className,
      )}
    >
      {labelPosition !== "start" && <div className={line} />}
      <span id={labelId}>{label}</span>
      {labelPosition !== "end" && <div className={line} />}
    </div>
  );
}
