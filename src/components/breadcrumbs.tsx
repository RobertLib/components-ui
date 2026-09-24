import { House } from "lucide-react";
import cn from "../utils/cn";
import { useMessages, useRouter } from "../providers/ui-context";

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
}

/**
 * The path to the current page, starting at the home page. On a narrow
 * screen the crumbs wrap onto more lines, and a crumb too long for a line
 * of its own is truncated.
 */
export default function Breadcrumbs({
  className,
  home,
  items,
  ...props
}: BreadcrumbsProps) {
  const { Link } = useRouter();
  const messages = useMessages();

  const homeItem =
    home === false
      ? null
      : (home ?? { href: "/", label: messages.breadcrumbs.home });

  const allItems = homeItem ? [homeItem, ...items] : items;

  return (
    <nav
      aria-label={messages.breadcrumbs.label}
      {...props}
      className={cn("min-w-0", className)}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-y-1">
        {homeItem && (
          <li aria-hidden="true" className="flex items-center">
            <Link className="link" href={homeItem.href} tabIndex={-1}>
              <House className="mr-1.5" size={12} />
            </Link>
          </li>
        )}
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const label = item.label ?? "...";

          return (
            <li className="flex min-w-0 items-center text-sm" key={index}>
              {isLast ? (
                <span
                  aria-current="page"
                  className="truncate font-semibold text-neutral-500 dark:text-neutral-400"
                >
                  {label}
                </span>
              ) : item.href ? (
                <Link className="link truncate" href={item.href}>
                  {label}
                </Link>
              ) : (
                <span className="truncate">{label}</span>
              )}
              {/* Screen readers announce the list - the arrow is decoration */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="mx-2 shrink-0 text-neutral-500 dark:text-neutral-400"
                >
                  &gt;
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
