import { useEffect } from "react";
import cn from "../utils/cn";
import logger from "../utils/logger";
import Panel, { type PanelProps } from "./panel";
import Skeleton from "./skeleton";
import { useRouter } from "../providers/ui-context";

export interface CardProps extends Omit<PanelProps, "onClick" | "title"> {
  /**
   * Buttons or a menu at the end of the header, e.g. an `IconButton` with a
   * `Dropdown` - they stay clickable in a clickable card.
   */
  actions?: React.ReactNode;
  /** The content - the body of the card, under the header. */
  children?: React.ReactNode;
  /** A line under the title. */
  description?: React.ReactNode;
  /**
   * The bottom of the card, under a line - e.g. the buttons of a form or a
   * "View all" link. It stays clickable in a clickable card.
   */
  footer?: React.ReactNode;
  /**
   * Level of the heading of `title` - the level below the headings around.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Makes the whole card a link to this URL, rendered with the router's
   * `Link` configured in `UIProvider`. The title is the link - stretched
   * over the card, so screen readers hear the title alone and the `actions`
   * and the `footer` stay buttons of their own. Needs a `title`.
   */
  href?: string;
  /**
   * Placeholders in place of the media, the title, the description and the
   * content; the actions and the footer are left out meanwhile. The card is
   * `aria-busy`.
   */
  loading?: boolean;
  /**
   * An image or another picture at the top, from edge to edge - e.g.
   * `<img alt="" src={cover} />`.
   */
  media?: React.ReactNode;
  /**
   * Makes the whole card a button - the title is the button, stretched
   * over the card, like the link of `href`. Needs a `title`.
   */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** The heading of the card - see `headingLevel`. */
  title?: React.ReactNode;
}

/** Whether a node renders anything - `cond && footer` leaves one out. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

// The link or the button of the title covers the whole card - its focus
// ring is drawn by the card, around its own corners
const stretchedClassName =
  "text-start after:absolute after:inset-0 after:z-0 after:content-[''] focus:outline-hidden";

/**
 * A card: an optional picture, a header with a title, a description and
 * actions, the content, and a footer - on the surface of a `Panel`. With
 * `href` or `onClick` the whole card is a link or a button, through its
 * title (the "stretched link"): links and buttons of the `actions` and the
 * `footer` stay clickable above it. A link in the content needs
 * `relative z-10` to stay clickable too.
 */
export default function Card({
  actions,
  children,
  className,
  description,
  footer,
  headingLevel = 3,
  href,
  loading = false,
  media,
  onClick,
  title,
  ...props
}: CardProps) {
  const { Link } = useRouter();
  const Heading = `h${headingLevel}` as const;
  const hasTitle = hasContent(title);
  const isClickable = (href !== undefined || onClick !== undefined) && !loading;
  const isLink = isClickable && href !== undefined;
  const isButton = isClickable && !isLink && hasTitle;

  useEffect(() => {
    if ((href !== undefined || onClick !== undefined) && !hasTitle) {
      logger.warn(
        "Card: a card with `href` or `onClick` needs a `title` - the title is its link or button.",
      );
    }
  }, [hasTitle, href, onClick]);

  const hasHeader =
    hasTitle || hasContent(description) || (!loading && hasContent(actions));

  const titleContent =
    isLink && hasTitle ? (
      <Link className={stretchedClassName} data-card-link="" href={href}>
        {title}
      </Link>
    ) : isButton ? (
      <button
        className={cn(stretchedClassName, "cursor-pointer")}
        data-card-link=""
        onClick={onClick}
        type="button"
      >
        {title}
      </button>
    ) : (
      title
    );

  return (
    <Panel
      aria-busy={loading || undefined}
      {...props}
      className={cn(
        "relative flex min-w-0 flex-col gap-4",
        (isLink || isButton) && [
          "group transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none",
          // The ring of the focused title link - around the whole card, an
          // outline in forced colors mode, which drops the ring
          "has-[[data-card-link]:focus-visible]:ring-2 has-[[data-card-link]:focus-visible]:ring-primary-500 forced-colors:has-[[data-card-link]:focus-visible]:outline-2",
        ],
        className,
      )}
    >
      {hasContent(media) && (
        <div className="-mx-6 -mt-6 overflow-hidden rounded-t-[inherit] [&>img]:block [&>img]:w-full [&>img]:object-cover">
          {loading ? (
            <Skeleton className="rounded-none" height="h-40" />
          ) : (
            media
          )}
        </div>
      )}

      {loading ? (
        <>
          <div aria-hidden="true" className="flex flex-col gap-2">
            <Skeleton height="h-5" width="w-2/5" />
            <Skeleton height="h-3" width="w-3/5" />
          </div>
          <Skeleton lines={3} variant="text" />
        </>
      ) : (
        <>
          {hasHeader && (
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                {hasTitle && (
                  <Heading
                    className={cn(
                      "text-base font-semibold text-neutral-900 dark:text-neutral-50",
                      (isLink || isButton) &&
                        "transition-colors group-hover:text-primary-700 motion-reduce:transition-none dark:group-hover:text-primary-300",
                    )}
                  >
                    {titleContent}
                  </Heading>
                )}
                {hasContent(description) && (
                  <p
                    className={cn(
                      "text-sm text-neutral-600 dark:text-neutral-400",
                      hasTitle && "mt-1",
                    )}
                  >
                    {description}
                  </p>
                )}
              </div>
              {hasContent(actions) && (
                // Above the stretched link of the title
                <div className="relative z-10 -my-1 flex shrink-0 items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
          )}

          {hasContent(children) && <div className="min-w-0">{children}</div>}

          {hasContent(footer) && (
            <div className="relative z-10 -mx-6 -mb-6 flex flex-wrap items-center gap-2 border-t border-neutral-200 px-6 py-4 dark:border-neutral-800">
              {footer}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
