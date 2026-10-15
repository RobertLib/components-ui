import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Button, { type ButtonProps } from "./button";
import Dialog, { DialogFooter, type DialogSize } from "./dialog";
import Input from "./input";
import Textarea from "./textarea";
import { getActiveElement } from "./overlay-stack";
import { formatPlural } from "../../i18n/ui/format";
import { joinTokens } from "../../utils/cn";
import isPromiseLike from "../../utils/is-promise-like";
import logger from "../../utils/logger";
import { useLocale } from "../../providers/ui-context";

/**
 * Checks the value of a `PromptDialog` before it is confirmed - returns the
 * message to show under the field, or nothing when the value is fine. May
 * return a promise, e.g. of a request that asks the server whether a name
 * is taken.
 */
export type PromptValidate = (
  value: string,
) =>
  | string
  | null
  | undefined
  | void
  | PromiseLike<string | null | undefined | void>;

export interface PromptDialogProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "className" | "defaultValue" | "onSubmit" | "role" | "title"
> {
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string;
  /** Extra content under the field. */
  children?: React.ReactNode;
  /** Classes of the dialog window. */
  className?: string;
  /** Color of the confirm button - `danger` for a destructive action. */
  confirmColor?: ButtonProps["color"];
  /** Defaults to the localized "Confirm". */
  confirmLabel?: string;
  /**
   * The value the field starts with each time the dialog opens - e.g. the
   * name of a copy, "Copy of Invoice 2026-041". It is selected, so typing
   * replaces it.
   */
  defaultValue?: string;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /**
   * Label of the field. Without one, the field is named by the `title` of
   * the dialog.
   */
  label?: React.ReactNode;
  /**
   * Shows a spinner on the confirm button, makes the field read-only and
   * disables cancelling - e.g. while the request of `onConfirm` runs.
   */
  loading?: boolean;
  /**
   * The most characters the value may have - the field takes no more, and
   * a longer `defaultValue` is refused with a message. A `multiline` field
   * shows a counter.
   */
  maxLength?: number;
  /** The question - screen readers read it as the description of the dialog. */
  message?: React.ReactNode;
  /**
   * A multi-line field (`Textarea`) that grows with the text - e.g. for the
   * reason of a rejection. Enter starts a new line there; Ctrl + Enter (⌘ +
   * Enter on a Mac) confirms.
   */
  multiline?: boolean;
  /** Cancel, the close button or Escape was used. */
  onClose: () => void;
  /**
   * The value was confirmed - trimmed of the spaces around it and checked by
   * `required`, `maxLength` and `validate`. Close the dialog yourself once
   * done.
   */
  onConfirm: (value: string) => void;
  /** Whether the dialog is shown. */
  open?: boolean;
  /** Placeholder of the field. */
  placeholder?: string;
  /**
   * An empty value - also one of spaces only - is refused with the
   * localized "Fill in this field.".
   */
  required?: boolean;
  /** Maximum width of the dialog. */
  size?: DialogSize;
  /** Heading of the dialog. */
  title: string;
  /**
   * Checks the value as the user confirms it, after `required` and
   * `maxLength` - returns the message to show under the field, or nothing
   * when the value is fine. While a returned promise is pending the confirm
   * button shows a spinner. A failure keeps the dialog open; it is logged
   * in development.
   */
  validate?: PromptValidate;
}

/** What `validate` said - `message` is shown under the field. */
type Validity = { valid: true } | { message?: string; valid: false };

const logFailure = (error: unknown) =>
  logger.error(
    "The validate of a prompt failed - the dialog stays open.",
    error,
  );

const toValidity = (result: unknown): Validity =>
  typeof result === "string" && result !== ""
    ? { message: result, valid: false }
    : { valid: true };

/**
 * Runs `validate` - a promise when it returns one. Out here, as the React
 * Compiler cannot compile a try / catch around conditionals.
 */
function runValidation(
  validate: PromptValidate,
  value: string,
): Validity | Promise<Validity> {
  let result: unknown;

  try {
    result = validate(value);
  } catch (error) {
    logFailure(error);
    return { valid: false };
  }

  if (!isPromiseLike(result)) return toValidity(result);

  return Promise.resolve(result).then(toValidity, (error: unknown) => {
    logFailure(error);
    return { valid: false } as const;
  });
}

