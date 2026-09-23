import cn from "../utils/cn";

export type ChipColor =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral";

export type ChipVariant = "default" | "outline" | "solid";

export type ChipProps = React.ComponentProps<"div"> & {
  color?: ChipColor;
  /** `default` - colored text and border, `outline` - tinted background, `solid` - filled. */
  variant?: ChipVariant;
};

const colorVariants: Record<ChipVariant, Record<ChipColor, string>> = {
  default: {
    primary:
      "border-primary-300 bg-surface text-primary-800 dark:border-primary-700 dark:bg-surface-dark dark:text-primary-200",
    secondary:
      "border-secondary-300 bg-surface text-secondary-800 dark:border-secondary-700 dark:bg-surface-dark dark:text-secondary-200",
    success:
      "border-success-300 bg-surface text-success-800 dark:border-success-700 dark:bg-surface-dark dark:text-success-200",
    danger:
      "border-danger-300 bg-surface text-danger-800 dark:border-danger-700 dark:bg-surface-dark dark:text-danger-200",
    warning:
      "border-warning-300 bg-surface text-warning-800 dark:border-warning-700 dark:bg-surface-dark dark:text-warning-200",
    info: "border-info-300 bg-surface text-info-800 dark:border-info-700 dark:bg-surface-dark dark:text-info-200",
    neutral:
      "border-neutral-300 dark:border-neutral-700 bg-surface dark:bg-surface-dark text-neutral-800 dark:text-neutral-200",
  },
  outline: {
    primary:
      "border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-200",
    secondary:
      "border-secondary-300 bg-secondary-50 text-secondary-800 dark:border-secondary-700 dark:bg-secondary-950 dark:text-secondary-200",
    success:
      "border-success-300 bg-success-50 text-success-800 dark:border-success-700 dark:bg-success-950 dark:text-success-200",
    danger:
      "border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-700 dark:bg-danger-950 dark:text-danger-200",
    warning:
      "border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-700 dark:bg-warning-950 dark:text-warning-200",
    info: "border-info-300 bg-info-50 text-info-800 dark:border-info-700 dark:bg-info-950 dark:text-info-200",
    neutral:
      "border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200",
  },
  solid: {
    primary:
      "border-primary-600 bg-primary-500 text-white dark:border-primary-500 dark:bg-primary-600 dark:text-white",
    secondary:
      "border-secondary-600 bg-secondary-500 text-white dark:border-secondary-500 dark:bg-secondary-600 dark:text-white",
    success:
      "border-success-600 bg-success-500 text-white dark:border-success-500 dark:bg-success-600 dark:text-white",
    danger:
      "border-danger-600 bg-danger-500 text-white dark:border-danger-500 dark:bg-danger-600 dark:text-white",
    warning:
      "border-warning-600 bg-warning-500 text-white dark:border-warning-500 dark:bg-warning-600 dark:text-white",
    info: "border-info-600 bg-info-500 text-white dark:border-info-500 dark:bg-info-600 dark:text-white",
    neutral:
      "border-neutral-600 dark:border-neutral-400 bg-neutral-500 text-white",
  },
};

/** A small rounded label, e.g. a status or a tag. */
export default function Chip({
  className,
  color = "neutral",
  children,
  variant = "default",
  ...props
}: ChipProps) {
  return (
    <div
      {...props}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-sm",
        colorVariants[variant][color],
        className,
      )}
    >
      {children}
    </div>
  );
}
