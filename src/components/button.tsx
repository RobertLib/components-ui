import { use } from "react";
import cn from "../utils/cn";
import { ButtonGroupContext } from "./button-group-context";
import type { LinkComponentProps } from "../providers/router";
import { useRouter } from "../providers/ui-context";

export interface ButtonProps extends React.ComponentProps<"button"> {
  /**
   * Color scheme - a `ButtonGroup` around gives its own to a button without
   * one.
   * @default "primary"
   */
  color?:
    "default" | "primary" | "secondary" | "success" | "danger" | "warning";
  /** An icon after the label, e.g. `<ChevronDown size={16} />`. */
  endIcon?: React.ReactNode;
  /** Stretches the button to the width of its container. */
  fullWidth?: boolean;
  /**
   * Renders the button as a link to this URL, using the router's `Link`
   * configured in `UIProvider`.
   */
  link?: string;
  /**
   * Shows a spinner - in place of `startIcon` - and makes the button do
   * nothing (`aria-disabled`): no `onClick`, no form submit. Unlike
   * `disabled` it keeps the focus, so the keyboard stays where it was.
   */
  loading?: boolean;
  /**
   * `icon` - a square button for a single icon. A `ButtonGroup` around
   * gives its own to a button without one.
   * @default "md"
   */
  size?: "sm" | "md" | "lg" | "icon";
  /**
   * An icon before the label, e.g. `<Plus size={16} />` - the spinner of
   * `loading` takes its place.
   */
  startIcon?: React.ReactNode;
  /**
   * `solid` - filled, `outline` - bordered, `ghost` - text only. A
   * `ButtonGroup` around gives its own to a button without one.
   * @default "solid"
   */
  variant?: "solid" | "outline" | "ghost";
}

/** Whether a node renders anything - `cond && icon` leaves out an icon. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

/**
 * The click of a loading button or link: it does nothing - no `onClick`, no
 * submit of the form (also the one Enter in a field of the form makes with
 * a click on its submit button), no navigation - and, like the click of a
 * disabled button, reaches no `onClick` around it (a clickable row).
 */