/**
 * A dialog asking the user for a text - the reason of a rejection, the name
 * of a copy. The value is checked by `required`, `maxLength` and `validate`
 * as the user confirms it (Enter, or Ctrl + Enter in a `multiline` field),
 * and the message of a refused value is shown under the field. `ref` and
 * the other props go to the dialog window, as in `Dialog`. `usePrompt()`
 * asks the same in one line.
 */
export default function PromptDialog({
  "aria-describedby": ariaDescribedBy,
  cancelLabel,
  children,
  className,
  confirmColor = "primary",
  confirmLabel,
  defaultValue = "",
  description,
  label,
  loading = false,
  maxLength,
  message,
  multiline = false,
  onClose,
  onConfirm,
  open,
  placeholder,
  required = false,
  size = "md",
  title,
  validate,
  ...props
}: PromptDialogProps) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const messageId = useId();
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Tells the checks of one opening apart from those of the next - a
  // result that comes after the dialog closed is dropped
  const runRef = useRef(0);
  // The latest `onConfirm` - for a check that ends later
  const onConfirmRef = useRef(onConfirm);

  useLayoutEffect(() => {
    onConfirmRef.current = onConfirm;
  });

  // Each opening starts anew, with the default value
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(defaultValue);
      setError(null);
      setValidating(false);
    }
  }

  const busy = loading || validating;

  // Opened, the field has the focus (`autoFocus`) - its default value is
  // selected, so typing replaces it. A check of the last opening is dropped.
  useEffect(() => {
    if (!open) return;
    const field = fieldRef.current;
    if (field && field === getActiveElement()) field.select();
    return () => {
      runRef.current += 1;
    };
  }, [open]);

  const refuse = (text?: string) => {
    setError(text ?? "");
    fieldRef.current?.focus();
  };

  const submit = () => {
    if (busy) return;

    const trimmed = value.trim();
    if (required && trimmed === "") {
      refuse(messages.promptDialog.required);
      return;
    }
    if (maxLength !== undefined && trimmed.length > maxLength) {
      refuse(
        formatPlural(locale.code, messages.promptDialog.tooLong, maxLength),
      );
      return;
    }
    if (!validate) {
      onConfirm(trimmed);
      return;
    }

    const outcome = runValidation(validate, trimmed);
    if (!isPromiseLike(outcome)) {
      if (outcome.valid) onConfirm(trimmed);
      else refuse(outcome.message);
      return;
    }

    runRef.current += 1;
    const run = runRef.current;
    setValidating(true);
    void outcome.then((validity) => {
      // Closed or opened anew meanwhile
      if (runRef.current !== run) return;
      setValidating(false);
      if (validity.valid) onConfirmRef.current(trimmed);
      else refuse(validity.message);
    });
  };

  const fieldProps = {
    "aria-label": label === undefined ? title : undefined,
    autoFocus: true,
    error: error || undefined,
    description,
    label,
    maxLength,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setValue(event.target.value);
      setError(null);
    },
    placeholder,
    // Read-only while it is checked or confirmed - it keeps the focus
    readOnly: busy,
    required,
    value,
  };

  return (
    <Dialog
      {...props}
      aria-describedby={joinTokens(
        message ? messageId : undefined,
        ariaDescribedBy,
      )}
      className={className}
      closeDisabled={busy}
      onClose={onClose}
      open={open}
      size={size}
      title={title}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // Not the submit of a form around the dialog in the React tree
          event.stopPropagation();
          submit();
        }}
      >
        {message && (
          <div
            className="text-sm text-neutral-700 dark:text-neutral-300"
            id={messageId}
          >
            {message}
          </div>
        )}

        {multiline ? (
          <Textarea
            {...fieldProps}
            autosize
            maxRows={10}
            minRows={3}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey) &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
            ref={fieldRef}
            showCount={maxLength !== undefined}
          />
        ) : (
          <Input {...fieldProps} ref={fieldRef} />
        )}

        {children}

        <DialogFooter>
          <div className="flex justify-end gap-2">
            <Button disabled={busy} onClick={onClose} variant="outline">
              {cancelLabel ?? messages.common.cancel}
            </Button>
            <Button color={confirmColor} loading={busy} type="submit">
              {confirmLabel ?? messages.common.confirm}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
