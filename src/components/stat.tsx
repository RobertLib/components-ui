import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import cn from "../utils/cn";
import Skeleton from "./skeleton";
import { toIntlLocale } from "../i18n/format";
import { useLocale } from "../providers/ui-context";

type StatTrend = "up" | "down" | "neutral";

export interface StatProps extends React.ComponentProps<"div"> {
  /**
   * The change against an earlier period. A number is a share - `0.125` is
   * shown as "+12.5%", in the format of the language; other content is
   * shown as it is (tell its direction with `trend`).
   */
  change?: number | React.ReactNode;
  /** Text next to the change, e.g. "vs last month". */
  description?: React.ReactNode;
  /**
   * `Intl.NumberFormat` options of a numeric `value` - a currency, a unit,
   * compact notation (`{ notation: "compact" }` - "1.2M").
   */
  formatOptions?: Intl.NumberFormatOptions;
  /** An icon in the corner, e.g. `<Banknote />` of lucide-react. */
  icon?: React.ReactNode;
  /**
   * Down is good - a fall shows green and a rise red, e.g. for costs, churn
   * or response times.
   */
  invertTrend?: boolean;
  /** What the figure is, e.g. "Revenue". */
  label: React.ReactNode;
  /** Placeholders instead of the value and the change - the label stays. */
  loading?: boolean;
  /**
   * Direction of the change: an arrow, green for good and red for bad (see
   * `invertTrend`). Taken from the sign of a numeric `change` as it is shown
   * by default - one that rounds to "0%" is neutral.
   */
  trend?: StatTrend;
  /**
   * The figure - a number is written in the format of the language (see
   * `formatOptions`), other content as it is.
   */
  value: number | React.ReactNode;
}

/** The arrow of a change - its text says the same with its sign. */
function TrendIcon({ direction }: { direction: StatTrend }) {
  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;

  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

const toneClasses = {
  bad: "text-danger-700 dark:text-danger-400",
  good: "text-success-700 dark:text-success-400",
  neutral: "text-neutral-600 dark:text-neutral-400",
};

/**
 * A share as the stat writes it ("+12.5%") and its direction as written - a
 * change too small to show (-0.03% is "0%") has none.
 */
function formatChange(localeCode: string, change: number) {
  const parts = new Intl.NumberFormat(localeCode, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
    style: "percent",
  }).formatToParts(change);
  const sign = parts.find(
    ({ type }) => type === "plusSign" || type === "minusSign",
  )?.type;
  const trend: StatTrend =
    sign === "plusSign" ? "up" : sign === "minusSign" ? "down" : "neutral";

  return { text: parts.map(({ value }) => value).join(""), trend };
}

/**
 * A key figure - a KPI of a dashboard: its label, the value, how it changed
 * and against what. It has no frame of its own: put it into a `Panel` for a
 * card, or several into one grid.
 */
export default function Stat({
  change,
  className,
  description,
  formatOptions,
  icon,
  invertTrend = false,
  label,
  loading = false,
  trend,
  value,
  ...props
}: StatProps) {
  const locale = useLocale();
  const localeCode = toIntlLocale(locale.code);

  const shownValue =
    typeof value === "number"
      ? new Intl.NumberFormat(localeCode, formatOptions).format(value)
      : value;

  // A share that is no finite number says nothing
  const numericChange =
    typeof change === "number" && Number.isFinite(change)
      ? formatChange(localeCode, change)
      : null;
  const shownChange =
    numericChange?.text ?? (typeof change === "number" ? null : change);

  const direction = trend ?? numericChange?.trend;
  const tone =
    direction === undefined || direction === "neutral"
      ? "neutral"
      : (direction === "up") !== invertTrend
        ? "good"
        : "bad";
  const hasChange = shownChange != null && shownChange !== false;

  return (
    <div
      aria-busy={loading || undefined}
      {...props}
      className={cn("flex items-start justify-between gap-4", className)}
    >
      <dl className="min-w-0">
        <dt className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </dt>
        {/* A value wider than a narrow card wraps rather than run under the icon */}
        <dd className="mt-1 text-2xl font-semibold tracking-tight wrap-anywhere text-neutral-900 tabular-nums dark:text-neutral-50">
          {/* As high as the value - nothing moves when it arrives */}
          {loading ? <Skeleton variant="text" width="w-28" /> : shownValue}
        </dd>
        {(hasChange || description) && (
          <dd className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
            {loading ? (
              <Skeleton variant="text" width="w-32" />
            ) : (
              <>
                {hasChange && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-medium whitespace-nowrap tabular-nums",
                      toneClasses[tone],
                    )}
                  >
                    {direction && <TrendIcon direction={direction} />}
                    {shownChange}
                  </span>
                )}
                {description && (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {description}
                  </span>
                )}
              </>
            )}
          </dd>
        )}
      </dl>
      {icon && (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-300 [&>svg]:size-5">
          {icon}
        </div>
      )}
    </div>
  );
}
