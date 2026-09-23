import { createContext, use } from "react";
import type { ToastVariant } from "../components/toast";

export interface SnackbarOptions {
  /**
   * How long the toast stays on screen, in milliseconds - the time it is
   * hovered or focused does not count. Default 3000.
   */
  duration?: number;
  /** Keeps the toast on screen until the user dismisses it. */
  persist?: boolean;
}

export interface SnackbarApi {
  /**
   * Shows a toast. The same message with the same variant is not stacked
   * twice while it is still visible.
   */
  enqueueSnackbar: (
    message: string,
    variant?: ToastVariant,
    options?: SnackbarOptions,
  ) => void;
}

export const SnackbarContext = createContext<SnackbarApi>({
  enqueueSnackbar: () => {},
});

/**
 * Set by `SnackbarProvider`: its live regions announce the toasts added to
 * them, so a toast is no live region of its own there.
 */
export const ToastRegionContext = createContext(false);

/** Shows toasts - requires a `SnackbarProvider` above. */
export function useSnackbar() {
  return use(SnackbarContext);
}
