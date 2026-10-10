import cn from "../../utils/cn";
import Tooltip, { type TooltipProps } from "./tooltip";
import type { LinkComponentProps } from "../../providers/router";
import { useRouterActions } from "../../providers/ui-context";

/** The colors of the icon of an `IconButton`. */
export type IconButtonColor = "default" | "primary" | "secondary" | "danger";

export interface IconButtonProps extends Omit<
  React.ComponentProps<"button">,
  "color"
> {
  /**
   * A border around the button, as around an `outline` `Button` - e.g. a
   * "More actions" menu next to outline buttons. It takes the `md` size
   * without a `size` of its own.
   */
  bordered?: boolean;
  /**
   * Color of the icon.
   * @default "default"
   */
  color?: IconButtonColor;
  /**
   * Renders the button as a link to this URL, using the router's `Link`
   * configured in `UIProvider` - e.g. an "Edit" pencil that opens a page.
   */
  href?: string;
  /**
   * Shows a spinner instead of the icon and makes the button do nothing
   * (`aria-disabled`) - it keeps the focus, unlike `disabled`.
   */
  loading?: boolean;
  /**
   * The size of the button and of its icon (16, 18 or 20 px) - as high as
   * a `Button` of the same size, so that the two line up in a toolbar.
   * Without it the button is as big as the icon given, with a small padding
   * that does not take room from the layout (a negative margin).
   */
  size?: "sm" | "md" | "lg";
  /**
   * A tooltip on hover and keyboard focus - `true` shows the `aria-label`
   * of the button; a text or other content shows that. A text also names a
   * button without an `aria-label`.
   */
  tooltip?: boolean | React.ReactNode;
  /**
   * Side of the button the tooltip appears on.
   * @default "top"
   */
  tooltipPosition?: TooltipProps["position"];
  /**
   * Deprecated - use `color`.
   * @deprecated Use `color`.
   */
  variant?: IconButtonColor;
}

/**
 * The click of a loading button - it does nothing, not even submit a form,
 * and like the click of a disabled button reaches no `onClick` around it.
 */
const preventActivation = (event: React.MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

const colorStyles: Record<IconButtonColor, string> = {
  default: "",
  primary: "text-primary-500 dark:text-primary-400",
  secondary: "text-secondary-500 dark:text-secondary-400",
  danger: "text-danger-500 dark:text-danger-400",
};

// As high as a `Button` of the size - 26, 34 and 42 px - with an icon of
// any size given drawn to fit
const sizeStyles = {
  sm: "size-6.5 [&_svg]:size-4",
  md: "size-8.5 [&_svg]:size-4.5",
  lg: "size-10.5 [&_svg]:size-5",
};

/**
 * A button for a single icon - borderless, or with a border by `bordered`.
 * Name it with an `aria-label` - the icon alone does not tell screen readers
 * what it does - or with a text `tooltip`, which also shows the name. With
 * `href` it is a link.
 */
export default function IconButton({
  "aria-label": ariaLabel,
  bordered = false,
  className,
  color: colorProp,
  disabled,
  children,
  href,
  loading = false,
  size: sizeProp,
  tooltip,
  tooltipPosition = "top",
  type,
  variant,
  ...props
}: IconButtonProps) {
  const { Link } = useRouterActions();
  const color = colorProp ?? variant ?? "default";
  // A bordered button has a size - the negative margin of one without
  // would pull the border into the content around
  const size = sizeProp ?? (bordered ? "md" : undefined);

  // A text tooltip names a button without a name of its own
  const label =
    ariaLabel ?? (typeof tooltip === "string" ? tooltip : undefined);
  const tooltipContent =
    tooltip === true ? ariaLabel : tooltip === false ? null : tooltip;

  const disabledStyles = "opacity-50 cursor-not-allowed";
  // Loading, it looks disabled but stays focusable - a native `disabled`
  // would drop the focus of the button just pressed to the page
  const isBusy = loading && !disabled;

  const classNames = cn(
    "cursor-pointer rounded-md leading-none transition-colors hover:bg-neutral-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800",
    size
      ? ["inline-flex shrink-0 items-center justify-center", sizeStyles[size]]
      : "-m-1 p-1",
    href !== undefined && !size && "inline-flex",
    bordered &&
      "border-[1.5px] border-neutral-300 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800",
    colorStyles[color],
    (disabled || loading) && disabledStyles,
    className,
  );

  const content = loading ? (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin text-current"
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
  ) : (
    children
  );

  let control: React.ReactElement;

  if (href !== undefined) {
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

    control = disabled ? (
      // Without an `href` nothing can open a disabled link, and it is not
      // in the tab order
      <a
        {...(linkProps as React.ComponentProps<"a">)}
        aria-busy={loading || undefined}
        aria-disabled="true"
        aria-label={label}
        className={classNames}
        onAuxClick={preventActivation}
        onClick={preventActivation}
        role="link"
        tabIndex={undefined}
      >
        {content}
      </a>
    ) : (
      // A loading link keeps its `href` - and the focus - but a click or a
      // middle click does nothing
      <Link
        {...(linkProps as Omit<LinkComponentProps, "href">)}
        aria-busy={isBusy || undefined}
        aria-disabled={isBusy || linkProps["aria-disabled"]}
        aria-label={label}
        className={classNames}
        href={href}
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
  } else {
    control = (
      <button
        {...props}
        aria-busy={loading || undefined}
        aria-disabled={isBusy || props["aria-disabled"]}
        aria-label={label}
        className={classNames}
        disabled={disabled}
        onClick={isBusy ? preventActivation : props.onClick}
        type={type ?? "button"}
      >
        {content}
      </button>
    );
  }

  const hasTooltip =
    tooltipContent !== undefined &&
    tooltipContent !== null &&
    tooltipContent !== "";

  if (!hasTooltip) return control;

  return (
    <Tooltip
      // The button shows it at once on keyboard focus
      delay={500}
      nowrap={typeof tooltipContent === "string"}
      position={tooltipPosition}
      title={tooltipContent}
    >
      {/* In a fragment: a tooltip that shows the name does not describe the
          button with it once more - a different text does (below) */}
      {tooltipContent === label ? <>{control}</> : control}
    </Tooltip>
  );
}
