import { useLayoutEffect, useRef, useState } from "react";
import useFormatDate from "../../../hooks/use-format-date";
import useFormatRelativeTime from "../../../hooks/use-format-relative-time";
import { formatMessage, formatPlural } from "../../../i18n/ui/format";
import { useLocale } from "../../../providers/ui-context";
import cn from "../../../utils/cn";
import logger from "../../../utils/logger";
import Button from "../button";
import ConfirmDialog from "../confirm-dialog";
import type { MentionInputProps } from "../mention-input";
import type { Mention } from "../mention-input/markup";
import Skeleton from "../skeleton";
import CommentItem, { type ThreadContext } from "./comment-item";
import Composer from "./composer";
import { getErrorMessage } from "./utils";
import type { CommentAuthor, CommentThreadItem } from "./types";

export type { CommentAuthor, CommentThreadItem } from "./types";

/** The second argument of `onSubmit`. */
export interface CommentSubmitContext<TId = string | number> {
  /** The comment replied to - `undefined` for a new comment. */
  parentId?: TId;
}

export interface CommentThreadProps<
  T extends CommentThreadItem = CommentThreadItem,
> extends Omit<React.ComponentProps<"section">, "children" | "onSubmit"> {
  /**
   * Lets the user reply to a comment - one level: replies are listed under
   * their comment, and "Reply" on a reply answers its comment. With
   * `onSubmit`.
   */
  allowReplies?: boolean;
  /**
   * Whether a comment can be deleted - with `onDelete`. By default the
   * comments of `currentUser`.
   */
  canDelete?: (comment: T) => boolean;
  /**
   * Whether a comment can be edited - with `onEdit`. By default the
   * comments of `currentUser`.
   */
  canEdit?: (comment: T) => boolean;
  /**
   * The comments, oldest first - the newest is the last one, next to the
   * field of a new comment. Comments added at the end are announced to
   * screen readers.
   */
  comments: readonly T[];
  /**
   * The user writing - their avatar is beside the field, and their own
   * comments can be edited and deleted (see `canEdit`, `canDelete`).
   */
  currentUser?: CommentAuthor;
  /** Shown instead of the comments while there are none. */
  emptyMessage?: React.ReactNode;
  /**
   * The page of a mentioned person or record - a mention in a comment is a
   * link to it, through the router of `UIProvider`.
   */
  getMentionHref?: (mention: Mention) => string | undefined;
  /**
   * There are older comments to load - "Load older comments" shows above
   * the first one, with `onLoadMore`.
   */
  hasMore?: boolean;
  /** Shows placeholder comments, e.g. while the first ones load. */
  loading?: boolean;
  /** Loads the people (records) to mention - see `MentionInput`. */
  loadSuggestions?: MentionInputProps["loadSuggestions"];
  /** The most characters of a comment - see `MentionInput`. */
  maxLength?: number;
  /**
   * Deletes a comment once the user confirms it in a dialog. While a
   * returned promise is pending the dialog shows a spinner; a rejection
   * keeps it open with the error. Remove the comment from `comments`
   * yourself.
   */
  onDelete?: (comment: T) => Promise<void> | void;
  /**
   * Saves an edited comment - the new `body` with mention tokens. While a
   * returned promise is pending the field is read-only; a rejection keeps it
   * open with the error. Update `comments` yourself.
   */
  onEdit?: (comment: T, body: string) => Promise<void> | void;
  /** Loads older comments - "Load older comments" shows with `hasMore`. */
  onLoadMore?: () => Promise<void> | void;
  /**
   * Sends a new comment - or a reply, with the `parentId` of its comment.
   * While a returned promise is pending the text stays, read-only; it
   * empties once it resolves, and stays with the error when it rejects. Add
   * the comment to `comments` yourself. Without it there is no field.
   */
  onSubmit?: (
    body: string,
    context: CommentSubmitContext<T["id"]>,
  ) => Promise<void> | void;
  /** Placeholder of the field of a new comment. */
  placeholder?: string;
  /**
   * Content under the text of a comment - its attachments, reactions. Your
   * comment type can carry what it needs.
   */
  renderAttachments?: (comment: T) => React.ReactNode;
  /** The people (records) to mention - see `MentionInput`. */
  suggestions?: MentionInputProps["suggestions"];
  /**
   * The time zone the times are written in, e.g. `"Europe/Prague"` - the
   * browser's by default.
   */
  timeZone?: string;
  /** The characters that start a mention - see `MentionInput`. */
  triggers?: MentionInputProps["triggers"];
}

