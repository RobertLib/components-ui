import cn from "../utils/cn";

export interface SkeletonProps extends React.ComponentProps<"div"> {
  /** Tailwind height class, e.g. `h-4`. */
  height?: string;
  /** Tailwind width class, e.g. `w-full` or `w-32`. */
  width?: string;
}

/** A pulsing placeholder shown while content loads. */
export default function Skeleton({
  className,
  height = "h-4",
  width = "w-full",
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn(
        "animate-pulse rounded bg-neutral-100 dark:bg-neutral-900",
        height,
        width,
        className,
      )}
    />
  );
}
