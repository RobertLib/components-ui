import {
  createContext,
  use,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cn from "../../utils/cn";
import logger from "../../utils/logger";
import { isSafeHref } from "../../utils/sanitize-rich-text";
import toAppPath from "../../utils/to-app-path";
import { useNavigate } from "../../providers/ui-context";
import {
  followRowLink,
  handleRowPress,
  isNewTabClick,
  isPassedClick,
  isRowActivation,
  middleButtonHandlers,
  newTabUrl,
  openInNewTab,
} from "./row-activation";

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
export interface TableRowProps extends React.ComponentProps<"tr"> {
  /**
   * Makes the whole row a link for the pointer - e.g. a list whose rows
   * open the detail of a record. A click on the row, not on a control in
   * it nor at the end of selecting its text, follows the link of the row
   * as a click on it would: the one with `data-row-link`, or the one to
   * this `href` (also written otherwise, or under the base path of a
   * router). The middle button and a click with Ctrl, Cmd or Shift open it
   * in a new tab. Put the link in the cell that names the row - the
   * keyboard and screen readers use it, the row itself is no control.
   * Without one the row navigates through the router of `UIProvider` (an
   * absolute URL with a page load), with a warning in development at a
   * click - and only an absolute URL opens in a new tab: a path of the app
   * lacks the base path only the router's `Link` knows.
   */
  href?: string;
}

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

const TableContext = /* @__PURE__ */ createContext<TableOptions>({
  bordered: false,
  density: "normal",
  hover: false,
  stickyHeader: false,
  striped: false,
});

/** The part of the table a row is in. */
const SectionContext = /* @__PURE__ */ createContext<"body" | "foot" | "head">(
  "body",
);

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

/**
 * Whether `anchor` links to `href` written otherwise - an absolute URL of
 * this page's origin for a link to its path, say.
 */
function isSameUrl(anchor: HTMLAnchorElement, href: string) {
  try {
    return anchor.href === new URL(href, anchor.baseURI).href;
  } catch {
    return false;
  }
}

/**
 * Whether `anchor` is the link to the path `href` as the `Link` of a router
 * renders it - under its base path (`/app/orders/42` for `/orders/42`) or
 * after the `#` of a hash router on this page.
 */
function linksTo(anchor: HTMLAnchorElement, href: string) {
  // A path of the app, as the browser reads it (without spaces around) -
  // the router may render another URL for it
  const path = toAppPath(href);
  if (path === null || !path.startsWith("/")) return false;

  try {
    const link = new URL(anchor.href);
    // A hash router links this page with the path after its `#` - encoded
    // as the browser encodes the link's (`Nov%C3%A1kov%C3%A1`). Not another
    // page or site with the path after its `#`, which is another app.
    const hashed = new URL(anchor.ownerDocument.URL);
    hashed.hash = path;
    if (link.href === hashed.href) return true;

    // The path on the page's site - not on that of the link, which would
    // take a link to another site for it
    const target = new URL(path, anchor.baseURI);
    return (
      link.origin === target.origin &&
      // Its path ends with that of `href` - at a `/`, which starts it
      link.pathname.endsWith(target.pathname) &&
      link.search === target.search &&
      link.hash === target.hash
    );
  } catch {
    return false;
  }
}

/** A row of a `Table` - with `href`, a link to the detail it shows. */
export function TableRow({
  className,
  href,
  onAuxClick,
  onClick,
  onMouseDown,
  onMouseDownCapture,
  ...props
}: TableRowProps) {
  const { hover, striped } = use(TableContext);
  const section = use(SectionContext);
  const isBody = section === "body";
  const isLink = href !== undefined;
  // Not `useRouter`, which reads the location - no row needs to render again
  // on a navigation
  const navigate = useNavigate();

  /** The link of the row - with `data-row-link`, or the one to `href`. */
  const findLink = (row: HTMLElement) => {
    const marked = row.querySelector("[data-row-link]");
    if (marked || href === undefined) return marked;

    const anchors = Array.from(
      row.querySelectorAll<HTMLAnchorElement>("a[href]"),
    );
    // The link to `href` itself before one a router renders for it - and
    // of those the shortest path, the base path of the router before a
    // longer path that ends alike (`/customers/9/orders/5` for `/orders/5`)
    return (
      anchors.find((anchor) => anchor.getAttribute("href") === href) ??
      anchors.find((anchor) => isSameUrl(anchor, href)) ??
      anchors
        .filter((anchor) => linksTo(anchor, href))
        .sort((a, b) => a.pathname.length - b.pathname.length)[0]
    );
  };

  /** Opens `href` of a row without a link to follow. */
  const openHref = (url: string, newTab: boolean) => {
    logger.warn(
      "TableRow: a row with `href` needs a link to it in the cell that names it (`data-row-link`) - the keyboard and screen readers have no other way to it.",
    );

    // Only links - a `javascript:` URL would run in the page
    if (!isSafeHref(url)) {
      logger.error("TableRow opens no href that is not a link:", url);
    } else if (newTab) {
      // A new tab as the middle button opens - not for a path of the app
      const newTabHref = newTabUrl(null, url);
      if (newTabHref !== null) openInNewTab(newTabHref);
    } else {
      const path = toAppPath(url);
      if (path === null) {
        window.location.assign(url);
      } else {
        navigate(path);
      }
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
    // The click passed on to the link of the row comes back to it - the
    // `onClick` of the row had the user's click already
    if (isPassedClick(event.nativeEvent)) return;

    onClick?.(event);
    if (!isLink || event.defaultPrevented || !isRowActivation(event)) return;

    // The link of the row follows the click - in a new tab for Ctrl + click
    const link = findLink(event.currentTarget);
    if (link) {
      followRowLink(link, href, event);
    } else {
      openHref(href, isNewTabClick(event));
    }
  };

  // The middle button opens the link in a new tab. Not a path of the app
  // without one: under the base path of a router it would be another page,
  // only its `Link` knows the URL.
  const middleButton = isLink ? middleButtonHandlers(href, findLink) : null;

  const handleAuxClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
    onAuxClick?.(event);
    if (!event.defaultPrevented) middleButton?.onAuxClick(event);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLTableRowElement>) => {
    onMouseDown?.(event);
    middleButton?.onMouseDown(event);
  };

  const handleMouseDownCapture = (
    event: React.MouseEvent<HTMLTableRowElement>,
  ) => {
    onMouseDownCapture?.(event);
    handleRowPress(event);
  };

  return (
    <tr
      {...props}
      className={cn(
        isBody && [
          striped && "even:bg-neutral-50 dark:even:bg-neutral-900/60",
          (hover || isLink) &&
            "transition-colors hover:bg-neutral-100 motion-reduce:transition-none dark:hover:bg-neutral-800/70",
          isLink && "cursor-pointer",
        ],
        className,
      )}
      onAuxClick={isLink ? handleAuxClick : onAuxClick}
      onClick={isLink ? handleClick : onClick}
      onMouseDown={isLink ? handleMouseDown : onMouseDown}
      onMouseDownCapture={isLink ? handleMouseDownCapture : onMouseDownCapture}
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
