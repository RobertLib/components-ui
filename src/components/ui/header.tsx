import { ArrowLeft } from "lucide-react";
import { isValidElement } from "react";
import cn from "../../utils/cn";
import Breadcrumbs, { type BreadcrumbItem } from "./breadcrumbs";
import IconButton from "./icon-button";
import Skeleton from "./skeleton";
import VisuallyHidden from "./visually-hidden";
import { useMessages, useRouterActions } from "../../providers/ui-context";

export interface HeaderProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /** Buttons at the end of the row (the right side). */
  actions?: React.ReactNode;
  /** Rendered right next to the title, outside the heading - e.g. a search field. */
  afterTitle?: React.ReactNode;
  /**
   * Shows a back arrow before the title - it goes back in the history
   * (`router.back()` of `UIProvider`) or does what `onBack` says. See
   * `backHref` for a page the user may have opened directly.
   */
  back?: boolean;
  /**
   * Makes the back arrow a link to this page - e.g. the list a detail
   * belongs to, with its search kept. Going back in the history leaves the
   * app when the page was opened from a link, a bookmark or in a new tab;
   * a link always stays in it. Shows the arrow without `back` too. A click
   * on it also calls `onBack`.
   */
  backHref?: string;
  /**
   * The path to the page, above the title: `BreadcrumbItem`s - shown as
   * `Breadcrumbs`, from the home crumb to the page itself - or an element
   * of your own, e.g. `<Breadcrumbs maxItems={4} … />`.
   */
  breadcrumbs?: BreadcrumbItem[] | React.ReactNode;
  /**
   * Content under the row of the title, across the whole header - e.g. the
   * key facts of a record (`DescriptionList`), or the `Tabs` of its pages.
   */
  children?: React.ReactNode;
  /** A line under the title - e.g. the counts of a list or the dates of a record. */
  description?: React.ReactNode;
  /**
   * Level of the heading of the title - a page has one `h1`, a header in a
   * section or a dialog takes a lower one.
   * @default 1
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * What the back arrow does - goes back in the history by default; called
   * without arguments, so a router's `back` can be passed as it is. With
   * `backHref` the link navigates, and `onBack` runs at its click first,
   * given the click event - `event.preventDefault()` keeps the page, e.g.
   * to ask about unsaved changes (the router's `Link` must leave a
   * prevented click alone, as those of React Router and Next.js do). Not
   * at a click that opens the link in a new tab (Ctrl, Cmd, Shift, the
   * middle button) - the page stays.
   */
  onBack?: (event?: React.MouseEvent<HTMLElement>) => void;
  /**
   * Page title - `null` / `undefined` shows a placeholder while it loads,
   * and screen readers find the heading saying "Loading…".
   */
  title: React.ReactNode;
}

/** Whether a node renders anything - `false`, `null` and `""` do not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

/** Whether `breadcrumbs` are crumbs to render - not an element of the app. */
const isCrumbList = (value: unknown): value is BreadcrumbItem[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      !isValidElement(item) &&
      "label" in item,
  );

/**
 * The heading row of a page: optional back arrow, title and actions - the
 * `breadcrumbs` above it and `children` under it, each on a line of their
 * own. Printed, the back arrow and the actions are left out. `ref` and the
 * other props go to the header.
 */
export default function Header({
  actions,
  afterTitle,
  back,
  backHref,
  breadcrumbs,
  children,
  className,
  description,
  headingLevel = 1,
  onBack,
  title,
  ...props
}: HeaderProps) {
  const router = useRouterActions();
  const messages = useMessages().ui;
  const Heading = `h${headingLevel}` as const;

  // An empty path - the home page itself - shows nothing
  const crumbs = isCrumbList(breadcrumbs)
    ? breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />
    : breadcrumbs;

  return (
    <div
      {...props}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5",
        className,
      )}
    >
      {/* A line of its own in the wrapping row, closer to the title */}
      {hasContent(crumbs) && <div className="-mb-1 basis-full">{crumbs}</div>}
      <div className="flex min-w-0 items-center gap-2.5">
        {backHref !== undefined ? (
          <IconButton
            aria-label={messages.header.back}
            className="print:hidden"
            href={backHref}
            // Not for a click this page stays at - Ctrl, Cmd or Shift opens
            // the link in a new tab or window, Alt downloads it
            onClick={(event) => {
              const keepsPage =
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey;
              if (!keepsPage) onBack?.(event);
            }}
          >
            {/* Back is towards the start - to the right, right to left */}
            <ArrowLeft className="rtl:-scale-x-100" size={24} />
          </IconButton>
        ) : (
          back && (
            <IconButton
              aria-label={messages.header.back}
              className="print:hidden"
              // Not with the click - `back` and `onBack` take no arguments,
              // and a router's may read one as where to go
              onClick={() => (onBack ? onBack() : router.back())}
            >
              <ArrowLeft className="rtl:-scale-x-100" size={24} />
            </IconButton>
          )
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Heading className="font-heading text-page-title wrap-break-word">
              {title ?? (
                <>
                  <Skeleton
                    className="bg-neutral-200/70 dark:bg-neutral-800/70"
                    height="h-8"
                    width="w-[20vw]"
                  />
                  {/* The placeholder is a picture - the heading is not empty */}
                  <VisuallyHidden>{messages.common.loading}</VisuallyHidden>
                </>
              )}
            </Heading>
            {afterTitle}
          </div>
          {hasContent(description) && (
            <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {description}
            </div>
          )}
        </div>
      </div>
      {/* Commands are of no use on paper */}
      <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>
      {hasContent(children) && <div className="basis-full">{children}</div>}
    </div>
  );
}
