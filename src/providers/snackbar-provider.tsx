import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import cn from "../utils/cn";
import logger from "../utils/logger";
import Toast, {
  type ToastAction,
  type ToastVariant,
} from "../components/toast";
import {
  SnackbarContext,
  ToastRegionContext,
  type SnackbarId,
  type SnackbarOptions,
  type SnackbarPromiseMessages,
} from "./snackbar-context";

interface QueuedToast {
  /** See `SnackbarOptions.action`. */
  action?: ToastAction;
  /**
   * In the assertive live region - an error. A toast stays in the region it
   * was added to: moved to the other one it would be mounted anew.
   */
  assertive: boolean;
  /** See `SnackbarOptions.duration`. */
  duration?: number;
  /** Sliding out - the same message can be shown again meanwhile. */
  hiding?: boolean;
  /** Key of the toast in the list. */
  id: SnackbarId;
  /** A `promise()` toast whose promise is pending. */
  loading?: boolean;
  /** Text of the toast. */
  message: string;
  /** See `SnackbarOptions.persist`. */
  persist?: boolean;
  /** See `SnackbarOptions.title`. */
  title?: string;
  /** Color of the toast. */
  variant: ToastVariant;
}

/**
 * The text of a settled `promise()` toast - `undefined` closes the toast.
 * Out here, as the React Compiler cannot compile a try / catch around
 * conditionals.
 */
function resolveMessage<V>(
  message: string | ((value: V) => string) | undefined,
  value: V,
) {
  try {
    return typeof message === "function" ? message(value) : message;
  } catch (error) {
    logger.error("A message function of promise() threw", error);
    return undefined;
  }
}

const subscribeToNothing = () => () => {};

/**
 * The toasts on screen: those sliding out, and the first `max` of the
 * others - the rest wait for their turn.
 */
function selectShown(toasts: QueuedToast[], max: number) {
  let free = Math.max(1, max);
  return toasts.filter((toast) => {
    if (toast.hiding) return true;
    if (free === 0) return false;
    free -= 1;
    return true;
  });
}

export interface SnackbarProviderProps {
  /** The app - `useSnackbar()` works anywhere inside. */
  children: React.ReactNode;
  /**
   * The most toasts on screen at once (at least 1). Further ones wait and
   * show in their order as the shown ones go, so a burst of messages does
   * not cover the page - their time on screen starts once they show. A
   * `persist` toast keeps its place until it is dismissed. `Infinity` for
   * no limit.
   */
  maxToasts?: number;
}

