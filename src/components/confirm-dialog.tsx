import Button from "./button";
import Dialog, { DialogFooter } from "./dialog";
import { useMessages } from "../providers/ui-context";

export interface ConfirmDialogProps {
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string;
  /** Extra content under the message, e.g. a reason field. */
  children?: React.ReactNode;
  /** Color of the confirm button - `danger` for destructive actions. */
  confirmColor?: React.ComponentProps<typeof Button>["color"];
  /** Defaults to the localized "Confirm". */
  confirmLabel?: string;
  /** Shows a spinner on the confirm button and disables cancelling. */
  loading?: boolean;
  /** The question. */
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

/** A dialog asking the user to confirm an action. */
export default function ConfirmDialog({
  cancelLabel,
  children,
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

  return (
    <Dialog
      closeDisabled={loading}
      onClose={onClose}
      open={open}
      size={size}
      title={title}
    >
      <div className="space-y-4">
        {message && (
          <div className="text-sm text-neutral-700 dark:text-neutral-300">
            {message}
          </div>
        )}

        {children}

        <DialogFooter>
          <div className="flex justify-end gap-2">
            <Button disabled={loading} onClick={onClose} variant="outline">
              {cancelLabel ?? messages.common.cancel}
            </Button>
            <Button color={confirmColor} loading={loading} onClick={onConfirm}>
              {confirmLabel ?? messages.common.confirm}
            </Button>
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
