import { House } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import cn from "../../utils/cn";
import { useMessages, useRouter } from "../../providers/ui-context";

export interface BreadcrumbItem {
  /**
   * Leave out for the current page (the last item is never a link) - or for
   * a crumb that is no page of its own, which shows as text.
   */
  href?: string;
  /** `null` / `undefined` shows "…" while the label loads. */
  label: string | null | undefined;
}

export interface BreadcrumbsProps extends React.ComponentProps<"nav"> {
  /**
   * The first crumb, marked with a house icon. Defaults to the localized
   * "Home" linking to `/`; `false` removes it.
   */
  home?: { href: string; label: string } | false;
  /** The crumbs after the home crumb - the last one is the current page. */
  items: BreadcrumbItem[];
  /**
   * With `maxItems`, the crumbs shown after the "…" - the current page and
   * the ones before it.
   * @default 1
   */
  itemsAfterCollapse?: number;
  /**
   * With `maxItems`, the crumbs shown before the "…" - the home crumb
   * counts.
   * @default 1
   */
  itemsBeforeCollapse?: number;
  /**
   * The most crumbs shown, the home crumb included: a longer path shows
   * the first (`itemsBeforeCollapse`) and the last ones
   * (`itemsAfterCollapse`) with a "…" between them, which shows the whole
   * path - the focus moves to the first crumb it brings.
   */
  maxItems?: number;
  /**
   * Between the crumbs, e.g. `"/"` or `<ChevronRight size={14} />` - an icon
   * is mirrored in a right-to-left page. Decoration, screen readers skip it.
   * @default ">"
   */
  separator?: React.ReactNode;
}

type Crumb =
  { index: number; item: BreadcrumbItem; type: "item" } | { type: "ellipsis" };

/**
 * The path to the current page, starting at the home page. On a narrow
 * screen the crumbs wrap onto more lines, and a crumb too long for a line
 * of its own is truncated. A long path collapses to its ends with
 * `maxItems`. The current page - the last crumb - has `data-current`.
 */
export default function Breadcrumbs({
  className,
  home,
  items,
  itemsAfterCollapse = 1,
  itemsBeforeCollapse = 1,
  maxItems,
  separator = ">",
  ...props
}: BreadcrumbsProps) {
  const { Link } = useRouter();
  const messages = useMessages().ui;
  const [isExpanded, setIsExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  // The ellipsis was pressed - the crumbs it brings take the focus
  const focusRevealedRef = useRef(false);

  const homeItem =
    home === false
      ? null
      : (home ?? { href: "/", label: messages.breadcrumbs.home });

  const allItems = homeItem ? [homeItem, ...items] : items;

  const before = Math.max(Math.floor(itemsBeforeCollapse), 0);
  const after = Math.max(Math.floor(itemsAfterCollapse), 1);
  const isCollapsed =
    !isExpanded &&
    maxItems !== undefined &&
    allItems.length > Math.max(maxItems, 1) &&
    before + after < allItems.length;

  const crumbs: Crumb[] = allItems.map((item, index) => ({
    index,
    item,
    type: "item",
  }));
  const shown: Crumb[] = isCollapsed
    ? [
        ...crumbs.slice(0, before),
        { type: "ellipsis" },
        ...crumbs.slice(allItems.length - after),
      ]
    : crumbs;

  useLayoutEffect(() => {
    if (!isExpanded || !focusRevealedRef.current) return;
    focusRevealedRef.current = false;

    const list = listRef.current;
    const revealed = Array.from(
      list?.querySelectorAll<HTMLElement>("[data-crumb]") ?? [],
    ).slice(before, allItems.length - after);
    const target = revealed
      .map((crumb) => crumb.querySelector<HTMLElement>("a[href]"))
      .find((link) => link !== null);

    if (target) {
      target.focus();
    } else if (list) {
      // No link among them - the list holds the focus
      list.tabIndex = -1;
      list.focus();
    }
  }, [after, allItems.length, before, isExpanded]);

  const separatorElement = (
    // Screen readers announce the list - the separator is decoration
    <span
      aria-hidden="true"
      className="mx-2 flex shrink-0 items-center text-neutral-500 dark:text-neutral-400 rtl:[&>svg]:-scale-x-100"
    >
      {separator}
    </span>
  );

  const isHomeShown =
    !!homeItem && shown[0]?.type === "item" && shown[0].index === 0;

  return (
    <nav
      aria-label={messages.breadcrumbs.label}
      {...props}
      className={cn("min-w-0", className)}
    >
      <ol
        className="flex min-w-0 flex-wrap items-center gap-y-1 focus:outline-hidden"
        ref={listRef}
      >
        {isHomeShown && (
          <li aria-hidden="true" className="flex items-center">
            <Link className="cui-link" href={homeItem.href} tabIndex={-1}>
              <House className="me-1.5" size={12} />
            </Link>
          </li>
        )}
        {shown.map((crumb) => {
          if (crumb.type === "ellipsis") {
            return (
              <li className="flex items-center text-sm" key="ellipsis">
                <button
                  aria-label={messages.breadcrumbs.showAll}
                  className="cui-link cursor-pointer rounded px-1 leading-none text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  onClick={() => {
                    focusRevealedRef.current = true;
                    setIsExpanded(true);
                  }}
                  type="button"
                >
                  …
                </button>
                {separatorElement}
              </li>
            );
          }

          const { index, item } = crumb;
          const isLast = index === allItems.length - 1;
          const label = item.label ?? "...";

          return (
            <li
              className="flex min-w-0 items-center text-sm"
              data-crumb=""
              key={index}
            >
              {isLast ? (
                <span
                  aria-current="page"
                  className="truncate font-semibold text-neutral-500 dark:text-neutral-400"
                  data-current=""
                >
                  {label}
                </span>
              ) : item.href ? (
                <Link className="cui-link truncate" href={item.href}>
                  {label}
                </Link>
              ) : (
                <span className="truncate">{label}</span>
              )}
              {!isLast && separatorElement}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
