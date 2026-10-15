import { useRef, useState } from "react";
import { useMessages } from "../../../providers/ui-context";
import Avatar from "../avatar";
import Button from "../button";
import Kbd from "../kbd";
import MentionInput from "../mention-input";
import { mentionsToText } from "../mention-input/markup";
import type { CommentAuthor } from "./types";
import { getErrorMessage, isSubmitKey, type MentionFieldProps } from "./utils";

/** The `{shortcut}` of a text replaced by the keys. */
function SubmitHint({ template }: { template: string }) {
  const keys = <Kbd shortcut="mod+enter" size="sm" />;
  const [before, ...after] = template.split("{shortcut}");
  if (after.length === 0) {
    return (
      <>
        {keys} {template}
      </>
    );
  }
  return (
    <>
      {before}
      {keys}
      {after.join("")}
    </>
  );
}

interface ComposerProps extends MentionFieldProps {
  /** Takes the focus as it shows - the field of a reply. */
  autoFocus?: boolean;
  /** The avatar beside the field. */
  author?: CommentAuthor;
  /** Accessible name of the field. */
  label: string;
  /** Closes the field - a reply's; Escape does it too. */
  onCancel?: () => void;
  /** Sends the text - the field empties once it resolves. */
  onSubmit: (body: string) => Promise<void> | void;
  placeholder: string;
}

/**
 * The field of a new comment or a reply with its send button - Ctrl / ⌘ +
 * Enter sends too. While `onSubmit` runs the text stays, read-only; when it
 * fails it stays to be sent again, with the error under it.
 */
export default function Composer({
  author,
  autoFocus,
  label,
  loadSuggestions,
  maxLength,
  onCancel,
  onSubmit,
  placeholder,
  suggestions,
  triggers,
}: ComposerProps) {
  const messages = useMessages().ui;
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isEmpty = mentionsToText(value, { triggers }).trim() === "";

  const submit = () => {
    if (pending || isEmpty) return;
    setPending(true);
    setError(null);

    new Promise<void>((resolve) => resolve(onSubmit(value)))
      .then(() => {
        setPending(false);
        setValue("");
        // The send button disables with the empty field - the focus goes on
        // in the field, for the next comment
        const active = document.activeElement;
        if (
          !active ||
          active === document.body ||
          active === buttonRef.current
        ) {
          fieldRef.current?.focus();
        }
      })
      .catch((submitError) => {
        setPending(false);
        setError(
          getErrorMessage(submitError, messages.commentThread.submitError),
        );
      });
  };

  return (
    <div className="flex gap-3">
      {author && (
        <Avatar
          alt=""
          className="mt-1 shrink-0"
          color="auto"
          name={author.name}
          size="md"
          src={author.avatarUrl}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <MentionInput
          aria-label={label}
          autoFocus={autoFocus}
          autosize
          error={error ?? undefined}
          loadSuggestions={loadSuggestions}
          maxLength={maxLength}
          maxRows={12}
          minRows={2}
          onChange={setValue}
          onKeyDown={(event) => {
            if (isSubmitKey(event)) {
              event.preventDefault();
              submit();
            } else if (
              event.key === "Escape" &&
              onCancel &&
              !pending &&
              // The open list of suggestions takes its Escape itself
              !event.currentTarget.hasAttribute("aria-controls")
            ) {
              event.preventDefault();
              onCancel();
            }
          }}
          placeholder={placeholder}
          readOnly={pending}
          ref={fieldRef}
          suggestions={suggestions}
          triggers={triggers}
          value={value}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="me-auto text-xs text-neutral-600 max-sm:hidden dark:text-neutral-400">
            <SubmitHint template={messages.commentThread.submitHint} />
          </span>
          {onCancel && (
            <Button
              disabled={pending}
              onClick={onCancel}
              size="sm"
              variant="outline"
            >
              {messages.common.cancel}
            </Button>
          )}
          <Button
            disabled={isEmpty}
            loading={pending}
            onClick={submit}
            ref={buttonRef}
            size="sm"
          >
            {messages.commentThread.submit}
          </Button>
        </div>
      </div>
    </div>
  );
}
