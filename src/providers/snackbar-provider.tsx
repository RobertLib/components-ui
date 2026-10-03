import {
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import cn from "../utils/cn";
import logger from "../utils/logger";
import Toast, {
  LIVE_REGION_DELAY,
  type ToastAction,
  type ToastVariant,
} from "../components/ui/toast";
import {
  SnackbarContext,
  ToastRegionContext,
  ToastRevisionContext,
  type SnackbarId,
  type SnackbarOptions,
  type SnackbarPosition,
  type SnackbarPromiseMessages,
  type SnackbarUpdate,
} from "./snackbar-context";
import { usePortalContainer } from "./ui-context";

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
  /** A `promise()` toast whose promise is pending - or `loading` given. */
  loading?: boolean;
  /** Text of the toast. */
  message: React.ReactNode;
  /** See `SnackbarOptions.persist`. */
  persist?: boolean;
  /** How often `updateSnackbar` changed it - see `ToastRevisionContext`. */
  revision: number;
  /** See `SnackbarOptions.title`. */
  title?: React.ReactNode;
  /** Color of the toast - `danger` for `error` too. */
  variant: Exclude<ToastVariant, "error">;
  /**
   * Enqueued before the live regions were in the page - while a
   * server-rendered page hydrates. It waits until they have been there a
   * moment: screen readers announce what is added to a region they know,
   * not a region that appears with it.
   */
  waitsForRegion: boolean;
}

/**
 * The text of a settled `promise()` toast - `undefined` closes the toast.
 * Out here, as the React Compiler cannot compile a try / catch around
 * conditionals.
 */
function resolveMessage<V>(
  message: React.ReactNode | ((value: V) => React.ReactNode),
  value: V,
): React.ReactNode {
  try {
    return typeof message === "function" ? message(value) : message;
  } catch (error) {
    logger.error("A message function of promise() threw", error);
    return undefined;
  }
}

const subscribeToNothing = () => () => {};

/** `danger` for its older name `error`. */
const normalizeVariant = (variant: ToastVariant) =>
  variant === "error" ? "danger" : variant;

/**
 * Whether the update of `updateSnackbar` is a new message - a text or an
 * element - and not the fields of a `SnackbarUpdate`.
 */
const isMessage = (
  update: React.ReactNode | SnackbarUpdate,
): update is React.ReactNode =>
  typeof update !== "object" ||
  update === null ||
  isValidElement(update) ||
  Symbol.iterator in update;

// Where the region is - at the top or the bottom, at the start, center or
// end of the screen from the `sm` breakpoint up; centered on phones, with
// the whole width for its toasts
const regionPositions: Record<
  SnackbarPosition,
  { column: string; region: string }
> = {
  "top-start": { column: "sm:items-start", region: "top-4 sm:ms-0" },
  "top-center": { column: "", region: "top-4" },
  "top-end": { column: "sm:items-end", region: "top-4 sm:me-0" },
  "bottom-start": { column: "sm:items-start", region: "bottom-4 sm:ms-0" },
  "bottom-center": { column: "", region: "bottom-4" },
  "bottom-end": { column: "sm:items-end", region: "bottom-4 sm:me-0" },
};

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
  /**
   * Where the toasts show - `top-center` by default; `start` / `end` follow
   * the writing direction of the page (`end` is the right, right to left
   * the left side). They slide in from that edge of the screen and back out
   * to it. On phones they are centered at that edge, as wide as the screen.
   */
  position?: SnackbarPosition;
}

/**
 * Renders the toasts queued with `useSnackbar().enqueueSnackbar` - into the
 * body, or the `portalContainer` of a `UIProvider` around it.
 */
