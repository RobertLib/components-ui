import {
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import cn from "../../utils/cn";
import { getActiveElement, isEscapeKey } from "./overlay-stack";
import { attachRef } from "../../hooks/use-form-control";
import {
  ToastRegionContext,
  ToastRevisionContext,
} from "../../providers/snackbar-context";
import { useMessages } from "../../providers/ui-context";

/**
 * The color of a toast. `error` is the older name of `danger` - it still
 * works, and looks and is announced the same.
 */
export type ToastVariant =
  "default" | "success" | "danger" | "error" | "warning" | "info";

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
   * the time it is hovered, has the focus, is being swiped or its page is
   * hidden (another tab is shown). 3000, or 6000 with an `action`.
   */
  duration?: number;
  /**
   * Shows a spinner and keeps the toast on screen - e.g. while a request
   * runs. `duration` counts from when it turns `false`.
   */
  loading?: boolean;
  /** The notification - a text, or any React node (e.g. with a link). */
  message: React.ReactNode;
  /**
   * Called once the toast has hidden itself or was dismissed - it renders
   * nothing from then on. With it, the toast has a close button, closes on
   * Escape and can be swiped away sideways on a touch screen.
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
  title?: React.ReactNode;
  /** Color of the notification - `danger` for an error. */
  variant?: ToastVariant;
}

/**
 * How long a live region is in the page before its text is - screen readers
 * announce what changes in a region they know, not a region that appears
 * with its text.
 */
export const LIVE_REGION_DELAY = 100;

// A finger moving this far sideways swipes the toast - less is a tap, and a
// move up or down first scrolls the page
const SWIPE_SLOP = 10;

// Released this far away - or flicked - the toast is dismissed; nearer, it
// goes back
const SWIPE_DISMISS_DISTANCE = 64;
const SWIPE_DISMISS_VELOCITY = 0.5;

// How long a swiped toast takes to leave the screen
const SWIPE_OUT_DURATION = 200;

const subscribeToVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

const isPageHidden = () => document.visibilityState === "hidden";

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const variantStyles: Record<Exclude<ToastVariant, "error">, string> = {
  default:
    "border-secondary-200 text-secondary-800 bg-surface dark:bg-surface-dark dark:text-secondary-200",
  success:
    "border-success-200 bg-success-50 text-success-800 dark:bg-success-900 dark:text-success-200 dark:border-success-800",
  danger:
    "border-danger-200 bg-danger-50 text-danger-800 dark:bg-danger-900 dark:text-danger-200 dark:border-danger-800",
  warning:
    "border-warning-200 bg-warning-50 text-warning-800 dark:bg-warning-900 dark:text-warning-200 dark:border-warning-800",
  info: "border-info-200 bg-info-50 text-info-800 dark:bg-info-900 dark:text-info-200 dark:border-info-800",
};

// The variants differ in their colors - which forced colors (Windows High
// Contrast) take: there the icon of `Alert` tells them apart
const variantIcons = {
  danger: XCircle,
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
};

/** The variant `error` is an alias of - `danger`. */
const toastTone = (variant: ToastVariant) =>
  variant === "error" ? "danger" : variant;

