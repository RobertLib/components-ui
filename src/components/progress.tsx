import { useId } from "react";
import { cn, joinTokens } from "../utils/cn";
import { toIntlLocale } from "../i18n/format";
import { useLocale } from "../providers/ui-context";

type ProgressVariant =
  "primary" | "secondary" | "success" | "warning" | "danger";

/**
 * The props of a `<div>` go to the bar (`role="progressbar"`) - an `id`,
 * `aria-valuetext` ("3 of 5 files"), `data-*` - except `className` and
 * `style`, which are those of the wrapper around the label and the bar.
 */
export interface ProgressProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** Names a bar without a `label`, e.g. "Uploading report.pdf". */
  "aria-label"?: string;
  /** Id of the element naming a bar without a `label`. */
  "aria-labelledby"?: string;
  /** Classes of the wrapper around the label and the bar. */
  className?: string;
  /** Secondary text next to the label - also describes the bar. */
  description?: string;
  /**
   * A bar that moves without telling how far the work is - for work of an
   * unknown length, e.g. while the server processes an upload. Also shown
   * when `value` is left out.
   */
  indeterminate?: boolean;
  /** Text above the bar - also its accessible name. */
  label?: string;
  /** Value of a full bar. */
  max?: number;
  /**
   * Shows the percentage above the bar on the right, written as the
   * language writes it ("40 %" in Czech) - rounded down, so it says 100 %
   * only once the work is done.
   */
  showPercentage?: boolean;
  /** Height of the bar. */
  size?: "sm" | "md" | "lg";
  /** Styles of the wrapper around the label and the bar. */
  style?: React.CSSProperties;
  /**
   * Current value, between 0 and `max` - values outside are clamped, and a
   * value that is not a finite number counts as 0. Without a value (or with
   * `null`) the bar is indeterminate.
   */
  value?: number | null;
  /** Color of the bar. */
  variant?: ProgressVariant;
}

// The filled part stands out from the track by at least 3:1 (WCAG 1.4.11)
// - of `neutral-200` in the light, of `neutral-700` in the dark
const barColorClasses: Record<ProgressVariant, string> = {
  primary: "bg-primary-600 dark:bg-primary-400",
  secondary: "bg-secondary-600 dark:bg-secondary-400",
  success: "bg-success-700 dark:bg-success-500",
  warning: "bg-warning-700 dark:bg-warning-500",
  danger: "bg-danger-600 dark:bg-danger-400",
};

const strokeColorClasses: Record<ProgressVariant, string> = {
  primary: "stroke-primary-600 dark:stroke-primary-400",
  secondary: "stroke-secondary-600 dark:stroke-secondary-400",
  success: "stroke-success-700 dark:stroke-success-500",
  warning: "stroke-warning-700 dark:stroke-warning-500",
  danger: "stroke-danger-600 dark:stroke-danger-400",
};

/**
 * `value` clamped to 0 - `max`, and its share of `max` (0 - 1). `NaN` (a
 * share of an empty total) or an infinite value is no progress.
 */
function measure(value: number, max: number) {
  const clamped = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), max)
    : 0;
  const fraction = max > 0 && Number.isFinite(max) ? clamped / max : 0;
  return { clamped, fraction };
}

const percentFormats = new Map<string, Intl.NumberFormat>();

/**
 * A share (0 - 1) as a whole percentage, as the language writes it -
 * rounded down: work at 99.6 % is not done yet.
 */
function formatPercent(localeCode: string, fraction: number) {
  let format = percentFormats.get(localeCode);

  if (!format) {
    format = new Intl.NumberFormat(toIntlLocale(localeCode), {
      maximumFractionDigits: 0,
      roundingMode: "floor",
      style: "percent",
    });
    percentFormats.set(localeCode, format);
  }

  return format.format(fraction);
}

/** The ARIA value attributes - none while the progress is unknown. */
const valueAttributes = (
  isIndeterminate: boolean,
  clamped: number,
  max: number,
) =>
  isIndeterminate
    ? {}
    : { "aria-valuemax": max, "aria-valuemin": 0, "aria-valuenow": clamped };

/**
 * A horizontal progress bar - or, without a value, a bar that keeps moving
 * (fading in place for users who prefer reduced motion). Name it - with
 * `label`, or `aria-label` / `aria-labelledby` when the text is elsewhere.
 * Other props of a `<div>` go to the bar, `className` and `style` to the
 * wrapper around the label and the bar.
 */
