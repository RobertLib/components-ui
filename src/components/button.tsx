import cn from "../utils/cn";
import type { LinkComponentProps } from "../providers/router";
import { useRouter } from "../providers/ui-context";

export interface ButtonProps extends React.ComponentProps<"button"> {
  /** Color scheme. */
  color?:
    "default" | "primary" | "secondary" | "success" | "danger" | "warning";
  /**
   * Renders the button as a link to this URL, using the router's `Link`
   * configured in `UIProvider`.
   */
  link?: string;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** `icon` - a square button for a single icon. */
  size?: "sm" | "md" | "lg" | "icon";
  /** `solid` - filled, `outline` - bordered, `ghost` - text only. */
  variant?: "solid" | "outline" | "ghost";
}

/** A button - or a link looking like one, with `link`. */
export default function Button({
  className,
  color = "primary",
  disabled,
  children,
  link,
  loading = false,
  size = "md",
  type,
  variant = "solid",
  ...props
}: ButtonProps) {
  const { Link } = useRouter();

  const sizeStyles = {
    sm: "px-2 py-0.5 text-sm",
    md: "px-3 py-1 text-base",
    lg: "px-4 py-1.5 text-lg",
    icon: "p-2 aspect-square",
  };

  const colorStyles = {
    default: {
      solid:
        "bg-linear-to-r from-neutral-100 to-neutral-200 text-neutral-800 border-neutral-300/30 hover:from-neutral-200 hover:to-neutral-300 focus:ring-neutral-200 dark:from-neutral-800 dark:to-neutral-700 dark:text-neutral-200 dark:hover:from-neutral-700 dark:hover:to-neutral-600",
      outline:
        "bg-transparent border-[1.5px] border-neutral-300 text-neutral-700 hover:bg-neutral-50 focus:ring-neutral-200 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800",
      ghost:
        "bg-transparent border-transparent text-neutral-700 hover:bg-neutral-50 focus:ring-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800",
    },
    primary: {
      solid:
        "bg-linear-to-r from-primary-500 to-primary-400 text-white border-primary-600/30 hover:from-primary-600 hover:to-primary-500 focus:ring-primary-300",
      outline:
        "bg-transparent border-[1.5px] border-primary-500/40 text-primary-600 hover:bg-linear-to-r hover:from-primary-500 hover:to-primary-400 hover:text-white focus:ring-primary-300 dark:text-primary-400 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-primary-600 hover:bg-linear-to-r hover:from-primary-50 hover:to-primary-100 focus:ring-primary-300 dark:hover:from-primary-950 dark:hover:to-primary-900 dark:text-primary-400",
    },
    secondary: {
      solid:
        "bg-linear-to-r from-secondary-500 to-secondary-600 text-white border-secondary-600/30 hover:from-secondary-600 hover:to-secondary-700 focus:ring-secondary-300",
      outline:
        "bg-transparent border-[1.5px] border-secondary-500/50 text-secondary-600 hover:bg-linear-to-r hover:from-secondary-500 hover:to-secondary-600 hover:text-white focus:ring-secondary-300 dark:text-secondary-300 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-secondary-600 hover:bg-linear-to-r hover:from-secondary-50 hover:to-secondary-50 focus:ring-secondary-300 dark:text-secondary-300 dark:hover:from-secondary-900 dark:hover:to-secondary-900",
    },
    success: {
      solid:
        "bg-linear-to-r from-success-500 to-success-600 text-white border-success-600/30 hover:from-success-600 hover:to-success-700 focus:ring-success-300",
      outline:
        "bg-transparent border-[1.5px] border-success-500/60 text-success-600 hover:bg-linear-to-r hover:from-success-500 hover:to-success-600 hover:text-white focus:ring-success-300 dark:text-success-400 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-success-600 hover:bg-linear-to-r hover:from-success-50 hover:to-success-50 focus:ring-success-300 dark:hover:from-success-950 dark:hover:to-success-950 dark:text-success-400",
    },
    danger: {
      solid:
        "bg-linear-to-r from-danger-500 to-danger-600 text-white border-danger-600/30 hover:from-danger-600 hover:to-danger-700 focus:ring-danger-300",
      outline:
        "bg-transparent border-[1.5px] border-danger-500/40 text-danger-600 hover:bg-linear-to-r hover:from-danger-500 hover:to-danger-600 hover:text-white focus:ring-danger-300 dark:text-danger-400 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-danger-600 hover:bg-linear-to-r hover:from-danger-50 hover:to-danger-50 focus:ring-danger-300 dark:hover:from-danger-950 dark:hover:to-danger-950 dark:text-danger-400",
    },
    warning: {
      solid:
        "bg-linear-to-r from-warning-500 to-warning-600 text-white border-warning-600/30 hover:from-warning-600 hover:to-warning-700 focus:ring-warning-300",
      outline:
        "bg-transparent border-[1.5px] border-warning-500/80 text-warning-600 hover:bg-linear-to-r hover:from-warning-500 hover:to-warning-600 hover:text-white focus:ring-warning-300 dark:text-warning-400 dark:hover:text-white",
      ghost:
        "bg-transparent border-transparent text-warning-600 hover:bg-linear-to-r hover:from-warning-50 hover:to-warning-50 focus:ring-warning-300 dark:hover:from-warning-950 dark:hover:to-warning-950 dark:text-warning-400",
    },
  };

  const disabledStyles = "opacity-60 cursor-not-allowed";
  const isDisabled = disabled || loading;

  const commonClassNames = cn(
    "inline-flex cursor-pointer items-center justify-center rounded-md border transition-all transition-colors duration-200 focus:ring-2 focus:outline-none",
    variant === "solid" && "shadow-lg hover:shadow-xl",
    sizeStyles[size],
    colorStyles[color][variant],
    isDisabled && disabledStyles,
    className,
  );

  const content = (
    <>
      {loading && (
        <svg
          aria-hidden="true"
          className="mr-2 -ml-1 h-4 w-4 animate-spin text-current"
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
      )}
      {children}
    </>
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
      onClick,
      popoverTarget: _popoverTarget,
      popoverTargetAction: _popoverTargetAction,
      value: _value,
      ...linkProps
    } = props;

    return (
      <Link
        {...(linkProps as Omit<LinkComponentProps, "href">)}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        className={commonClassNames}
        href={link}
        onClick={(event) => {
          // A disabled link must not navigate
          if (isDisabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
        }}
        tabIndex={isDisabled ? -1 : props.tabIndex}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={commonClassNames}
      disabled={isDisabled}
      type={type ?? "button"}
    >
      {content}
    </button>
  );
}
