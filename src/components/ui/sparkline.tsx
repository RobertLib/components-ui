import cn from "../../utils/cn";
import { formatMessage, toIntlLocale } from "../../i18n/ui/format";
import { useLocale } from "../../providers/ui-context";

export type SparklineColor =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral";

export interface SparklineProps extends Omit<
  React.ComponentProps<"svg">,
  "color" | "max" | "min"
> {
  /** Fills the area under the line with a tint of its color. */
  area?: boolean;
  /**
   * Classes of the chart - its size: `h-8 w-24` by default, e.g. `h-10
   * w-full` to fill a card.
   */
  className?: string;
  /**
   * Color of the line - it stands out from the surface by at least 3:1.
   * @default "primary"
   */
  color?: SparklineColor;
  /**
   * The values, in order - evenly spaced from the start to the end. A
   * `null` (or a value that is no finite number) leaves a gap in the line.
   */
  data: readonly (number | null | undefined)[];
  /**
   * `Intl.NumberFormat` options of the values in the summary screen
   * readers hear - a currency, a unit.
   */
  formatOptions?: Intl.NumberFormatOptions;
  /** Marks the last value with a dot - where the series stands now. */
  highlightLast?: boolean;
  /**
   * What the values are, e.g. "Revenue" - read before the summary of the
   * chart. The chart is an image named by the summary alone without it.
   */
  label?: string;
  /**
   * The value at the top of the chart - the highest value by default. Set
   * `min` and `max` to compare several sparklines on one scale.
   */
  max?: number;
  /** The value at the bottom of the chart - the lowest value by default. */
  min?: number;
  /**
   * Thickness of the line in pixels, also in a chart stretched wide.
   * @default 2
   */
  strokeWidth?: number;
  /**
   * What screen readers hear in place of the generated summary ("From 12
   * to 18, lowest 9, highest 21").
   */
  summary?: string;
}

// At least 3:1 on the surface in the light and the dark (WCAG 1.4.11)
const strokeClasses: Record<SparklineColor, string> = {
  danger: "stroke-danger-600 dark:stroke-danger-400",
  info: "stroke-info-700 dark:stroke-info-400",
  neutral: "stroke-neutral-500 dark:stroke-neutral-400",
  primary: "stroke-primary-600 dark:stroke-primary-400",
  secondary: "stroke-secondary-600 dark:stroke-secondary-400",
  success: "stroke-success-700 dark:stroke-success-500",
  warning: "stroke-warning-700 dark:stroke-warning-500",
};

const fillClasses: Record<SparklineColor, string> = {
  danger: "fill-danger-500/15 dark:fill-danger-400/20",
  info: "fill-info-500/15 dark:fill-info-400/20",
  neutral: "fill-neutral-500/15 dark:fill-neutral-400/20",
  primary: "fill-primary-500/15 dark:fill-primary-400/20",
  secondary: "fill-secondary-500/15 dark:fill-secondary-400/20",
  success: "fill-success-600/15 dark:fill-success-500/20",
  warning: "fill-warning-600/15 dark:fill-warning-500/20",
};

// The drawing box - stretched to the size of the element
const WIDTH = 100;
const HEIGHT = 100;

interface Point {
  x: number;
  y: number;
}

const isValue = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Coordinates written short - the path of a long series stays small. */
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The runs of the line between the gaps, in the drawing box - a value at
 * `max` at the top, at `min` at the bottom, values beyond them at the edge.
 */
