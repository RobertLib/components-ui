import { ChevronRight } from "lucide-react";
import { createContext, use } from "react";
import cn from "../../utils/cn";
import { useRouterActions } from "../../providers/ui-context";

export type ListVariant = "divided" | "framed" | "plain" | "separate";

export type ListItemIconColor =
  "primary" | "neutral" | "success" | "warning" | "danger" | "info";

export interface ListProps extends React.ComponentProps<"ul"> {
  /**
   * The size of the text and the icons - `sm` for the lists of a page
   * section, `md` for a menu or a list a phone is tapped through.
   * @default "sm"
   */
  size?: "sm" | "md";
  /**
   * `divided` - rows with lines between them, in the width of the content
   * around (a section of a card); `framed` - the rows in a frame of their
   * own; `plain` - rows without lines, rounded under the pointer (a menu);
   * `separate` - every row a card of its own, with a gap between them.
   * @default "divided"
   */
  variant?: ListVariant;
}

export interface ListItemProps extends Omit<
  React.ComponentProps<"li">,
  "onClick" | "title"
> {
  /**
   * Buttons at the end of the row, outside its link or button - e.g. an
   * edit `IconButton`. A row that is a link cannot hold controls itself.
   */
  actions?: React.ReactNode;
  /**
   * A chevron at the end of a row that is a link or a button, which says it
   * leads on. On by default for those.
   */
  chevron?: boolean;
  /**
   * The row is the page shown - `aria-current="page"`, highlighted in a
   * `plain` list (a menu). A button, which switches a view of the page
   * rather than opening a page, is the current one of its list
   * (`aria-current="true"`).
   */
  current?: boolean;
  /** A line under the title, e.g. a count or a date. */
  description?: React.ReactNode;
  /** The row is a link or a button that cannot be used now. */
  disabled?: boolean;
  /**
   * Content at the end of the row, before the chevron - a `Chip`, a value.
   * It is part of the link or button of the row: no controls in it - see
   * `actions`.
   */
  end?: React.ReactNode;
  /**
   * Makes the whole row a link to this URL, rendered with the router's
   * `Link` of `UIProvider`.
   */
  href?: string;
  /**
   * An icon at the start, on a tinted square - a lucide-react icon is sized
   * to it. Decorative: the title says what the row is.
   */
  icon?: React.ReactNode;
  /**
   * The tint of the `icon`.
   * @default "primary"
   */
  iconColor?: ListItemIconColor;
  /**
   * Makes the whole row a button - or, with `href`, is called before its
   * link is followed, e.g. to close the drawer of a menu;
   * `event.preventDefault()` keeps the page.
   */
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  /**
   * Content at the start in place of an `icon`, as it is - e.g. an
   * `Avatar` or a thumbnail.
   */
  start?: React.ReactNode;
  /** What the row is - its name, the main text. */
  title: React.ReactNode;
}

interface ListOptions {
  size: "sm" | "md";
  variant: ListVariant;
}

const ListContext = /* @__PURE__ */ createContext<ListOptions>({
  size: "sm",
  variant: "divided",
});

/** Whether a slot renders anything - the `false` of a condition does not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

const listClasses: Record<ListVariant, string> = {
  divided:
    "divide-y divide-neutral-100 dark:divide-neutral-800 forced-colors:divide-[CanvasText]",
  framed:
    "divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-surface dark:divide-neutral-800 dark:border-neutral-800 dark:bg-surface-dark",
  plain: "flex flex-col gap-1",
  separate: "flex flex-col gap-3",
};

// The row - its padding, and the frame of a `separate` one
const rowClasses: Record<ListVariant, string> = {
  divided: "py-3",
  framed: "px-4 py-3",
  plain: "rounded-lg px-3 py-2",
  separate:
    "rounded-xl border border-neutral-200 bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-surface-dark",
};

// Under the pointer - a link or a button
const interactiveClasses: Record<ListVariant, string> = {
  divided: "hover:bg-neutral-50 dark:hover:bg-neutral-800/60",
  framed: "hover:bg-neutral-50 dark:hover:bg-neutral-800/60",
  plain: "hover:bg-neutral-100 dark:hover:bg-neutral-800",
  separate: "transition-shadow hover:shadow-md",
};

const iconColors: Record<ListItemIconColor, string> = {
  primary:
    "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300",
  neutral:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  success:
    "bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300",
  warning:
    "bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-300",
  danger:
    "bg-danger-50 text-danger-700 dark:bg-danger-950 dark:text-danger-300",
  info: "bg-info-50 text-info-700 dark:bg-info-950 dark:text-info-300",
};

const sizeClasses = {
  sm: {
    description: "text-xs",
    icon: "size-8 rounded-lg [&>svg]:size-4",
    title: "text-sm",
  },
  md: {
    description: "text-sm",
    icon: "size-10 rounded-xl [&>svg]:size-5",
    title: "text-base",
  },
};

/**
 * A list of rows - an icon or an avatar, a title, a description, content
 * at the end, and a chevron where a row leads on: the sections of a record,
 * a mobile menu, the recent changes on a dashboard, accounts to pick from.
 * A row with `href` is a link, with `onClick` a button - the whole row.
 * Wrap a menu in a `<nav>`.
 */