export default function SnackbarProvider({
  children,
  maxToasts = 3,
  position = "top-center",
}: Readonly<SnackbarProviderProps>) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  // The toasts as the API left them - `enqueueSnackbar` looks up a toast
  // with the same message in them and returns its id right away
  const toastsRef = useRef<QueuedToast[]>([]);
  const nextId = useRef(0);
  const regionRef = useRef<HTMLDivElement>(null);
  const getPortalContainer = usePortalContainer();
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

  // The live regions have been in the page long enough for the toasts that
  // wait for them
  const [isRegionSettled, setIsRegionSettled] = useState(false);

  const updateToasts = useCallback(
    (change: (toasts: QueuedToast[]) => QueuedToast[]) => {
      toastsRef.current = change(toastsRef.current);
      setToasts(toastsRef.current);
    },
    [],
  );

  const addToast = useCallback(
    (toast: Omit<QueuedToast, "id" | "revision" | "waitsForRegion">) => {
      nextId.current += 1;
      const id = nextId.current;
      const waitsForRegion = regionRef.current === null;
      updateToasts((current) => [
        ...current,
        { ...toast, id, revision: 0, waitsForRegion },
      ]);
      return id;
    },
    [updateToasts],
  );

  const enqueueSnackbar = useCallback(
    (
      message: React.ReactNode,
      variant: ToastVariant = "default",
      options: SnackbarOptions = {},
    ) => {
      const tone = normalizeVariant(variant);
      // A toast with an action is its own - its action belongs to it. Texts
      // are the same when equal, elements when they are the same element.
      const shown =
        options.action || options.loading
          ? undefined
          : toastsRef.current.find(
              (toast) =>
                !toast.hiding &&
                !toast.loading &&
                !toast.action &&
                toast.message === message &&
                toast.title === options.title &&
                toast.variant === tone,
            );
      if (shown) return shown.id;

      return addToast({
        ...options,
        assertive: tone === "danger",
        message,
        variant: tone,
      });
    },
    [addToast],
  );

  const updateSnackbar = useCallback(
    (id: SnackbarId, update: React.ReactNode | SnackbarUpdate) => {
      // Closed meanwhile, or sliding out - it stays gone. Nothing given,
      // nothing changes.
      if (
        update == null ||
        !toastsRef.current.some((toast) => toast.id === id && !toast.hiding)
      ) {
        return;
      }

      const { variant, ...fields }: SnackbarUpdate = isMessage(update)
        ? { message: update }
        : update;

      updateToasts((current) =>
        current.map((toast) =>
          toast.id === id
            ? {
                ...toast,
                // A field given as `undefined` is removed - a title, an
                // action
                ...fields,
                // Its time on screen starts over - the new text can be read
                revision: toast.revision + 1,
                variant: variant ? normalizeVariant(variant) : toast.variant,
              }
            : toast,
        ),
      );
    },
    [updateToasts],
  );

  const closeSnackbar = useCallback(
    (id?: SnackbarId) => {
      updateToasts((current) => {
        const shown = selectShown(
          current.filter((toast) => isRegionSettled || !toast.waitsForRegion),
          maxToasts,
        );
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
    [isRegionSettled, maxToasts, updateToasts],
  );

  const promise = useCallback(
    <T,>(
      pending: Promise<T>,
      messages: SnackbarPromiseMessages<T>,
      options: Omit<SnackbarOptions, "action" | "loading"> = {},
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

      const settle = (
        message: React.ReactNode,
        variant: QueuedToast["variant"],
      ) => {
        // Dismissed or closed meanwhile - it stays gone
        const toast = toastsRef.current.find((other) => other.id === id);
        if (!toast || toast.hiding) return;

        // No message for it - nothing to show
        if (message == null) {
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
          settle(resolveMessage(messages.error, error), "danger"),
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
    <ToastRevisionContext key={toast.id} value={toast.revision}>
      <Toast
        action={toast.action}
        duration={toast.duration}
        loading={toast.loading}
        message={toast.message}
        onClose={() => handleToastClose(toast.id)}
        onHide={() => handleToastHide(toast.id)}
        open={!toast.hiding}
        persist={toast.persist}
        title={toast.title}
        variant={toast.variant}
      />
    </ToastRevisionContext>
  );

  // Toasts enqueued before the live regions were in the page wait a moment
  // after they are
  const isWaitingForRegion = toasts.some((toast) => toast.waitsForRegion);

  useEffect(() => {
    if (!isHydrated || !isWaitingForRegion || isRegionSettled) return;

    const timer = setTimeout(() => setIsRegionSettled(true), LIVE_REGION_DELAY);
    return () => clearTimeout(timer);
  }, [isHydrated, isRegionSettled, isWaitingForRegion]);

  const shownToasts = selectShown(
    isRegionSettled ? toasts : toasts.filter((toast) => !toast.waitsForRegion),
    maxToasts,
  );
  const errors = shownToasts.filter((toast) => toast.assertive);
  const others = shownToasts.filter((toast) => !toast.assertive);

  const edge = position.startsWith("bottom") ? "bottom" : "top";
  const placement = regionPositions[position];

  // In a portal above the dialogs (z-50) and popovers: a toast raised from a
  // Dialog shows over its backdrop, and a Dialog's focus trap lets the focus
  // into it (its close button). As wide as the widest toast (`w-max`), up to
  // 36rem - 1rem from the edges of the screen, centered by its margins, or
  // at the start or the end by the margin there.
  const region = (
    <div
      // FOCUS_TRAP_EXEMPT_ATTRIBUTE of the overlay stack
      data-focus-trap-exempt=""
      className={cn(
        "pointer-events-none fixed inset-x-4 z-60 mx-auto flex w-max max-w-[min(calc(100vw-2rem),36rem)] flex-col items-center",
        placement.region,
        placement.column,
      )}
      data-position={position}
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
        value={{ edge, element: regionRef, returnFocus: returnFocusRef }}
      >
        <div
          aria-live="assertive"
          className={cn("flex flex-col items-center gap-2.5", placement.column)}
        >
          {errors.map(renderToast)}
        </div>
        <div
          aria-live="polite"
          className={cn(
            "flex flex-col items-center gap-2.5",
            placement.column,
            errors.length > 0 && others.length > 0 && "mt-2.5",
          )}
        >
          {others.map(renderToast)}
        </div>
      </ToastRegionContext>
    </div>
  );

  return (
    <SnackbarContext
      value={{ closeSnackbar, enqueueSnackbar, promise, updateSnackbar }}
    >
      {children}

      {isHydrated && createPortal(region, getPortalContainer())}
    </SnackbarContext>
  );
}
