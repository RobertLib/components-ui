/** Who wrote a comment - or who writes one (`currentUser`). */
export interface CommentAuthor {
  /** URL of a profile picture - the initials of the name show without it. */
  avatarUrl?: string;
  /**
   * Compared with the `id` of `currentUser`: by default the own comments
   * can be edited and deleted.
   */
  id: string | number;
  /** Shown above the comment, and as the initials of the avatar. */
  name: string;
}

/** A comment of `CommentThread` - with more fields of your own if you need. */
export interface CommentThreadItem {
  author: CommentAuthor;
  /**
   * The text - with mention tokens as `MentionInput` writes them, shown
   * with the mentions as chips.
   */
  body: string;
  /**
   * When it was written - a `Date`, an ISO string or a timestamp. Shown
   * relative to now ("před 5 minutami"), the date and time in a tooltip.
   */
  createdAt: Date | string | number;
  /**
   * When it was last edited - the comment says "edited" then. `null`, or a
   * time that is no valid date, is no edit.
   */
  editedAt?: Date | string | number | null;
  /** Unique among the comments and the replies. */
  id: string | number;
  /**
   * The replies, oldest first - of the same type as the comment. One level:
   * a reply has no replies of its own.
   */
  replies?: readonly CommentThreadItem[];
}
