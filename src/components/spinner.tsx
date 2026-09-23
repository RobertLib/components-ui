import cn from "../utils/cn";
import { useMessages } from "../providers/ui-context";

export type SpinnerSize = "sm" | "md" | "lg" | "xl";

export type SpinnerProps = React.ComponentProps<"div"> & {
  /** Text for screen readers - defaults to the localized "Loading…". */
  label?: string;
  /** 16, 24, 32 or 40 px. */
  size?: SpinnerSize;
};

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
};

/**
 * A loading indicator in the current text color. Next to a visible text
 * that says the same, hide it with `aria-hidden`.
 */
export default function Spinner({
  className,
  label,
  size = "md",
  ...props
}: SpinnerProps) {
  const messages = useMessages();

  return (
    <div
      role="status"
      {...props}
      className={cn("flex items-center justify-center", className)}
    >
      <svg
        aria-hidden="true"
        className={`${sizeClasses[size]} animate-spin`}
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
      <span className="sr-only">{label ?? messages.common.loading}</span>
    </div>
  );
}
