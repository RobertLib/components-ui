import cn from "../utils/cn";

export interface EmptyStateProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /** What leads on - a `Button`, or several in a fragment. */
  action?: React.ReactNode;
  /** Text under the title - why it is empty, or what to do. */
  description?: React.ReactNode;
  /**
   * Level of the heading of `title` - fit it into the outline of the page:
   * 2 for the whole content of a page, 3 in a section of it.
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** An icon above the title, e.g. `<Inbox />` of lucide-react - sized to fit. */
  icon?: React.ReactNode;
  /** `sm` - compact, e.g. in a table, a card or a popover. */
  size?: "sm" | "md";
  /** What is empty, e.g. "No invoices yet" - a heading. */
  title: React.ReactNode;
}

const sizeClasses = {
  sm: {
    root: "px-4 py-6",
    icon: "mb-3 size-10 [&>svg]:size-5",
    title: "text-sm",
    description: "text-xs",
    action: "mt-3",
  },
  md: {
    root: "px-6 py-12",
    icon: "mb-4 size-14 [&>svg]:size-7",
    title: "text-lg",
    description: "text-sm",
    action: "mt-6",
  },
};

/**
 * Takes the place of content that is not there - an empty list, a search
 * without results, the first run of a feature: an icon, a title, a
 * description and the actions that lead on. `children` go between the
 * description and the actions.
 */
export default function EmptyState({
  action,
  children,
  className,
  description,
  headingLevel = 3,
  icon,
  size = "md",
  title,
  ...props
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  const classes = sizeClasses[size];

  return (
    <div
      {...props}
      className={cn(
        "flex flex-col items-center text-center",
        classes.root,
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
            classes.icon,
          )}
        >
          {icon}
        </div>
      )}
      <Heading
        className={cn(
          "font-semibold text-neutral-900 dark:text-neutral-100",
          classes.title,
        )}
      >
        {title}
      </Heading>
      {description && (
        <div
          className={cn(
            "mt-1 max-w-md text-neutral-600 dark:text-neutral-400",
            classes.description,
          )}
        >
          {description}
        </div>
      )}
      {children}
      {action && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-2",
            classes.action,
          )}
        >
          {action}
        </div>
      )}
    </div>
  );
}
