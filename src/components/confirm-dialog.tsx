import { useEffect, useId, useRef, useState } from "react";
import Button from "./button";
import Dialog, { DialogFooter } from "./dialog";
import Input from "./input";
import { joinTokens } from "../utils/cn";
import { getActiveElement } from "./overlay-stack";
import { useMessages } from "../providers/ui-context";

export interface ConfirmDialogProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "className" | "role" | "title"
> {
  /**
   * Only an OK button - a message to acknowledge, not a question (an alert
   * dialog). Its button is the localized "OK" unless `confirmLabel` is
   * given; Escape and the close button call `onClose` as usual - handle
   * them like OK.
   */
  alert?: boolean;
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string;
  /** Extra content under the message, e.g. a reason field. */
  children?: React.ReactNode;
  /** Classes of the dialog window. */
  className?: string;
  /** Color of the confirm button - `danger` for destructive actions. */
  confirmColor?: React.ComponentProps<typeof Button>["color"];
  /** Defaults to the localized "Confirm" ("OK" for an `alert`). */
  confirmLabel?: string;
  /**
   * A text the user has to type - exactly, case too - before the confirm
   * button enables, e.g. the name of the project a destructive action
   * deletes. The field under the message says so in the active locale
   * ("Type … to confirm"); Enter in it confirms once it matches. It is
   * empty each time the dialog opens.
   */
  confirmationText?: string;
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
 * The instruction of `confirmationText` with the text to type in bold - in
 * place of the `{text}` of the localized message.
 */
function Instruction({ template, text }: { template: string; text: string }) {
  const [before, ...after] = template.split("{text}");
  const typed = <strong className="font-semibold break-all">{text}</strong>;

  // A translation that left the placeholder out still names the text
  if (after.length === 0) {
    return (
      <>
        {template} {typed}
      </>
    );
  }
  return (
    <>
      {before}
      {typed}
      {after.join(text)}
    </>
  );
}

/**
 * A dialog asking the user to confirm an action - an `alertdialog` named by
 * its title and described by its message. With `alert` it only tells them
 * something, with `confirmationText` they type a text to confirm. `ref` and
 * the other props go to the dialog window, as in `Dialog`.
 */
export default function ConfirmDialog({
  alert = false,
  "aria-describedby": ariaDescribedBy,
  cancelLabel,
  children,
  className,
  confirmColor = "primary",
  confirmLabel,
  confirmationText,
  loading = false,
  message,
  onClose,
  onConfirm,
  open,
  size = "md",
  title,
  ...props
}: ConfirmDialogProps) {
  const messages = useMessages();
  const messageId = useId();
  const fieldId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const wasLoadingRef = useRef(loading);
  // What the user typed of `confirmationText` - emptied at every opening
  const [typed, setTyped] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped("");
  }

  const isConfirmationMissing =
    confirmationText !== undefined && typed !== confirmationText;

  // The confirm button is disabled while loading, which takes the focus
  // from it - once the dialog is still open after the action (it failed),
  // the focus goes back, so Enter tries again. Not when it has moved on.
  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = loading;
    const button = confirmButtonRef.current;
    if (!wasLoading || loading || !button) return;

    const focused = getActiveElement();
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
      {...props}
      aria-describedby={joinTokens(
        message ? messageId : undefined,
        ariaDescribedBy,
      )}
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

        {confirmationText !== undefined && (
          <div className="space-y-1.5">
            <label
              className="block text-sm text-neutral-700 dark:text-neutral-300"
              htmlFor={fieldId}
            >
              <Instruction
                template={messages.confirmDialog.typeToConfirm}
                text={confirmationText}
              />
            </label>
            <Input
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              id={fieldId}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key !== "Enter" ||
                  event.nativeEvent.isComposing ||
                  event.keyCode === 229
                ) {
                  return;
                }
                event.preventDefault();
                if (!isConfirmationMissing && !loading) onConfirm();
              }}
              // Read-only while the action runs - it keeps the focus
              readOnly={loading}
              spellCheck={false}
              value={typed}
            />
          </div>
        )}

        {children}

        <DialogFooter>
          <div className="flex justify-end gap-2">
            {!alert && (
              <Button disabled={loading} onClick={onClose} variant="outline">
                {cancelLabel ?? messages.common.cancel}
              </Button>
            )}
            <Button
              color={confirmColor}
              disabled={isConfirmationMissing}
              loading={loading}
              onClick={onConfirm}
              ref={confirmButtonRef}
            >
              {confirmLabel ??
                (alert ? messages.confirmDialog.ok : messages.common.confirm)}
            </Button>
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
