import {
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { X } from "lucide-react";
import cn from "../utils/cn";
import { isEscapeKey } from "./overlay-stack";
import { ToastRegionContext } from "../providers/snackbar-context";
import { useMessages } from "../providers/ui-context";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

/** A button in a toast, e.g. "Undo" after a delete. */
export interface ToastAction {
  /** Text of the button. */
  label: string;
  /** Called when the button is pressed - the toast closes after it. */
  onClick: () => void;
}

export interface ToastProps extends Omit<React.ComponentProps<"div">, "title"> {
  /**
   * A button next to the message, e.g. "Undo" after a delete - the toast
   * closes once it is pressed. Keep it a shortcut: the toast goes away on
   * its own, so what the button does should also be possible elsewhere.
   */
  action?: ToastAction;
  /**
   * Time on screen in milliseconds before it hides itself - not counting
   * the time it is hovered, has the focus or its page is hidden (another
   * tab is shown). 3000, or 6000 with an `action`.
   */
  duration?: number;
  /**
   * Shows a spinner and keeps the toast on screen - e.g. while a request
   * runs. `duration` counts from when it turns `false`.
   */
  loading?: boolean;
  /** Text of the notification. */
  message: string;
  /**
   * Called once the toast has hidden itself or was dismissed - it renders
   * nothing from then on.
   */
  onClose?: () => void;
  /**
   * Called when the toast starts hiding itself after `duration`; `onClose`
   * follows once it has slid out.
   */
  onHide?: () => void;
  /**
   * `false` hides the toast - it slides out, then `onClose` is called. For
   * a toast the parent takes back, e.g. a finished upload.
   */
  open?: boolean;
  /** Keeps the toast on screen until the user dismisses it. */
  persist?: boolean;
  /** Heading above the message. */
  title?: string;
  /** Color of the notification. */
  variant?: ToastVariant;
}

const subscribeToVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

const isPageHidden = () => document.visibilityState === "hidden";

/**
 * A single notification. Usually not rendered directly - queue toasts with
 * `useSnackbar().enqueueSnackbar()` inside a `SnackbarProvider` instead.
 */
export default function Toast({
  action,
  className,
  duration,
  id,
  loading = false,
  message,
  onBlur,
  onClose,
  onFocus,
  onHide,
  onMouseEnter,
  onMouseLeave,
  open = true,
  persist = false,
  title,
  variant = "default",
  ...props
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  // Slid out or dismissed - the toast renders nothing any more, also when
  // nobody unmounts it (a toast rendered on its own without `onClose`)
  const [isGone, setIsGone] = useState(false);
  // Hovered or focused, the toast waits - its text can be read in peace
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  // A toast with an action stays longer - there is something to do in it
  const timeOnScreen = duration ?? (action ? 6000 : 3000);
  const remainingTime = useRef(timeOnScreen);
  const toastRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const toastId = id ?? generatedId;
  const messages = useMessages();
  const region = use(ToastRegionContext);
  const inRegion = region !== null;
  // Where the focus was before it moved into a toast rendered on its own -
  // in a SnackbarProvider its region remembers it
  const ownReturnFocus = useRef<HTMLElement>(null);
  // The callbacks of the last render - a parent passing new functions on
  // every render (the list of `SnackbarProvider`) restarts no timer
  const callbacksRef = useRef({ onClose, onHide });
  // The region of the last render, for the timers and the Escape handler
  const regionRef = useRef(region);

  useLayoutEffect(() => {
    callbacksRef.current = { onClose, onHide };
    regionRef.current = region;
  });

  // A page in a background tab - its toasts wait until it is seen, e.g. the
  // outcome of a long `promise()` the user did not wait for
  const pageHidden = useSyncExternalStore(
    subscribeToVisibility,
    isPageHidden,
    () => false,
  );

  // Hidden by its timer or by the parent (`open`)
  const isShown = visible && open;
  const isPaused = isHovered || hasFocus || pageHidden;

  useEffect(() => {
    remainingTime.current = timeOnScreen;
  }, [timeOnScreen]);

  useEffect(() => {
    if (persist || loading || isPaused || !isShown) return;

    const startedAt = Date.now();
    const timer = setTimeout(() => {
      setVisible(false);
      callbacksRef.current.onHide?.();
    }, remainingTime.current);

    return () => {
      clearTimeout(timer);
      remainingTime.current -= Date.now() - startedAt;
    };
  }, [isPaused, isShown, loading, persist, timeOnScreen]);

  // The focus in the toast would fall to the page once it is gone - it goes
  // back to where it was before it moved into the toasts, or else to the
  // close button of the next toast (not its action, which a second Enter
  // would run). Nothing moves while the focus is elsewhere.
  const restoreFocus = () => {
    const toast = toastRef.current;
    if (!toast?.contains(document.activeElement)) return;

    const toastRegion = regionRef.current;
    const previous = (toastRegion?.returnFocus ?? ownReturnFocus).current;
    if (previous?.isConnected && !toast.contains(previous)) {
      previous.focus();
      if (document.activeElement === previous) return;
    }

    const toasts = [
      ...(toastRegion?.element.current?.querySelectorAll<HTMLElement>(
        "[data-toast='visible']",
      ) ?? []),
    ].filter((other) => other !== toast);
    // The next one below, else the nearest one above
    const next =
      toasts.find(
        (other) =>
          toast.compareDocumentPosition(other) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ) ?? toasts.at(-1);
    (next?.querySelector<HTMLElement>("[data-toast-close]") ?? next)?.focus();
  };

  // Gone once the slide-out animation is over
  useEffect(() => {
    if (isShown) return;

    const timer = setTimeout(() => {
      restoreFocus();
      setIsGone(true);
      callbacksRef.current.onClose?.();
    }, 200);
    return () => clearTimeout(timer);
  }, [isShown]);

  const dismiss = () => {
    restoreFocus();
    setIsGone(true);
    callbacksRef.current.onClose?.();
  };

  useEffect(() => {
    const currentToastRef = toastRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isEscapeKey(event) &&
        callbacksRef.current.onClose &&
        !event.defaultPrevented
      ) {
        // Used up - a Dialog open under the toast stays open
        event.preventDefault();
        dismiss();
      }
    };

    currentToastRef?.addEventListener("keydown", handleKeyDown);

    return () => {
      currentToastRef?.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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

  if (isGone) return null;

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
        isShown ? "animate-slide-down" : "animate-slide-up",
        "pointer-events-auto rounded-md border p-4 shadow-md focus:outline-none focus-visible:ring-2",
        variantStyles[variant],
        className,
      )}
      // The next toast gets the focus of a dismissed one - not one sliding out
      data-toast={isShown ? "visible" : "hiding"}
      id={toastId}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocus(false);
        }
        onBlur?.(event);
      }}
      onFocus={(event) => {
        // From outside - without an element (the window got the focus back)
        // the last one is kept
        if (
          !inRegion &&
          event.relatedTarget instanceof HTMLElement &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          ownReturnFocus.current = event.relatedTarget;
        }
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
      <div className="flex items-center gap-3">
        {loading && (
          // The message tells what runs - screen readers skip the spinner
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              fill="currentColor"
            />
          </svg>
        )}
        <div className="min-w-0 flex-1">
          {title && <div className="font-semibold">{title}</div>}
          <div className={cn(title && "mt-0.5 text-sm")}>{message}</div>
        </div>
        {action && (
          <button
            className="-my-1 shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-current/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            onClick={() => {
              action.onClick();
              dismiss();
            }}
            type="button"
          >
            {action.label}
          </button>
        )}
        {onClose && (
          <button
            aria-label={messages.toast.close}
            className="shrink-0 cursor-pointer rounded text-neutral-500 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:text-neutral-300"
            data-toast-close=""
            onClick={dismiss}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
