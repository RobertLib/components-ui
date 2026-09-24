import { createContext, use } from "react";
import type { ConfirmDialogProps } from "../components/confirm-dialog";

/**
 * What `confirm()` asks - the props of `ConfirmDialog`, which it shows, with
 * an `onConfirm` that may run the action before the dialog closes.
 */
export interface ConfirmOptions extends Omit<
  ConfirmDialogProps,
  "loading" | "onClose" | "onConfirm" | "open"
> {
  /**
   * Runs when the user confirms, before `confirm()` resolves `true` - e.g.
   * the request that deletes the record. While a returned promise is
   * pending, the confirm button shows a spinner and the dialog cannot be
   * cancelled. Return (or resolve) `false` to keep the dialog open. A
   * rejection keeps it open too, so the user can try again or cancel - tell
   * them about the error yourself (e.g. with a toast); it is logged in
   * development.
   */
  onConfirm?: () => unknown;
}

/**
 * Asks the user in a `ConfirmDialog` - resolves `true` once they confirm,
 * `false` when they cancel (Cancel, the close button, Escape).
 */
export type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFunction | null>(null);

/**
 * Returns `confirm(options)`, which asks the user in a `ConfirmDialog` and
 * resolves whether they confirmed - no `open` state to manage. Requires a
 * `ConfirmProvider` above.
 *
 * ```tsx
 * const confirm = useConfirm();
 * if (await confirm({ title: "Delete the order?", confirmColor: "danger" })) …
 * ```
 */
export function useConfirm(): ConfirmFunction {
  const confirm = use(ConfirmContext);

  if (!confirm) {
    throw new Error(
      "useConfirm() needs a <ConfirmProvider> above it - render one near the root of the app, e.g. around the router.",
    );
  }

  return confirm;
}
