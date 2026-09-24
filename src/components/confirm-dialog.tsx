import { useEffect, useId, useRef } from "react";
import Button from "./button";
import Dialog, { DialogFooter } from "./dialog";
import { useMessages } from "../providers/ui-context";

export interface ConfirmDialogProps {
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string;
  /** Extra content under the message, e.g. a reason field. */
  children?: React.ReactNode;
  /** Classes of the dialog window. */
  className?: string;
  /** Color of the confirm button - `danger` for destructive actions. */
  confirmColor?: React.ComponentProps<typeof Button>["color"];
  /** Defaults to the localized "Confirm". */
  confirmLabel?: string;
  /**
   * Shows a spinner on the confirm button and disables cancelling. When it
   * ends with the dialog still open (the action failed), the focus goes back
   * to the confirm button.
   */
  loading?: boolean;
  /** The question - screen readers read it as the description of the dialog. */
  message?: React.ReactNode;
  /** Cancel or close was clicked. */
  onClose: () => void;
  /** The confirm button was clicked - close the dialog yourself once done. */
  onConfirm: () => void;
  /** Whether the dialog is shown. */
  open?: boolean;
  /** Maximum width of the dialog. */
  size?: React.ComponentProps<typeof Dialog>["size"];
  /** Heading of the dialog. */
  title: string;
}

/**
 * A dialog asking the user to confirm an action - an `alertdialog` named by
 * its title and described by its message.
 */
export default function ConfirmDialog({
  cancelLabel,
  children,
  className,
  confirmColor = "primary",
  confirmLabel,
  loading = false,
  message,
  onClose,
  onConfirm,
  open,
  size = "md",
  title,
}: ConfirmDialogProps) {
  const messages = useMessages();
  const messageId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const wasLoadingRef = useRef(loading);

  // The confirm button is disabled while loading, which takes the focus
  // from it - once the dialog is still open after the action (it failed),
  // the focus goes back, so Enter tries again. Not when it has moved on.
  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = loading;
    const button = confirmButtonRef.current;
    if (!wasLoading || loading || !button) return;

    const focused = document.activeElement;
    if (
      !focused ||
      focused === document.body ||
      focused === button.closest("[role='alertdialog']")
    ) {
      button.focus();
    }
  }, [loading]);

  return (
    <Dialog
      aria-describedby={message ? messageId : undefined}
      className={className}
      closeDisabled={loading}
      onClose={onClose}
      open={open}
      role="alertdialog"
      size={size}
      title={title}
    >
      <div className="space-y-4">
        {message && (
          <div
            className="text-sm text-neutral-700 dark:text-neutral-300"
            id={messageId}
          >
            {message}
          </div>
        )}

        {children}

        <DialogFooter>
          <div className="flex justify-end gap-2">
            <Button disabled={loading} onClick={onClose} variant="outline">
              {cancelLabel ?? messages.common.cancel}
            </Button>
            <Button
              color={confirmColor}
              loading={loading}
              onClick={onConfirm}
              ref={confirmButtonRef}
            >
              {confirmLabel ?? messages.common.confirm}
            </Button>
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
