import { finiteSum, sectorPath } from "./chart/geometry";
import { useId, useState } from "react";
import { attachRef } from "../../hooks/use-form-control";
import cn from "../../utils/cn";
import { toIntlLocale } from "../../i18n/ui/format";
import { useLocale } from "../../providers/ui-context";
import EmptyState from "./empty-state";
import Button from "./button";
import Table, { TableBody, TableCell, TableHead, TableRow } from "./table";

export type ChartColor =
  "primary" | "success" | "warning" | "danger" | "secondary";

/** A Cartesian or radial chart. Mixed charts use the type of each series. */
export type ChartType = "line" | "area" | "bar" | "mixed" | "pie" | "donut";

export interface ChartSeries {
  /** Key of the numeric field in each point. */
  key: string;
  /** Name in the legend, tooltip and data table. */
  label: string;
  /** Rendering of this series in a mixed chart. Defaults to line. */
  type?: "line" | "area" | "bar";
  /** Theme color; series cycle through the palette by default. */
  color?: ChartColor;
}

export interface ChartDataPoint {
  /** Category shown on the horizontal axis. */
  label: string;
  /** Numeric series values; null and non-finite values are gaps. */
  [key: string]: string | number | null | undefined;
}

export interface ChartProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "title"
> {
  /** Category points in horizontal order. */
  data: readonly ChartDataPoint[];
  /** Series to draw, in legend order. */
  series: readonly ChartSeries[];
  /** Chart type. Pie and donut use the first series as category values; values that are not positive are omitted, also from the legend. */
  type?: ChartType;
  /** Stack bar and area series by sign. Defaults to false. */
  stacked?: boolean;
  /** Accessible name, also shown above the chart. */
  title: string;
  /** Text explaining the result; also describes the chart. */
  description?: React.ReactNode;
  /** Formats values on the axis, in tooltips and the data table. */
  formatOptions?: Intl.NumberFormatOptions;
  /** Value formatter instead of the locale's number formatter. */
  formatValue?: (value: number) => string;
  /** Show the legend; buttons toggle individual series. Defaults to true. */
  legend?: boolean;
  /** Offer a native disclosure containing the values as a table. Defaults to true. */
  showDataTable?: boolean;
  /** Lower value bound; bars always include zero. */
  min?: number;
  /** Upper value bound; bars always include zero. */
  max?: number;
  /** SVG height in pixels. Defaults to 320. */
  height?: number;
}

const colors: Record<ChartColor, string> = {
  primary:
    "stroke-primary-600 fill-primary-600 dark:stroke-primary-400 dark:fill-primary-400",
  success:
    "stroke-success-700 fill-success-700 dark:stroke-success-500 dark:fill-success-500",
  warning:
    "stroke-warning-700 fill-warning-700 dark:stroke-warning-500 dark:fill-warning-500",
  danger:
    "stroke-danger-600 fill-danger-600 dark:stroke-danger-400 dark:fill-danger-400",
  secondary:
    "stroke-secondary-600 fill-secondary-600 dark:stroke-secondary-400 dark:fill-secondary-400",
};
const palette: ChartColor[] = [
  "primary",
  "success",
  "warning",
  "danger",
  "secondary",
];
const numeric = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * A responsive multi-series chart with axes, keyboard tooltips and a data
 * table. It is one tab stop - the arrow keys, Home and End move between its
 * points.
 */
