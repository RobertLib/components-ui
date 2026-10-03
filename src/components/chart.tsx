import { useId, useState } from "react";
import { attachRef } from "../hooks/use-form-control";
import cn from "../utils/cn";
import { toIntlLocale } from "../i18n/format";
import { useLocale } from "../providers/ui-context";
import EmptyState from "./empty-state";
import Button from "./button";
import Table, { TableBody, TableCell, TableHead, TableRow } from "./table";

export type ChartColor =
  "primary" | "success" | "warning" | "danger" | "secondary";

export interface ChartSeries {
  /** Key of the numeric field in each point. */
  key: string;
  /** Name in the legend, tooltip and data table. */
  label: string;
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
  /** Line, filled line, or grouped columns. Defaults to line. */
  type?: "line" | "area" | "bar";
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

/** A responsive multi-series chart with axes, keyboard tooltips and a data table. */
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
  title,
  type = "line",
  ...props
}: ChartProps) {
  const locale = useLocale();
  const { chart: messages } = locale.messages;
  const id = useId();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(800);
  const visible = series.filter((entry) => !hidden.has(entry.key));
  const allValues = data.flatMap((point) =>
    visible.map((entry) => point[entry.key]).filter(numeric),
  );
  const hasData = allValues.length > 0;
  const valuesMin = hasData
    ? allValues.reduce((a, b) => Math.min(a, b), Infinity)
    : 0;
  const valuesMax = hasData
    ? allValues.reduce((a, b) => Math.max(a, b), -Infinity)
    : 0;
  let low = numeric(min) ? min : valuesMin;
  let high = numeric(max) ? max : valuesMax;
  if (type === "bar" || type === "area") {
    low = Math.min(0, low);
    high = Math.max(0, high);
  }
  if (high < low) [low, high] = [high, low];
  if (high === low && low === 0) high = 1;
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
  const pointLabel = (index: number) =>
    `${data[index].label}: ${visible.map((entry) => `${entry.label} ${numeric(data[index][entry.key]) ? valueText(data[index][entry.key] as number) : messages.noValue}`).join(", ")}`;
  const segments = (entry: ChartSeries) => {
    const result: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    data.forEach((point, index) => {
      const value = point[entry.key];
      if (numeric(value)) current.push({ x: x(index), y: y(value) });
      else if (current.length) {
        result.push(current);
        current = [];
      }
    });
    if (current.length) result.push(current);
    return result;
  };
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
          {series.map((entry) => (
            <Button
              aria-pressed={!hidden.has(entry.key)}
              className={
                hidden.has(entry.key) ? "line-through opacity-50" : undefined
              }
              key={entry.key}
              onClick={() => {
                setHidden((previous) => {
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
            {visible.map((entry, seriesIndex) => (
              <g className={colorOf(entry)} key={entry.key}>
                {type === "bar"
                  ? data.map((point, index) => {
                      const value = point[entry.key];
                      const barWidth = (step * 0.75) / visible.length;
                      return (
                        numeric(value) && (
                          <rect
                            height={Math.max(1, Math.abs(y(value) - y(0)))}
                            key={index}
                            width={Math.max(0.5, barWidth - 2)}
                            x={x(index) - step * 0.375 + seriesIndex * barWidth}
                            y={Math.min(y(value), y(0))}
                          />
                        )
                      );
                    })
                  : segments(entry).map((points, index) => (
                      <g key={index}>
                        {type === "area" && (
                          <path
                            d={`M${points[0].x},${y(0)} L${points.map((point) => `${point.x},${point.y}`).join(" L")} L${points[points.length - 1].x},${y(0)} Z`}
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
                  aria-label={pointLabel(index)}
                  className="fill-transparent stroke-transparent focus:stroke-primary-500 focus:outline-hidden"
                  height={plotHeight}
                  onBlur={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setActive(null);
                      return;
                    }
                    const target =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? data.length - 1
                          : event.key === "ArrowRight"
                            ? Math.min(data.length - 1, index + 1)
                            : event.key === "ArrowLeft"
                              ? Math.max(0, index - 1)
                              : null;
                    if (target === null) return;
                    event.preventDefault();
                    event.currentTarget.ownerSVGElement
                      ?.querySelector<SVGElement>(
                        `[data-chart-point="${target}"]`,
                      )
                      ?.focus();
                  }}
                  onClick={() => setActive(index)}
                  onMouseEnter={() => setActive(index)}
                  role="img"
                  tabIndex={0}
                  data-chart-point={index}
                  width={step}
                  x={left + index * step}
                  y={top}
                />
              </g>
            ))}
          </svg>
          {active !== null && data[active] && (
            <div
              className="pointer-events-none absolute top-2 z-1 max-w-64 rounded border border-neutral-200 bg-surface p-2 text-sm shadow dark:border-neutral-700 dark:bg-surface-dark"
              style={{ left: `${Math.min(70, (x(active) / width) * 100)}%` }}
            >
              <div className="font-semibold">{data[active].label}</div>
              {visible.map((entry) => (
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