/** Every comment and reply of a thread, in order. */
const flatten = (comments: readonly CommentThreadItem[]) =>
  comments.flatMap((comment) => [comment, ...(comment.replies ?? [])]);

const PLACEHOLDER_COMMENTS = ["w-3/4", "w-1/2", "w-2/3"];

/**
 * A discussion of a record - comments with their author, a time relative to
 * now and mentions as chips, a field with mentions to write a new one
 * (Ctrl / ⌘ + Enter sends it), and with `allowReplies` one level of
 * replies. The own comments can be edited inline and deleted after a
 * confirmation; "Load older comments" pages back. The actions may be
 * asynchronous - they show their progress, and a failure keeps the text.
 * New comments at the end are announced to screen readers.
 */
export default function CommentThread<
  T extends CommentThreadItem = CommentThreadItem,
>({
  allowReplies = false,
  canDelete,
  canEdit,
  className,
  comments,
  currentUser,
  emptyMessage,
  getMentionHref,
  hasMore = false,
  loading = false,
  loadSuggestions,
  maxLength,
  onDelete,
  onEdit,
  onLoadMore,
  onSubmit,
  placeholder,
  renderAttachments,
  suggestions,
  timeZone,
  triggers,
  ...props
}: CommentThreadProps<T>) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const formatRelative = useFormatRelativeTime(timeZone);
  const formatDate = useFormatDate();

  const [replyingTo, setReplyingTo] = useState<string | number | null>(null);
  const [deleting, setDeleting] = useState<{
    comment: T;
    error: string | null;
    pending: boolean;
  } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadOlderFailed, setLoadOlderFailed] = useState(false);
  // What the live region says - the count tells a repeated text apart
  const [announcement, setAnnouncement] = useState({ count: 0, text: "" });

  const listRef = useRef<HTMLOListElement>(null);
  // "Load older" had the focus when it was pressed - it may go away
  const loadOlderFocused = useRef(false);

  const announce = (text: string) =>
    setAnnouncement((previous) => ({ count: previous.count + 1, text }));

  // The comments added since the last render - those at the end, from
  // others, are announced; those loaded above (older ones) or filling an
  // empty thread are not
  const all = flatten(comments);
  const idsKey = all.map((comment) => String(comment.id)).join("\u0000");
  const [seen, setSeen] = useState(() => ({
    ids: new Set(all.map((comment) => comment.id)),
    key: idsKey,
  }));
  if (seen.key !== idsKey) {
    let lastKnown = -1;
    comments.forEach((comment, index) => {
      if (seen.ids.has(comment.id)) lastKnown = index;
    });
    const added = comments.flatMap((comment, index) => {
      const isKnown = seen.ids.has(comment.id);
      const isNew = !isKnown && lastKnown >= 0 && index > lastKnown;
      // The replies of an older comment loaded above are old too
      const replies =
        isKnown || isNew
          ? (comment.replies ?? []).filter((reply) => !seen.ids.has(reply.id))
          : [];
      return isNew ? [comment, ...replies] : replies;
    });
    const others = added.filter(
      (comment) =>
        currentUser === undefined || comment.author.id !== currentUser.id,
    );

    setSeen({ ids: new Set(all.map((comment) => comment.id)), key: idsKey });
    if (seen.ids.size > 0 && others.length > 0) {
      announce(
        others.length === 1
          ? formatMessage(messages.commentThread.newComment, {
              author: others[0].author.name,
            })
          : formatPlural(
              locale.code,
              messages.commentThread.newComments,
              others.length,
            ),
      );
    }
  }

  const isOwn = (comment: CommentThreadItem) =>
    currentUser !== undefined && comment.author.id === currentUser.id;

  const showsLoadOlder = hasMore && !!onLoadMore && !loading;

  // The button went away with the last older comments - the focus goes to
  // the first comment instead of the page
  useLayoutEffect(() => {
    if (!loadOlderFocused.current || loadingOlder) return;
    // Loaded - the button stays, or went away with the focus on it
    loadOlderFocused.current = false;
    const active = document.activeElement;
    if (!showsLoadOlder && (!active || active === document.body)) {
      listRef.current?.querySelector<HTMLElement>("article")?.focus();
    }
  });

  const loadOlder = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!onLoadMore || loadingOlder) return;
    loadOlderFocused.current = event.currentTarget === document.activeElement;
    setLoadingOlder(true);
    setLoadOlderFailed(false);

    new Promise<void>((resolve) => resolve(onLoadMore()))
      .then(() => setLoadingOlder(false))
      .catch((error) => {
        logger.error("Failed to load older comments", error);
        loadOlderFocused.current = false;
        setLoadingOlder(false);
        setLoadOlderFailed(true);
      });
  };

  const confirmDelete = () => {
    if (!deleting || deleting.pending || !onDelete) return;
    const { comment } = deleting;
    setDeleting({ comment, error: null, pending: true });

    new Promise<void>((resolve) => resolve(onDelete(comment)))
      .then(() => {
        setDeleting(null);
        announce(messages.commentThread.deleted);
      })
      .catch((error) => {
        setDeleting({
          comment,
          error: getErrorMessage(error, messages.commentThread.deleteError),
          pending: false,
        });
      });
  };

  const context: ThreadContext = {
    canDelete: (comment) =>
      !!onDelete && (canDelete ? canDelete(comment as T) : isOwn(comment)),
    canEdit: (comment) =>
      !!onEdit && (canEdit ? canEdit(comment as T) : isOwn(comment)),
    canReply: allowReplies && !!onSubmit,
    currentUser,
    formatAbsolute: (value) =>
      formatDate(value instanceof Date ? value : new Date(value), "dateTime", {
        timeZone,
      }),
    formatRelative,
    getMentionHref,
    loadSuggestions,
    maxLength,
    onDelete: (comment) =>
      setDeleting({ comment: comment as T, error: null, pending: false }),
    onEdit: onEdit ? (comment, body) => onEdit(comment as T, body) : undefined,
    onReply: (parent, body) =>
      onSubmit?.(body, { parentId: parent.id as T["id"] }),
    renderAttachments: renderAttachments
      ? (comment) => renderAttachments(comment as T)
      : undefined,
    replyingTo,
    setReplyingTo,
    suggestions,
    triggers,
  };

  return (
    <section
      {...props}
      aria-busy={loading || undefined}
      className={cn("flex flex-col gap-4", className)}
    >
      {showsLoadOlder && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            loading={loadingOlder}
            onClick={loadOlder}
            size="sm"
            variant="ghost"
          >
            {messages.commentThread.loadOlder}
          </Button>
          {loadOlderFailed && (
            <p
              className="text-sm text-danger-700 dark:text-danger-400"
              role="alert"
            >
              {messages.commentThread.loadOlderError}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          <span className="sr-only">{messages.common.loading}</span>
          {PLACEHOLDER_COMMENTS.map((width) => (
            <div aria-hidden="true" className="flex gap-3" key={width}>
              <Skeleton height="h-8" variant="circle" width="w-8" />
              <div className="flex flex-1 flex-col gap-2 pt-1">
                <Skeleton className="w-40" height="h-3" />
                <Skeleton className={width} height="h-3" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {emptyMessage ?? messages.commentThread.empty}
        </p>
      ) : (
        <ol
          aria-label={messages.commentThread.comments}
          className="flex flex-col gap-5"
          ref={listRef}
        >
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem comment={comment} context={context} />
            </li>
          ))}
        </ol>
      )}

      {/* New comments, and a deleted one, told */}
      <div className="sr-only" role="status">
        {announcement.text + (announcement.count % 2 === 1 ? " " : "")}
      </div>

      {onSubmit && (
        <Composer
          author={currentUser}
          label={messages.commentThread.composerLabel}
          loadSuggestions={loadSuggestions}
          maxLength={maxLength}
          onSubmit={(body) => onSubmit(body, {})}
          placeholder={
            placeholder ?? messages.commentThread.composerPlaceholder
          }
          suggestions={suggestions}
          triggers={triggers}
        />
      )}

      {onDelete && (
        <ConfirmDialog
          confirmColor="danger"
          confirmLabel={messages.commentThread.delete}
          loading={deleting?.pending ?? false}
          message={messages.commentThread.deleteMessage}
          onClose={() => {
            if (!deleting?.pending) setDeleting(null);
          }}
          onConfirm={confirmDelete}
          open={deleting !== null}
          title={messages.commentThread.deleteTitle}
        >
          {deleting?.error && (
            <p
              className="text-sm text-danger-700 dark:text-danger-400"
              role="alert"
            >
              {deleting.error}
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