/**
 * A single notification. Usually not rendered directly - queue toasts with
 * `useSnackbar().enqueueSnackbar()` inside a `SnackbarProvider` instead.
 * `ref` and the other props go to the toast, which has `data-state="open"`
 * (`"closed"` while it slides out) and its `data-variant`.
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
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  open = true,
  persist = false,
  ref,
  style,
  title,
  variant = "default",
  ...props
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  // Slid out or dismissed - the toast renders nothing any more, also when
  // nobody unmounts it (a toast rendered on its own without `onClose`)
  const [isGone, setIsGone] = useState(false);
  // A click and a finishing animation may dismiss it before React commits
  // the gone state - its close callback still runs only once.
  const dismissedRef = useRef(false);
  // Hovered or focused, the toast waits - its text can be read in peace
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  // Swiped by a finger: how far it is moved sideways, whether the finger
  // still holds it, and whether it is leaving the screen
  const [swipe, setSwipe] = useState<{
    dragging: boolean;
    leaving: boolean;
    offset: number;
  } | null>(null);
  const swipeRef = useRef<{
    active: boolean;
    id: number;
    lastTime: number;
    lastX: number;
    startX: number;
    startY: number;
    velocity: number;
  } | null>(null);
  // A toast with an action stays longer - there is something to do in it
  const timeOnScreen = duration ?? (action ? 6000 : 3000);
  const remainingTime = useRef(timeOnScreen);
  const toastRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const toastId = id ?? generatedId;
  const messages = useMessages();
  const region = use(ToastRegionContext);
  // Changed by `updateSnackbar` - the time on screen starts over
  const revision = use(ToastRevisionContext);
  const inRegion = region !== null;
  const tone = toastTone(variant);
  const hasTitle = title != null && title !== false && title !== "";
  // Where the focus was before it moved into a toast rendered on its own -
  // in a SnackbarProvider its region remembers it
  const ownReturnFocus = useRef<HTMLElement>(null);
  // The callbacks of the last render - a parent passing new functions on
  // every render (the list of `SnackbarProvider`) restarts no timer
  const callbacksRef = useRef({ onClose, onHide });
  // The region of the last render, for the timers and the Escape handler
  const regionRef = useRef(region);
  // Rendered on its own, the toast is a live region itself - its text shows
  // a moment after the region is in the page, so it is announced
  const [isAnnounced, setIsAnnounced] = useState(inRegion);

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
  const isShown = !isGone && visible && open;
  const isPaused = isHovered || hasFocus || pageHidden || !!swipe;

  useEffect(() => {
    if (isGone || isAnnounced) return;

    const timer = setTimeout(() => setIsAnnounced(true), LIVE_REGION_DELAY);
    return () => clearTimeout(timer);
  }, [isAnnounced, isGone]);

  // The whole time again for a new duration - and for a new text
  useEffect(() => {
    remainingTime.current = timeOnScreen;
  }, [revision, timeOnScreen]);

  useEffect(() => {
    if (persist || loading || isPaused || !isShown) return;

    const startedAt = Date.now();
    const timer = setTimeout(() => {
      if (dismissedRef.current) return;
      setVisible(false);
      callbacksRef.current.onHide?.();
    }, remainingTime.current);

    return () => {
      clearTimeout(timer);
      remainingTime.current -= Date.now() - startedAt;
    };
  }, [isPaused, isShown, loading, persist, revision, timeOnScreen]);

  // The focus in the toast would fall to the page once it is gone - it goes
  // back to where it was before it moved into the toasts, or else to the
  // close button of the next toast (not its action, which a second Enter
  // would run). Nothing moves while the focus is elsewhere.
  const restoreFocus = () => {
    const toast = toastRef.current;
    if (!toast?.contains(getActiveElement())) return;

    const toastRegion = regionRef.current;
    const previous = (toastRegion?.returnFocus ?? ownReturnFocus).current;
    if (previous?.isConnected && !toast.contains(previous)) {
      previous.focus();
      if (getActiveElement() === previous) return;
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

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    restoreFocus();
    setIsGone(true);
    callbacksRef.current.onClose?.();
  };

  // Gone once the slide-out animation is over - a manual dismissal also
  // cancels this timer when the parent keeps the toast mounted.
  useEffect(() => {
    if (isGone || isShown) return;

    const timer = setTimeout(dismiss, 200);
    return () => clearTimeout(timer);
  }, [isGone, isShown]);

  // Swiped away - dismissed once it has left the screen
  const isSwipedOut = !!swipe?.leaving;

  useEffect(() => {
    if (isGone || !isSwipedOut) return;

    const timer = setTimeout(dismiss, SWIPE_OUT_DURATION);
    return () => clearTimeout(timer);
  }, [isGone, isSwipedOut]);

  useEffect(() => {
    if (isGone) return;
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
  }, [isGone]);

  // A dismissible toast follows a finger swiping it sideways - released far
  // enough, or flicked, it leaves the screen that way and is dismissed;
  // else it goes back. Users who prefer reduced motion see it go at once.
  const canSwipe = !!onClose && isShown;

  const endSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = swipeRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    swipeRef.current = null;
    if (!drag.active) return;

    const distance = event.clientX - drag.startX;
    const isFlick =
      Math.abs(drag.velocity) >= SWIPE_DISMISS_VELOCITY &&
      Math.sign(drag.velocity) === Math.sign(distance);
    const isDismissed =
      event.type === "pointerup" &&
      (Math.abs(distance) >= SWIPE_DISMISS_DISTANCE || isFlick);

    if (!isDismissed) {
      setSwipe(null);
    } else if (prefersReducedMotion()) {
      dismiss();
    } else {
      const width = event.currentTarget.offsetWidth;
      setSwipe({
        dragging: false,
        leaving: true,
        offset: Math.sign(distance) * (width + 32),
      });
    }
  };

  const swipeHandlers = {
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerCancel?.(event);
      endSwipe(event);
    },
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event);
      if (
        !canSwipe ||
        event.defaultPrevented ||
        event.pointerType !== "touch" ||
        !event.isPrimary
      ) {
        return;
      }
      swipeRef.current = {
        active: false,
        id: event.pointerId,
        lastTime: event.timeStamp,
        lastX: event.clientX,
        startX: event.clientX,
        startY: event.clientY,
        velocity: 0,
      };
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event);
      const drag = swipeRef.current;
      if (!drag || drag.id !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.active) {
        if (Math.abs(dy) > SWIPE_SLOP && Math.abs(dy) >= Math.abs(dx)) {
          // Up or down - the page scrolls, the toast stays
          swipeRef.current = null;
          return;
        }
        if (Math.abs(dx) <= SWIPE_SLOP) return;
        drag.active = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }

      const elapsed = event.timeStamp - drag.lastTime;
      if (elapsed > 0) drag.velocity = (event.clientX - drag.lastX) / elapsed;
      drag.lastTime = event.timeStamp;
      drag.lastX = event.clientX;
      setSwipe({ dragging: true, leaving: false, offset: dx });
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerUp?.(event);
      endSwipe(event);
    },
  };

  if (isGone) return null;

  // Rendered on its own, the toast is a live region itself
  const liveRegionProps = inRegion
    ? {}
    : {
        "aria-atomic": true,
        "aria-live":
          tone === "danger" ? ("assertive" as const) : ("polite" as const),
        role: "status",
      };

  // In from the edge of the screen its region is at, and back out to it
  const fromBottom = region?.edge === "bottom";
  const enterAnimation = fromBottom
    ? "animate-slide-in-up"
    : "animate-slide-down";
  const exitAnimation = fromBottom
    ? "animate-slide-out-down"
    : "animate-slide-up";
  const VariantIcon = tone === "default" ? null : variantIcons[tone];

  return (
    <div
      {...props}
      {...liveRegionProps}
      {...swipeHandlers}
      className={cn(
        // Transparent until its text is there, then it slides in
        isShown ? (isAnnounced ? enterAnimation : "opacity-0") : exitAnimation,
        "pointer-events-auto rounded-md border p-4 shadow-md focus:outline-hidden focus-visible:ring-2",
        // Sideways it can be swiped - up and down the page scrolls
        canSwipe && "touch-pan-y",
        // Back into place, or out of the screen, once the finger lets go
        swipe &&
          !swipe.dragging &&
          "transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none",
        variantStyles[tone],
        className,
      )}
      data-state={isShown && !isSwipedOut ? "open" : "closed"}
      // The next toast gets the focus of a dismissed one - not one sliding out
      data-toast={isShown && !isSwipedOut ? "visible" : "hiding"}
      data-variant={tone}
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
      // The toast's own ref, and the one given to it
      ref={(element) => {
        toastRef.current = element;
        const detachRef = attachRef(ref, element);
        return () => {
          toastRef.current = null;
          detachRef();
        };
      }}
      style={
        swipe
          ? {
              ...style,
              // Fading as it goes
              opacity: swipe.leaving
                ? 0
                : Math.max(0.4, 1 - Math.abs(swipe.offset) / 240),
              translate: `${swipe.offset}px`,
            }
          : style
      }
      tabIndex={0}
    >
      <div
        className={cn("flex items-center gap-3", !isAnnounced && "invisible")}
      >
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
        {!loading && VariantIcon && (
          // Only in forced colors - elsewhere the color tells the variant
          <VariantIcon
            aria-hidden="true"
            className="hidden size-4 shrink-0 forced-colors:block"
            data-toast-icon=""
          />
        )}
        <div className="min-w-0 flex-1">
          {hasTitle && <div className="font-semibold">{title}</div>}
          <div className={cn(hasTitle && "mt-0.5 text-sm")}>{message}</div>
        </div>
        {action && (
          <button
            className="-my-1 shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-current/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
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
            className="shrink-0 cursor-pointer rounded text-neutral-500 hover:text-neutral-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:text-neutral-300"
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