export default function Progress({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  description,
  indeterminate = false,
  label,
  max = 100,
  showPercentage = false,
  size = "md",
  style,
  value,
  variant = "primary",
  ...props
}: ProgressProps) {
  const locale = useLocale();
  const descriptionId = useId();
  const isIndeterminate = indeterminate || value == null;
  const { clamped, fraction } = measure(value ?? 0, max);

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={cn("w-full", className)} style={style}>
      {(label || description || showPercentage) && (
        <div className="mb-2 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
          <div>
            {label && <span>{label}</span>}
            {description && (
              <span className={label ? "ml-2" : ""} id={descriptionId}>
                {description}
              </span>
            )}
          </div>
          {showPercentage && !isIndeterminate && (
            <span>{formatPercent(locale.code, fraction)}</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        {...valueAttributes(isIndeterminate, clamped, max)}
        {...props}
        aria-describedby={joinTokens(
          description ? descriptionId : undefined,
          ariaDescribedBy,
        )}
        aria-label={ariaLabelledBy ? undefined : (label ?? ariaLabel)}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          "w-full rounded-full bg-neutral-200 dark:bg-neutral-700",
          isIndeterminate && "relative overflow-hidden",
          sizeClasses[size],
        )}
      >
        {isIndeterminate ? (
          <div
            className={cn(
              "absolute inset-y-0 left-0 w-2/5 animate-[progress-indeterminate_1.5s_ease-in-out_infinite] rounded-full",
              // No motion across the screen - it fades in the middle, where
              // no value would start
              "motion-reduce:left-[30%] motion-reduce:animate-[progress-fade_2s_ease-in-out_infinite]",
              barColorClasses[variant],
            )}
          />
        ) : (
          <div
            className={cn(
              "rounded-full transition-all duration-300 motion-reduce:transition-none",
              sizeClasses[size],
              barColorClasses[variant],
            )}
            style={{ width: `${fraction * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

export interface CircularProgressProps extends React.ComponentProps<"div"> {
  /** Content in the middle instead of the percentage, e.g. "3/5" or an icon. */
  children?: React.ReactNode;
  /**
   * A spinning arc that does not tell how far the work is - also shown when
   * `value` is left out. It turns slower for users who prefer reduced motion.
   */
  indeterminate?: boolean;
  /** Value of a full ring. */
  max?: number;
  /**
   * Shows the percentage in the middle of the ring, rounded down like that
   * of `Progress` - best from `md` up, the text in the ring of `sm` is tiny.
   */
  showPercentage?: boolean;
  /** Diameter: 32, 48, 64 or 96 px. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Thickness of the ring, in percent of its diameter. */
  strokeWidth?: number;
  /**
   * Current value, between 0 and `max` - clamped like the one of
   * `Progress`. Without a value (or with `null`) the ring is indeterminate.
   */
  value?: number | null;
  /** Color of the ring. */
  variant?: ProgressVariant;
}

// The text fits inside the ring also as "100 %"
const circleSizeClasses = {
  sm: "size-8 text-[8px]",
  md: "size-12 text-[11px]",
  lg: "size-16 text-sm",
  xl: "size-24 text-lg",
};

/**
 * A progress ring, e.g. of a quota or a checklist - with the percentage or
 * other content in its middle, or spinning without a value. Name it with
 * `aria-label` or `aria-labelledby`.
 */
export function CircularProgress({
  children,
  className,
  indeterminate = false,
  max = 100,
  showPercentage = false,
  size = "md",
  strokeWidth = 10,
  value,
  variant = "primary",
  ...props
}: CircularProgressProps) {
  const locale = useLocale();
  const isIndeterminate = indeterminate || value == null;
  const { clamped, fraction } = measure(value ?? 0, max);

  // In a box of 100 x 100 the stroke width is a percentage of the diameter
  const stroke = Math.min(Math.max(strokeWidth, 1), 50);
  const radius = 50 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  // A quarter of the ring spins while the progress is unknown
  const shown = isIndeterminate ? 0.25 : fraction;

  const center =
    children ??
    (showPercentage && !isIndeterminate
      ? formatPercent(locale.code, fraction)
      : null);

  return (
    <div
      role="progressbar"
      {...valueAttributes(isIndeterminate, clamped, max)}
      {...props}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        circleSizeClasses[size],
        className,
      )}
    >
      <svg
        aria-hidden="true"
        className={cn(
          // The arc starts at the top
          "absolute inset-0 size-full -rotate-90",
          isIndeterminate && "animate-spin",
        )}
        fill="none"
        viewBox="0 0 100 100"
      >
        <circle
          className="stroke-neutral-200 dark:stroke-neutral-700"
          cx="50"
          cy="50"
          r={radius}
          strokeWidth={stroke}
        />
        {/* Nothing at 0 - a round cap would draw a dot */}
        {shown > 0 && (
          <circle
            className={cn(
              "transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none",
              strokeColorClasses[variant],
            )}
            cx="50"
            cy="50"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - shown)}
            strokeLinecap="round"
            strokeWidth={stroke}
          />
        )}
      </svg>
      {center != null && (
        <span
          aria-hidden="true"
          className="relative font-semibold text-neutral-700 tabular-nums dark:text-neutral-200"
        >
          {center}
        </span>
      )}
    </div>
  );
}
