import { createContext, use, type RefObject } from "react";
import type { ToastAction, ToastVariant } from "../components/ui/toast";

/** Identifies a toast of `SnackbarProvider` - for `closeSnackbar(id)`. */
export type SnackbarId = number;

/**
 * Where `SnackbarProvider` shows its toasts - at the top or the bottom of
 * the screen, at its start (left, right to left right), center or end. On
 * phones they are centered, as wide as the screen.
 */
export type SnackbarPosition =
  | "top-start"
  | "top-center"
  | "top-end"
  | "bottom-start"
  | "bottom-center"
  | "bottom-end";

export interface SnackbarOptions {
  /**
   * A button in the toast, e.g. "Undo" after a delete - the toast closes
   * once it is pressed, and stays 6 s by default. Such a toast is shown
   * also when the same message is on screen already.
   */
  action?: ToastAction;
  /**
   * How long the toast stays on screen, in milliseconds - the time it is
   * hovered or focused, or the page is hidden (another tab is shown), does
   * not count. Default 3000, 6000 with an `action`.
   */
  duration?: number;
  /**
   * Shows a spinner and keeps the toast on screen - e.g. while an upload
   * runs - until `updateSnackbar` sets it `false`; `duration` counts from
   * then.
   */
  loading?: boolean;
  /** Keeps the toast on screen until the user dismisses it. */
  persist?: boolean;
  /** Heading above the message. */
  title?: React.ReactNode;
}

/**
 * What `updateSnackbar` changes in a toast - the options, the message and
 * the variant; what is left out stays as it is.
 */
export interface SnackbarUpdate extends SnackbarOptions {
  /** The new text of the toast. */
  message?: React.ReactNode;
  /** The new color of the toast. */
  variant?: ToastVariant;
}

/**
 * The texts of `promise()` - the toast shows `loading` until the promise
 * settles, then `success` or `error` in its place.
 */
export interface SnackbarPromiseMessages<T> {
  /**
   * Shown when the promise rejects - a function gets the error. Leave it
   * out to close the toast then, e.g. when the form shows the error.
   */
  error?: React.ReactNode | ((error: unknown) => React.ReactNode);
  /** Shown while the promise is pending, with a spinner. */
  loading: React.ReactNode;
  /**
   * Shown when the promise resolves - a function gets the value. Leave it
   * out to close the toast then.
   */
  success?: React.ReactNode | ((value: T) => React.ReactNode);
}

export interface SnackbarApi {
  /**
   * Closes the toast `enqueueSnackbar` returned the id of - without an id
   * every toast. It slides out as when its time is up; one still waiting
   * for its turn (see `maxToasts`) never shows.
   */
  closeSnackbar: (id?: SnackbarId) => void;
  /**
   * Shows a toast and returns its id - after the toasts before it, when
   * `maxToasts` of `SnackbarProvider` are on screen. `message` is a text or
   * any React node, e.g. with a link. The same message with the same title
   * and variant is not stacked twice while it is shown or waits - the id of
   * that toast is returned then; texts are the same when they are equal,
   * elements only when they are the very same element (JSX written in the
   * call makes a new one each time, so it always shows). Once it slides
   * out, it can be shown again.
   */
  enqueueSnackbar: (
    message: React.ReactNode,
    variant?: ToastVariant,
    options?: SnackbarOptions,
  ) => SnackbarId;
  /**
   * Shows one toast for a promise: `messages.loading` with a spinner while
   * it is pending, then the success or error message in its place, colored
   * accordingly - `duration` counts from then. Returns the promise, so
   * `await promise(save(), …)` gives its value or throws its error.
   */
  promise: <T>(
    promise: Promise<T>,
    messages: SnackbarPromiseMessages<T>,
    options?: Omit<SnackbarOptions, "action" | "loading">,
  ) => Promise<T>;
  /**
   * Changes a toast in place - `enqueueSnackbar` returned its id: a new
   * message (text or node), or the `SnackbarUpdate` fields to change, e.g.
   * `{ message: "Uploaded", variant: "success", loading: false }`. Screen
   * readers announce the new text, and its `duration` starts over, so it
   * can be read. A toast closed meanwhile stays closed.
   */
  updateSnackbar: (
    id: SnackbarId,
    update: React.ReactNode | SnackbarUpdate,
  ) => void;
}

// Without a provider nothing is shown
export const SnackbarContext = /* @__PURE__ */ createContext<SnackbarApi>({
  closeSnackbar: () => {},
  enqueueSnackbar: () => 0,
  promise: (promise) => promise,
  updateSnackbar: () => {},
});

export interface ToastRegion {
  /** The region with the toasts - the next toast gets the focus from it. */
  element: RefObject<HTMLElement | null>;
  /**
   * The edge of the screen the region is at - its toasts slide in from it
   * and back out to it.
   */
  edge: "top" | "bottom";
  /** Where the focus was before it moved into the toasts. */
  returnFocus: RefObject<HTMLElement | null>;
}

/**
 * Set by `SnackbarProvider`: its live regions announce the toasts added to
 * them, so a toast is no live region of its own there.
 */
export const ToastRegionContext =
  /* @__PURE__ */ createContext<ToastRegion | null>(null);

/**
 * Set by `SnackbarProvider` around each toast: how often `updateSnackbar`
 * has changed it - its time on screen starts over at each change.
 */
export const ToastRevisionContext = /* @__PURE__ */ createContext(0);

/** Shows toasts - requires a `SnackbarProvider` above. */
export function useSnackbar() {
  return use(SnackbarContext);
}
