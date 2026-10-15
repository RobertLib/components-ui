import { useEffect, useId, useRef, useState } from "react";
import type { FormatRelativeTime } from "../../../hooks/use-format-relative-time";
import { formatMessage } from "../../../i18n/ui/format";
import { useMessages } from "../../../providers/ui-context";
import cn from "../../../utils/cn";
import Avatar from "../avatar";
import Button from "../button";
import MentionInput from "../mention-input";
import { mentionsToText, type Mention } from "../mention-input/markup";
import MentionText from "../mention-input/mention-text";
import Tooltip from "../tooltip";
import Composer from "./composer";
import { getErrorMessage, isSubmitKey, type MentionFieldProps } from "./utils";
import type { CommentAuthor, CommentThreadItem } from "./types";

/** What every comment of a thread takes from it. */
export interface ThreadContext extends MentionFieldProps {
  canDelete: (comment: CommentThreadItem) => boolean;
  canEdit: (comment: CommentThreadItem) => boolean;
  /** Replies can be written - `allowReplies` with `onSubmit`. */
  canReply: boolean;
  currentUser?: CommentAuthor;
  formatAbsolute: (value: Date | string | number) => string;
  formatRelative: FormatRelativeTime;
  getMentionHref?: (mention: Mention) => string | undefined;
  onDelete: (comment: CommentThreadItem) => void;
  onEdit?: (comment: CommentThreadItem, body: string) => Promise<void> | void;
  onReply: (parent: CommentThreadItem, body: string) => Promise<void> | void;
  renderAttachments?: (comment: CommentThreadItem) => React.ReactNode;
  /** The comment whose reply field is open. */
  replyingTo: string | number | null;
  setReplyingTo: (id: string | number | null) => void;
}

// The actions under a comment - small, but a target of 24px
const actionClassName =
  "inline-flex min-h-6 cursor-pointer items-center rounded px-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-hidden dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";

const toDate = (value: Date | string | number) =>
  value instanceof Date ? value : new Date(value);

/** A moment as `<time>` - relative, the date and time in its tooltip. */
function Moment({
  context,
  value,
}: {
  context: ThreadContext;
  value: Date | string | number;
}) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;

  return (
    <Tooltip openOnClick title={context.formatAbsolute(date)}>
      <time
        className="text-neutral-600 dark:text-neutral-400"
        dateTime={date.toISOString()}
      >
        {context.formatRelative(date)}
      </time>
    </Tooltip>
  );
}

interface CommentItemProps {
  comment: CommentThreadItem;
  context: ThreadContext;
  /** The comment a reply replies to - its field opens for "Reply". */
  parent?: CommentThreadItem;
}

/**
 * A comment - its author, time, text, attachments and actions, and of a
 * top-level one its replies and the field of a new reply. Editing turns the
 * text into a field.
 */
