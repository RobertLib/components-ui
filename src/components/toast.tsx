import { use, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import cn from "../utils/cn";
import { ToastRegionContext } from "../providers/snackbar-context";
import { useMessages } from "../providers/ui-context";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface ToastProps extends React.ComponentProps<"div"> {
  /**
   * Time on screen in milliseconds before it hides itself - not counting
   * the time it is hovered or has the focus.
   */
  duration?: number;
  /** Text of the notification. */
  message: string;
  /** Called once the toast has hidden itself or was dismissed. */
  onClose?: () => void;
  /** Keeps the toast on screen until the user dismisses it. */
  persist?: boolean;
  /** Color of the notification. */
  variant?: ToastVariant;
}

/**
 * A single notification. Usually not rendered directly - queue toasts with
 * `useSnackbar().enqueueSnackbar()` inside a `SnackbarProvider` instead.
 */
export default function Toast({
  className,
  duration = 3000,
  message,
  onBlur,
  onClose,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  persist = false,
  variant = "default",
  ...props
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  // Hovered or focused, the toast waits - its text can be read in peace
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const remainingTime = useRef(duration);
  const toastRef = useRef<HTMLDivElement>(null);
  const toastId = useId();
  const messages = useMessages();
  const inRegion = use(ToastRegionContext);

  const isPaused = isHovered || hasFocus;

  useEffect(() => {
    remainingTime.current = duration;
  }, [duration]);

  useEffect(() => {
    if (persist || isPaused || !visible) return;

    const startedAt = Date.now();
    const timer = setTimeout(() => setVisible(false), remainingTime.current);

    return () => {
      clearTimeout(timer);
      remainingTime.current -= Date.now() - startedAt;
    };
  }, [duration, isPaused, persist, visible]);

  useEffect(() => {
    if (!visible && onClose) {
      const timer = setTimeout(onClose, 200);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  useEffect(() => {
    const currentToastRef = toastRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose && !event.defaultPrevented) {
        // Used up - a Dialog open under the toast stays open
        event.preventDefault();
        onClose();
      }
    };

    currentToastRef?.addEventListener("keydown", handleKeyDown);

    return () => {
      currentToastRef?.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const variantStyles = {
    default:
      "border-secondary-200 text-secondary-800 bg-surface dark:bg-surface-dark dark:text-secondary-200",
    success:
      "border-success-200 bg-success-50 text-success-800 dark:bg-success-900 dark:text-success-200 dark:border-success-800",
    error:
      "border-danger-200 bg-danger-50 text-danger-800 dark:bg-danger-900 dark:text-danger-200 dark:border-danger-800",
    warning:
      "border-warning-200 bg-warning-50 text-warning-800 dark:bg-warning-900 dark:text-warning-200 dark:border-warning-800",
    info: "border-info-200 bg-info-50 text-info-800 dark:bg-info-900 dark:text-info-200 dark:border-info-800",
  };

  // Rendered on its own, the toast is a live region itself
  const liveRegionProps = inRegion
    ? {}
    : {
        "aria-atomic": true,
        "aria-live":
          variant === "error" ? ("assertive" as const) : ("polite" as const),
        role: "status",
      };

  return (
    <div
      {...props}
      {...liveRegionProps}
      className={cn(
        visible ? "animate-slide-down" : "animate-slide-up",
        "pointer-events-auto rounded-md border p-4 shadow-md focus:outline-none focus-visible:ring-2",
        variantStyles[variant],
        className,
      )}
      id={toastId}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocus(false);
        }
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setHasFocus(true);
        onFocus?.(event);
      }}
      onMouseEnter={(event) => {
        setIsHovered(true);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setIsHovered(false);
        onMouseLeave?.(event);
      }}
      ref={toastRef}
      tabIndex={0}
    >
      <div className="flex items-center justify-between">
        <span>{message}</span>
        {onClose && (
          <button
            aria-label={messages.toast.close}
            className="ml-3 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