const preventActivation = (event: React.MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

/** A button - or a link looking like one, with `link`. */
export default function Button({
  className,
  color: colorProp,
  disabled,
  children,
  endIcon,
  fullWidth = false,
  link,
  loading = false,
  size: sizeProp,
  startIcon,
  type,
  variant: variantProp,
  ...props
}: ButtonProps) {
  const { Link } = useRouter();
  // Joined with the other buttons of a group, which may set these for all
  const group = use(ButtonGroupContext);
  const color = colorProp ?? group?.color ?? "primary";
  const size = sizeProp ?? group?.size ?? "md";
  const variant = variantProp ?? group?.variant ?? "solid";

  const sizeStyles = {
    sm: "px-2 py-0.5 text-sm",
    md: "px-3 py-1 text-base",
    lg: "px-4 py-1.5 text-lg",
    icon: "p-2 aspect-square",
  };

  // Between the icons and the label
  const gapStyles = {
    sm: "gap-1",
    md: "gap-1.5",
    lg: "gap-2",
    icon: "",
  };

  // Every text stands out from its background by at least 4.5:1 (WCAG
  // 1.4.3) - a filled button at both ends of its gradient, also on hover.
  // Warning is yellow, with dark text.
  const colorStyles = {
    default: {
      solid:
        "bg-linear-to-r from-neutral-100 to-neutral-200 text-neutral-800 border-neutral-300/30 hover:from-neutral-200 hover:to-neutral-300 focus:ring-neutral-500 dark:from-neutral-800 dark:to-neutral-700 dark:text-neutral-200 dark:hover:from-neutral-700 dark:hover:to-neutral-600",
      outline:
        "bg-transparent border-[1.5px] border-neutral-300 text-neutral-700 hover:bg-neutral-50 focus:ring-neutral-500 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800",
      ghost:
        "bg-transparent border-transparent text-neutral-700 hover:bg-neutral-50 focus:ring-neutral-500 dark:text-neutral-300 dark:hover:bg-neutral-800",
    },
    primary: {
      solid:
        "bg-linear-to-r from-primary-600 to-primary-700 text-white border-primary-700/30 hover:from-primary-700 hover:to-primary-800 focus:ring-primary-500",
      outline:
        "bg-transparent border-[1.5px] border-primary-500/40 text-primary-600 hover:bg-linear-to-r hover:from-primary-600 hover:to-primary-700 hover:text-white focus:ring-primary-500 dark:text-primary-400 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-primary-600 hover:bg-linear-to-r hover:from-primary-50 hover:to-primary-50 focus:ring-primary-500 dark:hover:from-primary-950 dark:hover:to-primary-950 dark:text-primary-400",
    },
    secondary: {
      solid:
        "bg-linear-to-r from-secondary-500 to-secondary-600 text-white border-secondary-600/30 hover:from-secondary-600 hover:to-secondary-700 focus:ring-secondary-500",
      outline:
        "bg-transparent border-[1.5px] border-secondary-500/50 text-secondary-600 hover:bg-linear-to-r hover:from-secondary-500 hover:to-secondary-600 hover:text-white focus:ring-secondary-500 dark:text-secondary-300 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-secondary-600 hover:bg-linear-to-r hover:from-secondary-50 hover:to-secondary-50 focus:ring-secondary-500 dark:text-secondary-300 dark:hover:from-secondary-900 dark:hover:to-secondary-900",
    },
    success: {
      solid:
        "bg-linear-to-r from-success-700 to-success-800 text-white border-success-800/30 hover:from-success-800 hover:to-success-900 focus:ring-success-600",
      outline:
        "bg-transparent border-[1.5px] border-success-500/60 text-success-700 hover:bg-linear-to-r hover:from-success-700 hover:to-success-800 hover:text-white focus:ring-success-600 dark:text-success-400 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-success-700 hover:bg-linear-to-r hover:from-success-50 hover:to-success-50 focus:ring-success-600 dark:hover:from-success-950 dark:hover:to-success-950 dark:text-success-400",
    },
    danger: {
      solid:
        "bg-linear-to-r from-danger-600 to-danger-700 text-white border-danger-700/30 hover:from-danger-700 hover:to-danger-800 focus:ring-danger-500",
      outline:
        "bg-transparent border-[1.5px] border-danger-500/40 text-danger-700 hover:bg-linear-to-r hover:from-danger-600 hover:to-danger-700 hover:text-white focus:ring-danger-500 dark:text-danger-400 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-danger-700 hover:bg-linear-to-r hover:from-danger-50 hover:to-danger-50 focus:ring-danger-500 dark:hover:from-danger-950 dark:hover:to-danger-950 dark:text-danger-400",
    },
    warning: {
      solid:
        "bg-linear-to-r from-warning-400 to-warning-500 text-warning-950 border-warning-600/30 hover:from-warning-500 hover:to-warning-600 focus:ring-warning-700",
      outline:
        "bg-transparent border-[1.5px] border-warning-500/80 text-warning-700 hover:bg-linear-to-r hover:from-warning-400 hover:to-warning-500 hover:text-warning-950 focus:ring-warning-700 dark:text-warning-400 dark:hover:text-warning-950",
      ghost:
        "bg-transparent border-transparent text-warning-700 hover:bg-linear-to-r hover:from-warning-50 hover:to-warning-50 focus:ring-warning-700 dark:hover:from-warning-950 dark:hover:to-warning-950 dark:text-warning-400",
    },
  };

  const disabledStyles = "opacity-60 cursor-not-allowed";
  const isDisabled = disabled || loading;
  // Loading, it looks disabled but stays focusable - a native `disabled`
  // would drop the focus of the button just pressed to the page
  const isBusy = loading && !disabled;

  // In a group only the outer corners are round, and each button overlaps
  // the border of the one before. The hovered and the focused one come to
  // the front, so their border and focus ring show whole.
  const groupStyles =
    group &&
    cn(
      "relative hover:z-10 focus:z-20",
      group.orientation === "vertical"
        ? [
            group.first
              ? "rounded-t-md"
              : variant === "outline"
                ? "-mt-[1.5px]"
                : "-mt-px",
            group.last && "rounded-b-md",
          ]
        : [
            // The start and the end - the right in a right-to-left page
            group.first
              ? "rounded-s-md"
              : variant === "outline"
                ? "-ms-[1.5px]"
                : "-ms-px",
            group.last && "rounded-e-md",
          ],
    );

  const spinner = (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 animate-spin text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );

  // The spinner sits where the start icon is - it takes its place
  const hasStart = loading || hasContent(startIcon);
  const hasEnd = hasContent(endIcon);
  const hasSlots = size !== "icon" && (hasStart || hasEnd);

  const content =
    size === "icon" ? (
      // The icon is the content - the spinner takes its place
      loading ? (
        spinner
      ) : (
        children
      )
    ) : hasSlots ? (
      <>
        {loading
          ? spinner
          : hasStart && (
              <span aria-hidden="true" className="inline-flex shrink-0">
                {startIcon}
              </span>
            )}
        {/* One piece next to the icons, laid out as it would be alone */}
        {hasContent(children) && (
          <span className="inline-flex items-center">{children}</span>
        )}
        {hasEnd && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {endIcon}
          </span>
        )}
      </>
    ) : (
      children
    );

  const commonClassNames = cn(
    "inline-flex cursor-pointer items-center justify-center border transition-all transition-colors duration-200 focus:ring-2 focus:outline-none",
    groupStyles || "rounded-md",
    // The focus ring keeps a gap to the fill of a similar color
    variant === "solid" &&
      "shadow-lg ring-offset-surface hover:shadow-xl focus:ring-offset-2 dark:ring-offset-surface-dark",
    sizeStyles[size],
    hasSlots && gapStyles[size],
    fullWidth && "w-full",
    colorStyles[color][variant],
    isDisabled && disabledStyles,
    className,
  );

  if (link) {
    // Everything but what only a <button> understands goes to the link -
    // `ref`, `data-*`, `aria-*`, event handlers, …
    const {
      form: _form,
      formAction: _formAction,
      formEncType: _formEncType,
      formMethod: _formMethod,
      formNoValidate: _formNoValidate,
      formTarget: _formTarget,
      name: _name,
      onAuxClick,
      onClick,
      popoverTarget: _popoverTarget,
      popoverTargetAction: _popoverTargetAction,
      value: _value,
      ...linkProps
    } = props;

    if (disabled) {
      // Without an `href` nothing can open a disabled link - no click, no
      // middle click, no dragging it into a tab, no "Open in new tab" of
      // the context menu - and it is not in the tab order
      return (
        <a
          {...(linkProps as React.ComponentProps<"a">)}
          aria-busy={loading || undefined}
          aria-disabled="true"
          className={commonClassNames}
          role="link"
          tabIndex={undefined}
        >
          {content}
        </a>
      );
    }

    // A loading link keeps its `href` - rendered as the same element, it
    // keeps the focus - but a click or a middle click does nothing
    return (
      <Link
        {...(linkProps as Omit<LinkComponentProps, "href">)}
        aria-busy={isBusy || undefined}
        aria-disabled={isBusy || linkProps["aria-disabled"]}
        className={commonClassNames}
        href={link}
        onAuxClick={
          isBusy
            ? preventActivation
            : (onAuxClick as unknown as React.MouseEventHandler<HTMLAnchorElement>)
        }
        onClick={
          isBusy
            ? preventActivation
            : (onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>)
        }
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      aria-disabled={isBusy || props["aria-disabled"]}
      className={commonClassNames}
      disabled={disabled}
      onClick={isBusy ? preventActivation : props.onClick}
      type={type ?? "button"}
    >
      {content}
    </button>
  );
}
