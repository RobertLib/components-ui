import { cn } from "../utils/cn";

export interface ProgressProps {
  className?: string;
  /** Secondary text next to the label. */
  description?: string;
  /** Text above the bar - also its accessible name. */
  label?: string;
  /** Value of a full bar. */
  max?: number;
  /** Shows the percentage above the bar on the right. */
  showPercentage?: boolean;
  /** Height of the bar. */
  size?: "sm" | "md" | "lg";
  /** Current value, between 0 and `max`. */
  value: number;
  /** Color of the bar. */
  variant?: "primary" | "secondary" | "success" | "warning" | "danger";
}

/** A horizontal progress bar. */
export default function Progress({
  className,
  description,
  label,
  max = 100,
  showPercentage = false,
  size = "md",
  value,
  variant = "primary",
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  const variantClasses = {
    primary: "bg-primary-600",
    secondary: "bg-secondary-600",
    success: "bg-success-600",
    warning: "bg-warning-600",
    danger: "bg-danger-600",
  };

  return (
    <div className={cn("w-full", className)}>
      {(label || description || showPercentage) && (
        <div className="mb-2 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
          <div>
            {label && <span>{label}</span>}
            {description && (
              <span className={label ? "ml-2" : ""}>{description}</span>
            )}
          </div>
          {showPercentage && <span>{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={value}
        className={cn(
          "w-full rounded-full bg-neutral-200 dark:bg-neutral-700",
          sizeClasses[size],
        )}
        role="progressbar"
      >
        <div
          className={cn(
            "rounded-full transition-all duration-300",
            sizeClasses[size],
            variantClasses[variant],
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
