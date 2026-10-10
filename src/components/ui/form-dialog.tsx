import { useState } from "react";
import cn from "../../utils/cn";
import { useMessages } from "../../providers/ui-context";
import Alert from "./alert";
import Button, { type ButtonProps } from "./button";
import ConfirmDialog from "./confirm-dialog";
import Dialog, { DialogFooter, type DialogProps } from "./dialog";
import { DialogCloseButton } from "./modal-dialog";

export interface FormDialogProps extends Omit<
  DialogProps,
  "children" | "onClose" | "onSubmit" | "open" | "title"
> {
  /** Label of the button that closes the dialog - "Cancel" by default. */
  cancelLabel?: React.ReactNode;
  /** The fields of the form. */
  children: React.ReactNode;
  /**
   * The form has changes that are not saved - closing the dialog (Cancel,
   * the close button, Escape, the backdrop) asks "Discard changes?" first.
   * An `onBeforeClose` of yours asks instead.
   */
  dirty?: boolean;
  /**
   * A message above the fields, in a danger `Alert` - why the last attempt
   * to save failed, when it is no error of a single field (those go to the
   * fields' `error`).
   */
  error?: React.ReactNode;
  /** The heading of the `error`. */
  errorTitle?: React.ReactNode;
  /** Content at the start of the footer, e.g. a "Delete" button. */
  footerStart?: React.ReactNode;
  /**
   * Attributes of the `<form>` - e.g. `noValidate` to leave the checks to
   * your code, or a `name`.
   */
  formProps?: Omit<React.ComponentProps<"form">, "children" | "onSubmit">;
  /**
   * Called when the user closes the dialog - also by Cancel - once a
   * `dirty` form's question was answered "Discard".
   */
  onClose: () => void;
  /**
   * Called when the form is submitted (the submit button, Enter in a field)
   * - its default prevented. Not while `saving` or `submitDisabled`. The
   * event goes no further: neither a `<form>` of the page around the dialog
   * nor listeners of `document` get it.
   */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Controls the dialog. */
  open: boolean;
  /**
   * The form is being saved - the submit button shows a spinner, and the
   * dialog cannot be closed meanwhile (as with `closeDisabled`).
   */
  saving?: boolean;
  /**
   * Color of the submit button - `danger` for a form that deletes or ends
   * something.
   * @default "primary"
   */
  submitColor?: ButtonProps["color"];
  /**
   * The submit button does nothing - e.g. while files of the form upload.
   * It looks disabled.
   */
  submitDisabled?: boolean;
  /** An icon before the label of the submit button. */
  submitIcon?: React.ReactNode;
  /** Label of the submit button, e.g. "Save changes". */
  submitLabel: React.ReactNode;
  /** Heading - also the accessible name of the dialog. */
  title: React.ReactNode;
}

/**
 * A `Dialog` with a form - the fields, an error of the last save above
 * them, and Cancel with the submit button in a `DialogFooter`. While the
 * form saves, the submit button spins and the dialog stays open; a form
 * with unsaved changes asks before it closes.
 */
export default function FormDialog({
  cancelLabel,
  children,
  closeDisabled = false,
  dirty = false,
  error,
  errorTitle,
  footerStart,
  formProps,
  onBeforeClose,
  onClose,
  onSubmit,
  open,
  saving = false,
  size = "lg",
  submitColor = "primary",
  submitDisabled = false,
  submitIcon,
  submitLabel,
  title,
  ...props
}: FormDialogProps) {
  const messages = useMessages().ui;
  // The answer of "Discard changes?" the dialog waits for
  const [question, setQuestion] = useState<{
    answer: (discard: boolean) => void;
  } | null>(null);

  const hasError =
    error !== undefined && error !== null && error !== false && error !== "";

  // Whether the dialog may close - asked by the Dialog for its close button,
  // Escape, the backdrop and Cancel, one answer at a time
  const mayClose = (): boolean | void | PromiseLike<boolean | void> => {
    if (onBeforeClose) return onBeforeClose();
    if (!dirty) return true;
    return new Promise<boolean>((resolve) => {
      setQuestion({ answer: resolve });
    });
  };

  const answer = (discard: boolean) => {
    question?.answer(discard);
    setQuestion(null);
  };

  // Closed by its owner while it asks - the question goes with it, and the
  // Dialog stops waiting for its answer as it closes
  if (!open && question !== null) setQuestion(null);

  return (
    <>
      <Dialog
        {...props}
        closeDisabled={saving || closeDisabled}
        onBeforeClose={mayClose}
        onClose={onClose}
        open={open}
        size={size}
        title={title}
      >
        <form
          {...formProps}
          className={cn("flex flex-col gap-4", formProps?.className)}
          // Not the form of the page the dialog is rendered in - React passes
          // its events on to it through the portal
          onReset={(event) => {
            event.stopPropagation();
            formProps?.onReset?.(event);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!saving && !submitDisabled) onSubmit(event);
          }}
        >
          {hasError && (
            <Alert title={errorTitle} type="danger">
              {error}
            </Alert>
          )}
          {children}
          <DialogFooter>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {footerStart}
              <div className="ms-auto flex flex-wrap justify-end gap-2">
                <DialogCloseButton
                  color="default"
                  disabled={saving || closeDisabled}
                  variant="outline"
                >
                  {cancelLabel ?? messages.common.cancel}
                </DialogCloseButton>
                <Button
                  aria-disabled={submitDisabled || undefined}
                  className={cn(
                    submitDisabled && "cursor-not-allowed opacity-60",
                  )}
                  color={submitColor}
                  loading={saving}
                  startIcon={submitIcon}
                  type="submit"
                >
                  {submitLabel}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </Dialog>
      <ConfirmDialog
        cancelLabel={messages.formDialog.keepEditing}
        confirmColor="danger"
        confirmLabel={messages.formDialog.discard}
        message={messages.formDialog.discardMessage}
        onClose={() => answer(false)}
        onConfirm={() => answer(true)}
        open={question !== null}
        title={messages.formDialog.discardTitle}
      />
    </>
  );
}
