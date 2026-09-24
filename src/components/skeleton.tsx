import cn from "../utils/cn";

export interface SkeletonProps extends React.ComponentProps<"div"> {
  /**
   * Tailwind height class, e.g. `h-4` - `h-4` by default, `h-10` for a
   * circle. For `text`, the height of the bar of each line.
   */
  height?: string;
  /** Number of lines of a `text` skeleton - the last of several is shorter. */
  lines?: number;
  /**
   * `rect` - a block, `circle` - e.g. an avatar, `text` - lines as high as
   * the text lines of the surrounding font.
   */
  variant?: "rect" | "circle" | "text";
  /**
   * Tailwind width class, e.g. `w-full` or `w-32` - `w-full` by default,
   * `w-10` for a circle. For `text`, the width of the lines.
   */
  width?: string;
}

const placeholderClasses = "animate-pulse bg-neutral-100 dark:bg-neutral-900";

/**
 * A pulsing placeholder shown while content loads - hidden from screen
 * readers; tell them about the loading elsewhere, e.g. with `aria-busy` on
 * the region.
 */
export default function Skeleton({
  className,
  height,
  lines = 1,
  variant = "rect",
  width,
  ...props
}: SkeletonProps) {
  if (variant === "text") {
    const lineCount = Math.max(Math.floor(lines), 1);

    return (
      <div
        aria-hidden="true"
        {...props}
        className={cn("flex flex-col", width ?? "w-full", className)}
      >
        {Array.from({ length: lineCount }, (_, index) => (
          // A line box of the font around, with the bar in its middle
          <div className="flex h-[1lh] items-center" key={index}>
            <div
              className={cn(
                "rounded",
                placeholderClasses,
                height ?? "h-[0.75em]",
                // A paragraph ends before the edge
                index > 0 && index === lineCount - 1 ? "w-3/5" : "w-full",
              )}
            />
          </div>
        ))}
      </div>
    );
  }

  const isCircle = variant === "circle";

  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn(
        isCircle ? "rounded-full" : "rounded",
        placeholderClasses,
        height ?? (isCircle ? "h-10" : "h-4"),
        width ?? (isCircle ? "w-10" : "w-full"),
        className,
      )}
    />
  );
}
