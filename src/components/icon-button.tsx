import cn from "../utils/cn";

export interface IconButtonProps extends React.ComponentProps<"button"> {
  /** Shows a spinner instead of the icon and disables the button. */
  loading?: boolean;
  /**
   * Color of the icon.
   * @default "default"
   */
  variant?: "default" | "primary" | "secondary" | "danger";
}

/**
 * A borderless button for a single icon. Give it an `aria-label` - the icon
 * alone does not tell screen readers what it does.
 */
export default function IconButton({
  className,
  disabled,
  children,
  loading = false,
  type,
  variant = "default",
  ...props
}: IconButtonProps) {
  const variantStyles = {
    default: "",
    primary: "text-primary-500",
    secondary: "text-secondary-500",
    danger: "text-danger-500",
  };

  const disabledStyles = "opacity-50 cursor-not-allowed";

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={cn(
        "-m-1 cursor-pointer rounded-md p-1 leading-none transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800",
        variantStyles[variant],
        (disabled || loading) && disabledStyles,
        className,
      )}
      disabled={disabled || loading}
      type={type ?? "button"}
    >
      {loading ? (
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
      )}
    </button>
  );
}
