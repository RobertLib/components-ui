import { Fragment } from "react";
import { Info } from "lucide-react";
import cn from "../utils/cn";
import Tooltip from "./tooltip";
import { useMessages } from "../providers/ui-context";

export interface DescriptionListItem {
  /**
   * Name of the value, e.g. "Email" - followed by `form.labelSuffix` of the
   * locale, a colon in English.
   */
  term: string;
  /** The value - text or any content (a link, a `Chip`, …). */
  desc: React.ReactNode;
  /**
   * Takes a whole row of a list with `columns`, e.g. a long note or an
   * address.
   */
  fullWidth?: boolean;
  /** Extra classes for the term, e.g. a color that highlights the whole row. */
  termClassName?: string;
  /**
   * Explanation shown in a tooltip behind an "i" button next to the term -
   * on hover, on keyboard focus and on a click or tap.
   */
  termInfo?: string;
}

export interface DescriptionListProps extends React.ComponentProps<"dl"> {
  /** Lines between the rows - of the pairs, or of the columns of pairs. */
  bordered?: boolean;
  /**
   * Pairs side by side: each term above its value, in up to this many
   * columns - two from the `sm` breakpoint up, all from `lg`; stacked on
   * phones. With 1, the terms are a column beside the values from `md` up.
   * @default 1
   */
  columns?: 1 | 2 | 3 | 4;
  /** The term / description pairs, in order. */
  items: DescriptionListItem[];
  /** Shows placeholders instead of the descriptions. */
  loading?: boolean;
  /**
   * Fixed width of the term column (any CSS length); sized to the terms by
   * default. Only with one column.
   */
  termWidth?: string;
}

const placeholderWidths = ["w-34", "w-30", "w-26", "w-38", "w-42", "w-46"];

const getPlaceholderWidth = (index: number): string =>
  placeholderWidths[index % placeholderWidths.length];

// Whole class names - two columns from `sm`, all of them from `lg`
const columnClasses: Record<
  NonNullable<DescriptionListProps["columns"]>,
  string
> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * Term / description pairs - two columns from the `md` breakpoint up,
 * stacked on phones; or, with `columns`, several pairs side by side, each
 * term above its value.
 */
export default function DescriptionList({
  bordered = false,
  className,
  columns = 1,
  items,
  loading = false,
  style,
  termWidth,
  ...props
}: DescriptionListProps) {
  const messages = useMessages();
  const isGrid = columns > 1;

  const renderTerm = (item: DescriptionListItem) => (
    <dt
      className={cn(
        "flex items-center gap-1 text-sm font-semibold",
        item.termClassName,
      )}
    >
      {item.term}
      {messages.form.labelSuffix}
      {item.termInfo && (
        <Tooltip delay={300} openOnClick title={item.termInfo}>
          {/* A button, so the keyboard reaches the explanation too - a
              generic name, the tooltip describes it */}
          <button
            aria-label={messages.descriptionList.moreInfo}
            className="shrink-0 cursor-help rounded text-neutral-500 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400"
            type="button"
          >
            <Info aria-hidden="true" size={14} />
          </button>
        </Tooltip>
      )}
    </dt>
  );

  const renderDescription = (
    item: DescriptionListItem,
    index: number,
    className?: string,
  ) => (
    // min-w-0: a grid item defaults to a min-content floor, which lets long
    // unbreakable content (a filename, a URL) blow the track past its
    // container instead of wrapping or truncating inside it
    <dd
      className={cn(
        "min-w-0 text-neutral-500 dark:text-neutral-400",
        className,
      )}
    >
      {loading ? (
        <div
          className={`h-4 ${getPlaceholderWidth(index)} animate-pulse rounded bg-neutral-200 dark:bg-neutral-700`}
        />
      ) : (
        item.desc
      )}
    </dd>
  );

  if (isGrid) {
    return (
      <dl
        {...props}
        className={cn(
          "grid grid-cols-1",
          columnClasses[columns],
          // The lines are the top borders of the pairs - pulled up by their
          // width, the ones of the first row out of sight. They run on
          // through the columns: the room between these is a padding.
          bordered ? "overflow-hidden" : "gap-x-6 gap-y-4",
          className,
        )}
        style={style}
      >
        {items.map((item, index) => (
          // A group of a term and its value - allowed in a <dl>
          <div
            className={cn(
              "min-w-0",
              item.fullWidth && "sm:col-span-full",
              bordered &&
                "-mt-px border-t border-neutral-200 py-3 pe-6 dark:border-neutral-800",
            )}
            key={index}
          >
            {renderTerm(item)}
            {renderDescription(item, index, "mt-1")}
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl
      {...props}
      className={cn(
        "md:grid md:items-baseline md:gap-x-4",
        bordered ? "md:gap-y-0" : "space-y-1 md:space-y-0 md:gap-y-2",
        termWidth
          ? "md:grid-cols-[var(--term-width)_1fr]"
          : "md:grid-cols-[auto_1fr]",
        className,
      )}
      style={
        termWidth
          ? ({
              ...style,
              "--term-width": termWidth,
            } as React.CSSProperties)
          : style
      }
    >
      {items.map((item, index) =>
        bordered ? (
          // A row of the grid of the list - the term keeps its column
          <div
            className={cn(
              "border-neutral-200 py-2.5 md:col-span-2 md:grid md:grid-cols-subgrid md:items-baseline dark:border-neutral-800",
              index > 0 && "border-t",
            )}
            key={index}
          >
            {renderTerm(item)}
            {renderDescription(item, index, "mt-1 md:mt-0")}
          </div>
        ) : (
          <Fragment key={index}>
            {renderTerm(item)}
            {renderDescription(item, index, "pb-1.5 md:pb-0")}
          </Fragment>
        ),
      )}
    </dl>
  );
}