export default function CommentItem({
  comment,
  context,
  parent,
}: CommentItemProps) {
  const messages = useMessages().ui;
  const headerId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const replyButtonRef = useRef<HTMLButtonElement>(null);
  // Where the focus goes once the field closes
  const focusAfterEdit = useRef(false);

  const isReply = parent !== undefined;
  const thread = parent ?? comment;
  const replies = isReply ? [] : (comment.replies ?? []);
  const isReplyOpen = !isReply && context.replyingTo === comment.id;
  const editable = !!context.onEdit && context.canEdit(comment);
  const deletable = context.canDelete(comment);

  // Into the field, at the end of the text - and back to the button after
  useEffect(() => {
    if (editing) {
      const field = fieldRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    } else if (focusAfterEdit.current) {
      focusAfterEdit.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(comment.body);
    setEditError(null);
    setEditing(true);
  };

  const stopEditing = () => {
    focusAfterEdit.current = true;
    setEditing(false);
  };

  // An emptied comment is not saved - deleting it is another action
  const isEmpty =
    mentionsToText(draft, { triggers: context.triggers }).trim() === "";

  const save = () => {
    const onEdit = context.onEdit;
    if (saving || isEmpty || !onEdit) return;
    if (draft === comment.body) {
      stopEditing();
      return;
    }

    setSaving(true);
    setEditError(null);
    new Promise<void>((resolve) => resolve(onEdit(comment, draft)))
      .then(() => {
        setSaving(false);
        stopEditing();
      })
      .catch((error) => {
        setSaving(false);
        setEditError(getErrorMessage(error, messages.commentThread.editError));
      });
  };

  const openReply = () => context.setReplyingTo(thread.id);

  const closeReply = () => {
    context.setReplyingTo(null);
    replyButtonRef.current?.focus();
  };

  const attachments = context.renderAttachments?.(comment);

  return (
    <article
      aria-labelledby={headerId}
      className="flex gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-hidden"
      data-comment-id={String(comment.id)}
      tabIndex={-1}
    >
      <Avatar
        alt=""
        className="shrink-0"
        color="auto"
        name={comment.author.name}
        size={isReply ? "sm" : "md"}
        src={comment.author.avatarUrl}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <header
          className="flex flex-wrap items-baseline gap-x-2 text-sm"
          id={headerId}
        >
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {comment.author.name}
          </span>
          <Moment context={context} value={comment.createdAt} />
          {comment.editedAt !== undefined && (
            <Tooltip
              openOnClick
              title={formatMessage(messages.commentThread.editedAt, {
                time: context.formatAbsolute(toDate(comment.editedAt)),
              })}
            >
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                ({messages.commentThread.edited})
              </span>
            </Tooltip>
          )}
        </header>

        {editing ? (
          <div className="flex flex-col gap-2">
            <MentionInput
              aria-label={messages.commentThread.editLabel}
              autosize
              error={editError ?? undefined}
              loadSuggestions={context.loadSuggestions}
              maxLength={context.maxLength}
              maxRows={12}
              minRows={2}
              onChange={setDraft}
              onKeyDown={(event) => {
                if (isSubmitKey(event)) {
                  event.preventDefault();
                  save();
                } else if (
                  event.key === "Escape" &&
                  !saving &&
                  // The open list of suggestions takes its Escape itself
                  !event.currentTarget.hasAttribute("aria-controls")
                ) {
                  event.preventDefault();
                  stopEditing();
                }
              }}
              readOnly={saving}
              ref={fieldRef}
              suggestions={context.suggestions}
              triggers={context.triggers}
              value={draft}
            />
            <div className="flex gap-2">
              <Button
                disabled={isEmpty}
                loading={saving}
                onClick={save}
                size="sm"
              >
                {messages.commentThread.save}
              </Button>
              <Button
                disabled={saving}
                onClick={stopEditing}
                size="sm"
                variant="outline"
              >
                {messages.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <MentionText
            className="text-sm text-neutral-800 dark:text-neutral-200"
            getMentionHref={context.getMentionHref}
            triggers={context.triggers}
            value={comment.body}
          />
        )}

        {attachments !== undefined && attachments !== null && (
          <div className="mt-1">{attachments}</div>
        )}

        {!editing && (context.canReply || editable || deletable) && (
          <div className="-ms-1.5 flex flex-wrap gap-1">
            {context.canReply && (
              <button
                aria-describedby={headerId}
                className={actionClassName}
                onClick={openReply}
                ref={isReply ? undefined : replyButtonRef}
                type="button"
              >
                {messages.commentThread.reply}
              </button>
            )}
            {editable && (
              <button
                aria-describedby={headerId}
                className={actionClassName}
                onClick={startEditing}
                ref={editButtonRef}
                type="button"
              >
                {messages.commentThread.edit}
              </button>
            )}
            {deletable && (
              <button
                aria-describedby={headerId}
                className={cn(
                  actionClassName,
                  "hover:text-danger-700 dark:hover:text-danger-400",
                )}
                onClick={() => context.onDelete(comment)}
                type="button"
              >
                {messages.commentThread.delete}
              </button>
            )}
          </div>
        )}

        {replies.length > 0 && (
          <ol
            aria-label={formatMessage(messages.commentThread.replies, {
              author: comment.author.name,
            })}
            className="mt-2 flex flex-col gap-3 border-s-2 border-neutral-200 ps-3 dark:border-neutral-700"
          >
            {replies.map((reply) => (
              <li key={reply.id}>
                <CommentItem
                  comment={reply}
                  context={context}
                  parent={comment}
                />
              </li>
            ))}
          </ol>
        )}

        {isReplyOpen && (
          <div className="mt-2">
            <Composer
              author={context.currentUser}
              autoFocus
              label={formatMessage(messages.commentThread.replyLabel, {
                author: comment.author.name,
              })}
              loadSuggestions={context.loadSuggestions}
              maxLength={context.maxLength}
              onCancel={closeReply}
              onSubmit={(body) =>
                new Promise<void>((resolve) =>
                  resolve(context.onReply(comment, body)),
                ).then(closeReply)
              }
              placeholder={messages.commentThread.replyPlaceholder}
              suggestions={context.suggestions}
              triggers={context.triggers}
            />
          </div>
        )}
      </div>
    </article>
  );
}
