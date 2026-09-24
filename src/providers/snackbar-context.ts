import { createContext, use, type RefObject } from "react";
import type { ToastAction, ToastVariant } from "../components/toast";

/** Identifies a toast of `SnackbarProvider` - for `closeSnackbar(id)`. */
export type SnackbarId = number;

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
  /** Keeps the toast on screen until the user dismisses it. */
  persist?: boolean;
  /** Heading above the message. */
  title?: string;
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
  error?: string | ((error: unknown) => string);
  /** Shown while the promise is pending, with a spinner. */
  loading: string;
  /**
   * Shown when the promise resolves - a function gets the value. Leave it
   * out to close the toast then.
   */
  success?: string | ((value: T) => string);
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
   * `maxToasts` of `SnackbarProvider` are on screen. The same message with
   * the same title and variant is not stacked twice while it is shown or
   * waits - the id of that toast is returned then. Once it slides out, it
   * can be shown again.
   */
  enqueueSnackbar: (
    message: string,
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
    options?: Omit<SnackbarOptions, "action">,
  ) => Promise<T>;
}

// Without a provider nothing is shown
export const SnackbarContext = createContext<SnackbarApi>({
  closeSnackbar: () => {},
  enqueueSnackbar: () => 0,
  promise: (promise) => promise,
});

export interface ToastRegion {
  /** The region with the toasts - the next toast gets the focus from it. */
  element: RefObject<HTMLElement | null>;
  /** Where the focus was before it moved into the toasts. */
  returnFocus: RefObject<HTMLElement | null>;
}

/**
 * Set by `SnackbarProvider`: its live regions announce the toasts added to
 * them, so a toast is no live region of its own there.
 */
export const ToastRegionContext = createContext<ToastRegion | null>(null);

/** Shows toasts - requires a `SnackbarProvider` above. */
export function useSnackbar() {
  return use(SnackbarContext);
}