export default function List({
  className,
  size = "sm",
  variant = "divided",
  ...props
}: ListProps) {
  return (
    <ListContext value={{ size, variant }}>
      <ul
        // Safari drops the list semantics of a list without bullets
        role="list"
        {...props}
        className={cn(listClasses[variant], className)}
      />
    </ListContext>
  );
}

/** A row of a `List` - see `ListItemProps`. */
export function ListItem({
  actions,
  chevron,
  className,
  current = false,
  description,
  disabled = false,
  end,
  href,
  icon,
  iconColor = "primary",
  onClick,
  start,
  title,
  ...props
}: ListItemProps) {
  const { Link } = useRouterActions();
  const { size, variant } = use(ListContext);
  const sizes = sizeClasses[size];
  const isLink = href !== undefined;
  const isButton = !isLink && onClick !== undefined;
  const isInteractive = isLink || isButton;
  const showChevron = chevron ?? isInteractive;
  const hasActions = hasContent(actions);
  const isPlainCurrent = current && variant === "plain";

  const content = (
    <>
      {hasContent(icon) ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center",
            sizes.icon,
            iconColors[iconColor],
          )}
        >
          {icon}
        </span>
      ) : (
        hasContent(start) && (
          <span className="flex shrink-0 items-center">{start}</span>
        )
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "font-medium wrap-break-word",
            sizes.title,
            isPlainCurrent
              ? "text-primary-700 dark:text-primary-300"
              : "text-neutral-900 dark:text-neutral-100",
          )}
        >
          {title}
        </span>
        {/* A space between the parts of the name of a link or a button -
            a flex container lays none out */}
        {hasContent(description) && " "}
        {hasContent(description) && (
          <span
            className={cn(
              "wrap-break-word text-neutral-500 dark:text-neutral-400",
              sizes.description,
            )}
          >
            {description}
          </span>
        )}
      </span>
      {hasContent(end) && " "}
      {hasContent(end) && (
        <span className="flex shrink-0 items-center gap-2">{end}</span>
      )}
      {showChevron && (
        <ChevronRight
          aria-hidden="true"
          className="shrink-0 text-neutral-400 rtl:-scale-x-100 dark:text-neutral-500"
          size={size === "md" ? 20 : 16}
        />
      )}
    </>
  );

  // The focused link or button - a ring around a card or an item of a menu,
  // an outline inside a row of lines, which stay unbroken
  const hasRing = variant === "separate" || variant === "plain";

  // The link or the button fills the row - with the actions beside it, the
  // row around them is padded, highlighted and ringed in its place
  const rowClassName = cn(
    "flex min-w-0 items-center gap-3 text-start",
    hasActions ? "flex-1" : "w-full",
    !hasActions && rowClasses[variant],
    isInteractive && [
      "cursor-pointer transition-colors focus:outline-hidden motion-reduce:transition-none",
      !hasActions && [
        !disabled && interactiveClasses[variant],
        hasRing
          ? "focus-visible:ring-2 focus-visible:ring-primary-500"
          : "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500",
      ],
    ],
    isPlainCurrent && !hasActions && "bg-primary-50 dark:bg-primary-950",
    disabled && "cursor-not-allowed opacity-60",
  );

  let main: React.ReactNode;

  if (isLink && !disabled) {
    main = (
      <Link
        aria-current={current ? "page" : undefined}
        className={rowClassName}
        href={href}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  } else if (isLink) {
    // Without an `href` nothing can open a disabled link - still the page
    // shown, as its highlight says
    main = (
      <a
        aria-current={current ? "page" : undefined}
        aria-disabled="true"
        className={rowClassName}
        role="link"
      >
        {content}
      </a>
    );
  } else if (isButton) {
    main = (
      <button
        aria-current={current ? "true" : undefined}
        className={rowClassName}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  } else {
    main = (
      <div aria-current={current ? "page" : undefined} className={rowClassName}>
        {content}
      </div>
    );
  }

  return (
    <li
      {...props}
      className={cn(
        hasActions && [
          "flex items-center gap-2",
          rowClasses[variant],
          isInteractive && !disabled && interactiveClasses[variant],
          // The focus of the link or the button - not of the actions
          isInteractive &&
            (hasRing
              ? "has-[>:focus-visible]:ring-2 has-[>:focus-visible]:ring-primary-500"
              : "has-[>:focus-visible]:outline-2 has-[>:focus-visible]:-outline-offset-2 has-[>:focus-visible]:outline-primary-500"),
          isPlainCurrent && "bg-primary-50 dark:bg-primary-950",
        ],
        className,
      )}
    >
      {main}
      {hasActions && (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      )}
    </li>
  );
}