function toSegments(
  data: readonly (number | null | undefined)[],
  min: number,
  max: number,
) {
  const range = max - min;
  // Opposite finite extremes can overflow their difference. Halving both
  // ends keeps the same proportions while making the subtraction finite.
  const scale = Number.isFinite(range) ? 1 : 2;
  const scaledMin = min / scale;
  const scaledRange = max / scale - scaledMin;
  const step = data.length > 1 ? WIDTH / (data.length - 1) : 0;
  const segments: Point[][] = [];
  let current: Point[] = [];

  data.forEach((value, index) => {
    if (!isValue(value)) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }

    // A flat series runs through the middle
    const share =
      range > 0
        ? (Math.min(Math.max(value, min), max) / scale - scaledMin) /
          scaledRange
        : 0.5;
    current.push({
      x: round(data.length > 1 ? index * step : WIDTH / 2),
      y: round(HEIGHT - share * HEIGHT),
    });
  });
  if (current.length > 0) segments.push(current);

  return segments;
}

const linePath = (points: Point[]) =>
  points.map(({ x, y }, index) => `${index ? "L" : "M"}${x} ${y}`).join("");

/**
 * A tiny line chart of a series without axes - e.g. the revenue of the last
 * weeks next to its figure (`Stat` has a `sparkline`). It is an image
 * whose name tells the first and the last value, the lowest and the
 * highest; `label` says what they are.
 */
export default function Sparkline({
  area = false,
  className,
  color = "primary",
  data,
  formatOptions,
  highlightLast = false,
  label,
  max: maxProp,
  min: minProp,
  strokeWidth = 2,
  summary: summaryProp,
  ...props
}: SparklineProps) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const values = data.filter(isValue);
  const lowest = values.reduce((low, value) => Math.min(low, value), Infinity);
  const highest = values.reduce(
    (high, value) => Math.max(high, value),
    -Infinity,
  );
  const min = minProp ?? (values.length > 0 ? lowest : 0);
  const max = maxProp ?? (values.length > 0 ? highest : 0);

  const format = (value: number) =>
    new Intl.NumberFormat(toIntlLocale(locale.code), formatOptions).format(
      value,
    );
  const summary =
    summaryProp ??
    (values.length > 0
      ? formatMessage(messages.sparkline.summary, {
          first: format(values[0]),
          last: format(values[values.length - 1]),
          max: format(highest),
          min: format(lowest),
        })
      : undefined);
  const name =
    label && summary
      ? formatMessage(messages.sparkline.label, { label, summary })
      : (label ?? summary);

  const segments = toSegments(data, min, max);
  const lastPoint = isValue(data[data.length - 1])
    ? segments.at(-1)?.at(-1)
    : undefined;
  // A value alone between gaps is no line - a dot shows it
  const dots = segments
    .filter((segment) => segment.length === 1)
    .map(([point]) => point)
    .filter((point) => !highlightLast || point !== lastPoint);

  const lineProps = {
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
    // As thick in a chart stretched wide as in a narrow one
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg
      // Without values or a label there is nothing to name
      aria-hidden={name || props["aria-labelledby"] ? undefined : true}
      aria-label={props["aria-labelledby"] ? undefined : name}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      {...props}
      className={cn("block h-8 w-24 shrink-0 overflow-visible", className)}
    >
      {area &&
        segments
          .filter((segment) => segment.length > 1)
          .map((segment, index) => (
            <path
              className={fillClasses[color]}
              d={`${linePath(segment)}L${segment.at(-1)!.x} ${HEIGHT}L${segment[0].x} ${HEIGHT}Z`}
              key={`area-${index}`}
              stroke="none"
            />
          ))}
      {segments.map((segment, index) =>
        segment.length > 1 ? (
          <path
            {...lineProps}
            className={strokeClasses[color]}
            d={linePath(segment)}
            key={`line-${index}`}
          />
        ) : null,
      )}
      {/* A dot is a line of no length with round ends - round also in a
          stretched chart */}
      {[...dots, ...(highlightLast && lastPoint ? [lastPoint] : [])].map(
        (point, index) => (
          <path
            {...lineProps}
            className={strokeClasses[color]}
            d={`M${point.x} ${point.y}h0`}
            key={`dot-${index}`}
            strokeWidth={
              highlightLast && point === lastPoint
                ? strokeWidth * 3
                : strokeWidth * 2
            }
          />
        ),
      )}
    </svg>
  );
}
