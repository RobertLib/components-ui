import {
  createContext,
  use,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cn from "../utils/cn";

export type TableDensity = "compact" | "normal" | "comfortable";

export interface TableProps extends React.ComponentProps<"table"> {
  /** Lines between the columns too - not only between the rows. */
  bordered?: boolean;
  /**
   * The title of the table, above it - also its accessible name, and the
   * name of the region a scrolling table is.
   */
  caption?: React.ReactNode;
  /**
   * Classes of the frame around the table - it scrolls a table wider (or,
   * with `maxHeight`, higher) than itself.
   */
  containerClassName?: string;
  /**
   * The padding of the cells.
   * @default "normal"
   */
  density?: TableDensity;
  /** Highlights the row under the pointer. */
  hover?: boolean;
  /**
   * The highest the frame gets, as a CSS length (`"24rem"`) - a longer
   * table scrolls in it, with a `stickyHeader`.
   */
  maxHeight?: string;
  /**
   * Keeps the header row in sight while the table scrolls in its frame -
   * give it a `maxHeight`.
   */
  stickyHeader?: boolean;
  /** Tints every other row of the body. */
  striped?: boolean;
}

export type TableHeadProps = React.ComponentProps<"thead">;
export type TableBodyProps = React.ComponentProps<"tbody">;
export type TableFootProps = React.ComponentProps<"tfoot">;
export type TableRowProps = React.ComponentProps<"tr">;

export interface TableCellProps extends Omit<
  React.ComponentProps<"td">,
  "align"
> {
  /**
   * Alignment of the content - `end` for numbers, so that their digits line
   * up. The start and the end are swapped in a right-to-left page.
   * @default "start"
   */
  align?: "start" | "center" | "end";
  /**
   * A header cell (`<th>`) - of its row in the body (`scope="row"`), e.g.
   * the name the other cells of the row describe. The cells of `TableHead`
   * are header cells of their columns anyway.
   */
  header?: boolean;
}

interface TableOptions {
  bordered: boolean;
  density: TableDensity;
  hover: boolean;
  stickyHeader: boolean;
  striped: boolean;
}

const TableContext = createContext<TableOptions>({
  bordered: false,
  density: "normal",
  hover: false,
  stickyHeader: false,
  striped: false,
});

/** The part of the table a row is in. */
const SectionContext = createContext<"body" | "foot" | "head">("body");

const densityClasses: Record<TableDensity, string> = {
  compact: "px-2 py-1",
  normal: "px-3 py-2",
  comfortable: "px-4 py-3",
};

const alignClasses = {
  center: "text-center",
  end: "text-end",
  start: "text-start",
};

/**
 * A table of static data - its parts are those of an HTML table:
 * `TableHead`, `TableBody` and `TableFoot` with `TableRow`s of
 * `TableCell`s. With `striped`, `hover`, `bordered` and `density` for the
 * look, a `caption`, and a `stickyHeader`. A table wider than its frame
 * scrolls sideways - a Tab stop then, so that the keyboard scrolls it too.
 * For data that is sorted, filtered, paged or edited, use `DataTable`. The
 * attributes and the `ref` go to the `<table>` - the frame around it takes
 * `containerClassName`.
 */
export default function Table({
  bordered = false,
  caption,
  children,
  className,
  containerClassName,
  density = "normal",
  hover = false,
  maxHeight,
  stickyHeader = false,
  striped = false,
  ...props
}: TableProps) {
  const captionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  // A frame that scrolls is a Tab stop and a named region - the keyboard
  // scrolls it, also in the browsers that do not focus scrollers
  const [isScrollable, setIsScrollable] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const next =
        container.scrollWidth > container.clientWidth + 1 ||
        container.scrollHeight > container.clientHeight + 1;
      setIsScrollable((previous) => (previous === next ? previous : next));
    };

    update();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }
    return () => observer.disconnect();
  }, []);

  const hasCaption =
    caption !== undefined && caption !== null && caption !== false;

  // The region is named like the table - by its caption, or its own name
  const regionName = !isScrollable
    ? {}
    : hasCaption
      ? { "aria-labelledby": captionId }
      : {
          "aria-label": props["aria-label"],
          "aria-labelledby": props["aria-labelledby"],
        };
  const isNamed =
    hasCaption || !!regionName["aria-label"] || !!regionName["aria-labelledby"];

  return (
    <div
      {...regionName}
      className={cn(
        "overflow-auto rounded-lg border border-neutral-200 bg-surface focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:bg-surface-dark",
        containerClassName,
      )}
      ref={containerRef}
      // A region without a name would be one more landmark to skip
      role={isScrollable && isNamed ? "region" : undefined}
      style={maxHeight ? { maxHeight } : undefined}
      tabIndex={isScrollable ? 0 : undefined}
    >
      <TableContext value={{ bordered, density, hover, stickyHeader, striped }}>
        <table
          {...props}
          // Separate borders - the lines of a sticky header stay with it
          className={cn(
            "w-full border-separate border-spacing-0 text-sm text-neutral-700 dark:text-neutral-300",
            className,
          )}
        >
          {hasCaption && (
            <caption
              className="border-b border-neutral-200 px-3 py-2 text-start font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100"
              id={captionId}
            >
              {caption}
            </caption>
          )}
          {children}
        </table>
      </TableContext>
    </div>
  );
}