/** Renders the toasts queued with `useSnackbar().enqueueSnackbar`. */
export default function SnackbarProvider({
  children,
  maxToasts = 3,
}: Readonly<SnackbarProviderProps>) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  // The toasts as the API left them - `enqueueSnackbar` looks up a toast
  // with the same message in them and returns its id right away
  const toastsRef = useRef<QueuedToast[]>([]);
  const nextId = useRef(0);
  const regionRef = useRef<HTMLDivElement>(null);
  // Where the focus was before it moved into the toasts - it goes back there
  // when the focused toast is dismissed
  const returnFocusRef = useRef<HTMLElement>(null);
  // False on the server and while a server-rendered page hydrates - its HTML
  // has no portal. Rendered on the client only, it is true at once.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const updateToasts = useCallback(
    (change: (toasts: QueuedToast[]) => QueuedToast[]) => {
      toastsRef.current = change(toastsRef.current);
      setToasts(toastsRef.current);
    },
    [],
  );

  const addToast = useCallback(
    (toast: Omit<QueuedToast, "id">) => {
      nextId.current += 1;
      const id = nextId.current;
      updateToasts((current) => [...current, { ...toast, id }]);
      return id;
    },
    [updateToasts],
  );

  const enqueueSnackbar = useCallback(
    (
      message: string,
      variant: ToastVariant = "default",
      options: SnackbarOptions = {},
    ) => {
      // A toast with an action is its own - its action belongs to it
      const shown = options.action
        ? undefined
        : toastsRef.current.find(
            (toast) =>
              !toast.hiding &&
              !toast.loading &&
              !toast.action &&
              toast.message === message &&
              toast.title === options.title &&
              toast.variant === variant,
          );
      if (shown) return shown.id;

      return addToast({
        ...options,
        assertive: variant === "error",
        message,
        variant,
      });
    },
    [addToast],
  );

  const closeSnackbar = useCallback(
    (id?: SnackbarId) => {
      updateToasts((current) => {
        const shown = selectShown(current, maxToasts);
        return current.flatMap((toast) => {
          if (toast.hiding || (id !== undefined && toast.id !== id)) {
            return [toast];
          }
          // One still waiting for its turn goes at once - it has not been
          // on screen to slide out of it
          return shown.includes(toast) ? [{ ...toast, hiding: true }] : [];
        });
      });
    },
    [maxToasts, updateToasts],
  );

  const promise = useCallback(
    <T,>(
      pending: Promise<T>,
      messages: SnackbarPromiseMessages<T>,
      options: Omit<SnackbarOptions, "action"> = {},
    ) => {
      // In the polite region also when it ends in an error - it changes in
      // place, and screen readers announce its new text there
      const id = addToast({
        ...options,
        assertive: false,
        loading: true,
        message: messages.loading,
        variant: "default",
      });

      const settle = (message: string | undefined, variant: ToastVariant) => {
        // Dismissed or closed meanwhile - it stays gone
        const toast = toastsRef.current.find((other) => other.id === id);
        if (!toast || toast.hiding) return;

        if (message === undefined) {
          closeSnackbar(id);
          return;
        }

        updateToasts((current) =>
          current.map((other) =>
            other.id === id
              ? { ...other, loading: false, message, variant }
              : other,
          ),
        );
      };

      Promise.resolve(pending).then(
        (value) => settle(resolveMessage(messages.success, value), "success"),
        (error: unknown) =>
          settle(resolveMessage(messages.error, error), "error"),
      );

      return pending;
    },
    [addToast, closeSnackbar, updateToasts],
  );

  const handleToastHide = (id: SnackbarId) => {
    updateToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, hiding: true } : toast,
      ),
    );
  };

  const handleToastClose = (id: SnackbarId) => {
    updateToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const renderToast = (toast: QueuedToast) => (
    <Toast
      action={toast.action}
      duration={toast.duration}
      key={toast.id}
      loading={toast.loading}
      message={toast.message}
      onClose={() => handleToastClose(toast.id)}
      onHide={() => handleToastHide(toast.id)}
      open={!toast.hiding}
      persist={toast.persist}
      title={toast.title}
      variant={toast.variant}
    />
  );

  const shownToasts = selectShown(toasts, maxToasts);
  const errors = shownToasts.filter((toast) => toast.assertive);
  const others = shownToasts.filter((toast) => !toast.assertive);

  // In a portal above the dialogs (z-50) and popovers: a toast raised from a
  // Dialog shows over its backdrop, and a Dialog's focus trap lets the focus
  // into it (its close button). As wide as the widest toast (`w-max` - at
  // `left-1/2` it would get half the screen at most), up to 36rem.
  const region = (
    <div
      // FOCUS_TRAP_EXEMPT_ATTRIBUTE of the overlay stack
      data-focus-trap-exempt=""
      className="pointer-events-none fixed top-4 left-1/2 z-60 flex w-max max-w-[min(calc(100vw-2rem),36rem)] -translate-x-1/2 flex-col items-center"
      onFocus={(event) => {
        // From outside - not from one toast to another. Without an element
        // (the window got the focus back) the last one is kept.
        if (
          event.relatedTarget instanceof HTMLElement &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          returnFocusRef.current = event.relatedTarget;
        }
      }}
      ref={regionRef}
    >
      {/* The live regions are there before their toasts - screen readers
          announce what is added to a region, not a region that appears.
          Errors interrupt, the rest waits for a pause. */}
      <ToastRegionContext
        value={{ element: regionRef, returnFocus: returnFocusRef }}
      >
        <div
          aria-live="assertive"
          className="flex flex-col items-center gap-2.5"
        >
          {errors.map(renderToast)}
        </div>
        <div
          aria-live="polite"
          className={cn(
            "flex flex-col items-center gap-2.5",
            errors.length > 0 && others.length > 0 && "mt-2.5",
          )}
        >
          {others.map(renderToast)}
        </div>
      </ToastRegionContext>
    </div>
  );

  return (
    <SnackbarContext value={{ closeSnackbar, enqueueSnackbar, promise }}>
      {children}

      {isHydrated && createPortal(region, document.body)}
    </SnackbarContext>
  );
}
