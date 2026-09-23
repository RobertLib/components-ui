import { House } from "lucide-react";
import cn from "../utils/cn";
import { useMessages, useRouter } from "../providers/ui-context";

export interface BreadcrumbItem {
  /** Leave out for the current page (the last item is never a link). */
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

/** The path to the current page, starting at the home page. */
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
      className={cn("truncate", className)}
    >
      <ol className="flex items-center">
        {homeItem && (
          <li aria-hidden="true" className="flex items-center">
            <Link className="link" href={homeItem.href} tabIndex={-1}>
              <House className="mr-1.5" size={12} />
            </Link>
          </li>
        )}
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li
              className="text-sm after:mx-2 after:text-neutral-500 after:content-['>'] last:after:content-['']"
              key={index}
            >
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-semibold text-neutral-500 dark:text-neutral-400"
                >
                  {item.label ?? "..."}
                </span>
              ) : (
                <Link className="link" href={item.href ?? "/"}>
                  {item.label ?? "..."}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