export default function Chart({
  className,
  data,
  description,
  formatOptions,
  formatValue,
  height = 320,
  legend = true,
  max,
  min,
  ref,
  series,
  showDataTable = true,
  stacked = false,
  title,
  type = "line",
  ...props
}: ChartProps) {
  const locale = useLocale();
  const { chart: messages } = locale.messages.ui;
  const id = useId();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(800);
  const visible = series.filter((entry) => !hidden.has(entry.key));
  const radial = type === "pie" || type === "donut";
  const [hiddenPoints, setHiddenPoints] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // The point the chart is a tab stop at - the arrow keys move between the
  // points, Tab past the chart
  const [focusedPoint, setFocusedPoint] = useState(0);
  const typeOf = (entry: ChartSeries) =>
    type === "mixed" ? (entry.type ?? "line") : type;
  const ranges = data.map((point) => {
    const totals = new Map<string, { positive: number; negative: number }>();
    return new Map(
      visible.map((entry) => {
        const value = point[entry.key];
        const kind = typeOf(entry);
        if (!numeric(value)) return [entry.key, null] as const;
        const total = totals.get(kind) ?? { positive: 0, negative: 0 };
        const side = value >= 0 ? "positive" : "negative";
        const base =
          stacked && (kind === "area" || kind === "bar") ? total[side] : 0;
        const end = finiteSum(base, value);
        total[side] = end;
        totals.set(kind, total);
        return [entry.key, { base, end, value }] as const;
      }),
    );
  });
  const allValues = ranges.flatMap((point) =>
    [...point.values()].flatMap((value) => (value ? [value.end] : [])),
  );
  // The categories a pie can draw - the legend lists these, hidden or not
  const categoryCounts = new Map<string, number>();
  const radialCategories = data.flatMap((point, index) => {
    // Labels retain visibility through reorders; repeated labels each
    // get their own key, including categories not currently drawn.
    const occurrence = categoryCounts.get(point.label) ?? 0;
    categoryCounts.set(point.label, occurrence + 1);
    const key = JSON.stringify([point.label, occurrence]);
    const value = point[series[0]?.key];
    return numeric(value) && value > 0 ? [{ index, key, value }] : [];
  });
  const radialPoints = radialCategories.filter(
    ({ key }) => !hiddenPoints.has(key),
  );
  const radialMax = radialPoints.reduce(
    (max, point) => Math.max(max, point.value),
    0,
  );
  const radialTotal = radialPoints.reduce(
    (sum, point) => sum + point.value / radialMax,
    0,
  );
  const hasData = radial ? radialPoints.length > 0 : allValues.length > 0;
  const valuesMin = allValues.reduce((a, b) => Math.min(a, b), Infinity);
  const valuesMax = allValues.reduce((a, b) => Math.max(a, b), -Infinity);
  let low = numeric(min) ? min : allValues.length ? valuesMin : 0;
  let high = numeric(max) ? max : allValues.length ? valuesMax : 1;
  if (
    visible.some((entry) => typeOf(entry) === "bar" || typeOf(entry) === "area")
  ) {
    low = Math.min(0, low);
    high = Math.max(0, high);
  }
  if (high < low) [low, high] = [high, low];
  if (high === low) {
    const padding = Math.abs(low) * 0.05 || 1;
    low = Math.max(-Number.MAX_VALUE, low - padding);
    high = Math.min(Number.MAX_VALUE, high + padding);
  }
  const scale = Number.isFinite(high - low) ? 1 : 2;
  const scaledLow = low / scale;
  const scaledRange = high / scale - scaledLow;
  const chartHeight = Number.isFinite(height) ? Math.max(160, height) : 320;
  const left = 88,
    right = 20,
    top = 16,
    bottom = 48;
  const plotWidth = width - left - right,
    plotHeight = chartHeight - top - bottom;
  const step = plotWidth / Math.max(1, data.length);
  const x = (index: number) => left + step * (index + 0.5);
  const y = (value: number) =>
    top +
    (1 -
      (scaledRange > 0
        ? (Math.min(high, Math.max(low, value)) / scale - scaledLow) /
          scaledRange
        : 0.5)) *
      plotHeight;
  const formatter = new Intl.NumberFormat(
    toIntlLocale(locale.code),
    formatOptions,
  );
  const valueText = (value: number) =>
    formatValue ? formatValue(value) : formatter.format(value);
  const colorOf = (entry: ChartSeries) =>
    colors[entry.color ?? palette[series.indexOf(entry) % palette.length]];
  // What a point tells - a pie draws the first series alone
  const pointSeries = radial ? series.slice(0, 1) : visible;
  const pointLabel = (index: number) =>
    `${data[index].label}: ${pointSeries.map((entry) => `${entry.label} ${numeric(data[index][entry.key]) ? valueText(data[index][entry.key] as number) : messages.noValue}`).join(", ")}`;
  // The sectors of a pie, from the top clockwise
  const radius = Math.min(width, chartHeight) / 2 - 20;
  const sectors: { fraction: number; index: number; start: number }[] = [];
  let angle = 0;
  for (const { index, value } of radialPoints) {
    const fraction = value / radialMax / radialTotal;
    sectors.push({ fraction, index, start: angle });
    angle += fraction * Math.PI * 2;
  }
  // One tab stop - the point focused last, or the first one drawn
  const pointIndexes = radial
    ? sectors.map(({ index }) => index)
    : data.map((_, index) => index);
  const tabStop = pointIndexes.includes(focusedPoint)
    ? focusedPoint
    : pointIndexes[0];
  /** Where the tooltip of a point goes across the chart. */
  const tooltipX = (index: number) => {
    const sector = sectors.find((candidate) => candidate.index === index);
    // Over the middle of the sector
    return sector
      ? width / 2 +
          radius * 0.6 * Math.sin(sector.start + sector.fraction * Math.PI)
      : x(index);
  };
  const segments = (entry: ChartSeries) => {
    const result: { x: number; y: number; base: number }[][] = [];
    let current: { x: number; y: number; base: number }[] = [];
    data.forEach((_, index) => {
      const value = ranges[index].get(entry.key);
      if (value)
        current.push({ x: x(index), y: y(value.end), base: y(value.base) });
      else if (current.length) {
        result.push(current);
        current = [];
      }
    });
    if (current.length) result.push(current);
    return result;
  };
  const pointEvents = (index: number) => ({
    "aria-label": pointLabel(index),
    "data-chart-point": index,
    role: "img" as const,
    tabIndex: index === tabStop ? 0 : -1,
    onBlur: () => setActive(null),
    onFocus: () => {
      setActive(index);
      setFocusedPoint(index);
    },
    onClick: () => setActive(index),
    onMouseEnter: () => setActive(index),
    onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.nativeEvent.isComposing
      )
        return;
      if (event.key === "Escape") {
        setActive(null);
        return;
      }
      const points = Array.from(
        event.currentTarget.ownerSVGElement?.querySelectorAll<SVGElement>(
          "[data-chart-point]",
        ) ?? [],
      );
      const position = points.indexOf(event.currentTarget);
      const target =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? points.length - 1
            : event.key === "ArrowRight"
              ? Math.min(points.length - 1, position + 1)
              : event.key === "ArrowLeft"
                ? Math.max(0, position - 1)
                : null;
      if (target !== null) {
        event.preventDefault();
        points[target]?.focus();
      }
    },
  });
  const bars = visible.filter((entry) => typeOf(entry) === "bar");
  return (
    <div
      {...props}
      aria-label={title}
      className={cn("min-w-0", className)}
      ref={(element) => {
        if (!element) return;
        const detach = attachRef(ref, element);
        const measure = () => {
          if (element.clientWidth > 0)
            setWidth(Math.max(260, element.clientWidth));
        };
        measure();
        const observer =
          typeof ResizeObserver === "undefined"
            ? undefined
            : new ResizeObserver(measure);
        observer?.observe(element);
        return () => {
          observer?.disconnect();
          detach();
        };
      }}
      role="region"
    >
      <div className="mb-2 font-semibold">{title}</div>
      {description && (
        <div
          className="mb-3 text-sm text-neutral-600 dark:text-neutral-400"
          id={`${id}-description`}
        >
          {description}
        </div>
      )}
      {legend && (
        <div
          aria-label={messages.legend}
          className="mb-2 flex flex-wrap gap-2"
          role="group"
        >
          {(radial
            ? radialCategories.map(({ index, key }) => ({
                id: key,
                key,
                label: data[index].label,
                color: palette[index % palette.length],
              }))
            : series
          ).map((entry) => (
            <Button
              aria-pressed={!(radial ? hiddenPoints : hidden).has(entry.key)}
              className={
                (radial ? hiddenPoints : hidden).has(entry.key)
                  ? "line-through opacity-50"
                  : undefined
              }
              key={"id" in entry ? entry.id : entry.key}
              onClick={() => {
                (radial ? setHiddenPoints : setHidden)((previous) => {
                  const next = new Set(previous);
                  if (next.has(entry.key)) next.delete(entry.key);
                  else next.add(entry.key);
                  return next;
                });
                setActive(null);
              }}
              size="sm"
              variant="ghost"
            >
              <svg
                aria-hidden="true"
                className={cn("size-3", colorOf(entry))}
                viewBox="0 0 10 10"
              >
                <circle cx="5" cy="5" r="4" />
              </svg>
              {entry.label}
            </Button>
          ))}
        </div>
      )}
      {!hasData ? (
        <EmptyState title={messages.noData} />
      ) : (
        <div className="relative" onMouseLeave={() => setActive(null)}>
          <svg
            aria-describedby={description ? `${id}-description` : undefined}
            aria-label={title}
            className="block w-full overflow-visible text-neutral-500 dark:text-neutral-400"
            role="group"
            viewBox={`0 0 ${width} ${chartHeight}`}
          >
            {radial ? (
              sectors.map(({ fraction, index, start }) => (
                <path
                  {...pointEvents(index)}
                  className={cn(
                    colors[palette[index % palette.length]],
                    "stroke-2 focus:outline-2 focus:outline-primary-500",
                  )}
                  d={sectorPath(
                    width / 2,
                    chartHeight / 2,
                    radius,
                    type === "donut" ? radius * 0.6 : 0,
                    start,
                    fraction,
                  )}
                  fillRule="evenodd"
                  key={index}
                >
                  <title>{pointLabel(index)}</title>
                </path>
              ))
            ) : (
              <>
                {Array.from({ length: 5 }, (_, index) => {
                  const value = (scaledLow + (scaledRange * index) / 4) * scale;
                  return (
                    <g key={index}>
                      <line
                        className="stroke-neutral-200 dark:stroke-neutral-700"
                        x1={left}
                        x2={width - right}
                        y1={y(value)}
                        y2={y(value)}
                      />
                      <text
                        fill="currentColor"
                        fontSize="12"
                        textAnchor="end"
                        x={left - 10}
                        y={y(value) + 4}
                      >
                        {valueText(value)}
                      </text>
                    </g>
                  );
                })}
                {visible.map((entry) => (
                  <g
                    className={colorOf(entry)}
                    data-chart-series={entry.key}
                    key={entry.key}
                  >
                    {typeOf(entry) === "bar"
                      ? data.map((_, index) => {
                          const value = ranges[index].get(entry.key);
                          const barWidth =
                            (step * 0.75) / (stacked ? 1 : bars.length);
                          return (
                            value && (
                              <rect
                                height={Math.max(
                                  1,
                                  Math.abs(y(value.end) - y(value.base)),
                                )}
                                key={index}
                                width={Math.max(0.5, barWidth - 2)}
                                x={
                                  x(index) -
                                  step * 0.375 +
                                  (stacked ? 0 : bars.indexOf(entry)) * barWidth
                                }
                                y={Math.min(y(value.end), y(value.base))}
                              />
                            )
                          );
                        })
                      : segments(entry).map((points, index) => (
                          <g key={index}>
                            {typeOf(entry) === "area" && (
                              <path
                                d={`M${points.map((point) => `${point.x},${point.y}`).join(" L")} L${[
                                  ...points,
                                ]
                                  .reverse()
                                  .map((point) => `${point.x},${point.base}`)
                                  .join(" L")} Z`}
                                opacity="0.15"
                                stroke="none"
                              />
                            )}
                            <polyline
                              fill="none"
                              points={points
                                .map((point) => `${point.x},${point.y}`)
                                .join(" ")}
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                            {points.map((point, index) => (
                              <circle
                                cx={point.x}
                                cy={point.y}
                                key={index}
                                r="3"
                                strokeWidth="0"
                              />
                            ))}
                          </g>
                        ))}
                  </g>
                ))}
                {data.map((point, index) => (
                  <g key={index}>
                    {(data.length <= Math.max(2, Math.floor(plotWidth / 70)) ||
                      index %
                        Math.ceil(
                          data.length / Math.max(2, Math.floor(plotWidth / 70)),
                        ) ===
                        0) && (
                      <text
                        fill="currentColor"
                        fontSize="12"
                        stroke="none"
                        textAnchor="middle"
                        x={x(index)}
                        y={chartHeight - 18}
                      >
                        <title>{point.label}</title>
                        {point.label.length > 12
                          ? `${point.label.slice(0, 11)}…`
                          : point.label}
                      </text>
                    )}
                    <rect
                      {...pointEvents(index)}
                      className="fill-transparent stroke-transparent focus:stroke-primary-500 focus:outline-hidden"
                      height={plotHeight}
                      width={step}
                      x={left + index * step}
                      y={top}
                    />
                  </g>
                ))}
              </>
            )}
          </svg>
          {active !== null && data[active] && (
            <div
              className="pointer-events-none absolute top-2 z-1 max-w-64 rounded border border-neutral-200 bg-surface p-2 text-sm shadow dark:border-neutral-700 dark:bg-surface-dark"
              style={{
                left: `${Math.min(70, (tooltipX(active) / width) * 100)}%`,
              }}
            >
              <div className="font-semibold">{data[active].label}</div>
              {pointSeries.map((entry) => (
                <div key={entry.key}>
                  {entry.label}:{" "}
                  {numeric(data[active][entry.key])
                    ? valueText(data[active][entry.key] as number)
                    : messages.noValue}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {showDataTable && data.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-primary-700 dark:text-primary-300">
            {messages.showData}
          </summary>
          <Table caption={title} className="mt-2">
            <TableHead>
              <TableRow>
                <TableCell header>{messages.category}</TableCell>
                {series.map((entry) => (
                  <TableCell header key={entry.key}>
                    {entry.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((point, index) => (
                <TableRow key={index}>
                  <TableCell header>{point.label}</TableCell>
                  {series.map((entry) => (
                    <TableCell key={entry.key}>
                      {numeric(point[entry.key])
                        ? valueText(point[entry.key] as number)
                        : messages.noValue}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      )}
    </div>
  );
}
