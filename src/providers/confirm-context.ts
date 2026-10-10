import { createContext, use, useCallback } from "react";
import type { ConfirmDialogProps } from "../components/ui/confirm-dialog";

/**
 * What `confirm()` asks - the props of `ConfirmDialog`, which it shows (all
 * but its `ref` - e.g. a `data-testid` for the dialog), with an
 * `onConfirm` that may run the action before the dialog closes.
 */
export interface ConfirmOptions extends Omit<
  ConfirmDialogProps,
  "loading" | "onClose" | "onConfirm" | "open" | "ref"
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
 * `false` when they cancel (Cancel, the close button, Escape). An `alert`
 * resolves `true` however it is closed.
 */
export type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

/**
 * What `alert()` shows - the options of `confirm()` but those of a question
 * (`alert`, `cancelLabel`, `confirmationText`).
 */
export type AlertOptions = Omit<
  ConfirmOptions,
  "alert" | "cancelLabel" | "confirmationText"
>;

/**
 * Tells the user something in a dialog with an OK button - resolves once
 * they have closed it (OK, the close button, Escape).
 */
export type AlertFunction = (options: AlertOptions) => Promise<void>;

export const ConfirmContext =
  /* @__PURE__ */ createContext<ConfirmFunction | null>(null);

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

/**
 * Returns `alert(options)`, which shows a message in a `ConfirmDialog` with
 * an OK button only and resolves once the user has closed it - queued with
 * the questions of `useConfirm()`. Requires a `ConfirmProvider` above.
 *
 * ```tsx
 * const alert = useAlert();
 * await alert({ title: "Export finished", message: "12 invoices." });
 * ```
 */
export function useAlert(): AlertFunction {
  const confirm = useConfirm();

  return useCallback(
    (options: AlertOptions) =>
      confirm({ ...options, alert: true }).then(() => undefined),
    [confirm],
  );
}
