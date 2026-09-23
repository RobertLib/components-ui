import { Fragment } from "react";
import { Info } from "lucide-react";
import cn from "../utils/cn";
import Tooltip from "./tooltip";

export interface DescriptionListItem {
  term: string;
  desc: React.ReactNode;
  /** Extra classes for the term, e.g. a color that highlights the whole row. */
  termClassName?: string;
  /** Explanation shown in a tooltip behind an "i" icon next to the term. */
  termInfo?: string;
}

export interface DescriptionListProps extends React.ComponentProps<"dl"> {
  items: DescriptionListItem[];
  /** Shows placeholders instead of the descriptions. */
  loading?: boolean;
  /** Fixed width of the term column (any CSS length); sized to the terms by default. */
  termWidth?: string;
}

const placeholderWidths = ["w-34", "w-30", "w-26", "w-38", "w-42", "w-46"];

const getPlaceholderWidth = (index: number): string =>
  placeholderWidths[index % placeholderWidths.length];

/**
 * Term / description pairs - two columns from the `md` breakpoint up,
 * stacked on phones.
 */
export default function DescriptionList({
  className,
  items,
  loading = false,
  style,
  termWidth,
  ...props
}: DescriptionListProps) {
  return (
    <dl
      {...props}
      className={cn(
        "space-y-1 md:grid md:items-baseline md:space-y-0 md:gap-x-4 md:gap-y-2",
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
      {items.map((item, index) => (
        <Fragment key={index}>
          <dt
            className={cn(
              "flex items-center gap-1 text-sm font-semibold",
              item.termClassName,
            )}
          >
            {item.term}:
            {item.termInfo && (
              <Tooltip delay={300} openOnClick title={item.termInfo}>
                <Info
                  aria-label={item.termInfo}
                  className="shrink-0 cursor-help text-neutral-500 dark:text-neutral-400"
                  role="img"
                  size={14}
                />
              </Tooltip>
            )}
          </dt>
          {/* min-w-0: a grid item defaults to a min-content floor, which lets long
              unbreakable content (a filename, a URL) blow the track past its
              container instead of wrapping or truncating inside it. */}
          <dd className="min-w-0 pb-1.5 text-neutral-500 md:pb-0 dark:text-neutral-400">
            {loading ? (
              <div
                className={`h-4 ${getPlaceholderWidth(index)} animate-pulse rounded bg-neutral-200 dark:bg-neutral-700`}
              />
            ) : (
              item.desc
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