/** The header rows of a `Table` - their cells are column headers. */
export function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <SectionContext value="head">
      <thead {...props} className={className} />
    </SectionContext>
  );
}

/** The rows of the data of a `Table`. */
export function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <SectionContext value="body">
      <tbody
        {...props}
        // The frame draws the line under the last row
        className={cn("[&>tr:last-child>*]:border-b-0", className)}
      />
    </SectionContext>
  );
}

/** The footer rows of a `Table`, e.g. the totals - under a line. */
export function TableFoot({ className, ...props }: TableFootProps) {
  return (
    <SectionContext value="foot">
      <tfoot
        {...props}
        className={cn(
          "bg-neutral-50 font-medium text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 [&>tr:first-child>*]:border-t [&>tr:last-child>*]:border-b-0",
          className,
        )}
      />
    </SectionContext>
  );
}

/** A row of a `Table`. */
export function TableRow({ className, ...props }: TableRowProps) {
  const { hover, striped } = use(TableContext);
  const section = use(SectionContext);
  const isBody = section === "body";

  return (
    <tr
      {...props}
      className={cn(
        isBody && [
          striped && "even:bg-neutral-50 dark:even:bg-neutral-900/60",
          hover &&
            "transition-colors hover:bg-neutral-100 motion-reduce:transition-none dark:hover:bg-neutral-800/70",
        ],
        className,
      )}
    />
  );
}

/**
 * A cell of a `TableRow` - a column header (`<th>`) in `TableHead`, a data
 * cell (`<td>`) elsewhere, or with `header` the header of its row.
 */
export function TableCell({
  align = "start",
  className,
  header = false,
  scope,
  ...props
}: TableCellProps) {
  const { bordered, density, stickyHeader } = use(TableContext);
  const section = use(SectionContext);
  const isHead = section === "head";
  const isHeader = isHead || header;

  const classNames = cn(
    "border-b border-neutral-200 align-middle dark:border-neutral-800",
    densityClasses[density],
    alignClasses[align],
    bordered && "border-e last:border-e-0",
    isHead &&
      "bg-neutral-50 text-xs font-semibold tracking-wide text-neutral-600 uppercase dark:bg-neutral-900 dark:text-neutral-400",
    isHead && stickyHeader && "sticky top-0 z-10",
    header && !isHead && "font-medium text-neutral-900 dark:text-neutral-100",
    className,
  );

  if (isHeader) {
    return (
      <th
        {...(props as React.ComponentProps<"th">)}
        className={classNames}
        scope={scope ?? (isHead ? "col" : "row")}
      />
    );
  }

  return <td {...props} className={classNames} scope={scope} />;
}
