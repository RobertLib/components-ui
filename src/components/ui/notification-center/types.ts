import type { ButtonProps } from "../button";

/** Tells the notifications of a `NotificationCenter` apart. */
export type NotificationId = string | number;

/** What the list of a `NotificationCenter` shows - all, or the unread only. */
export type NotificationFilter = "all" | "unread";

/** A button under the text of a notification, e.g. "Approve". */
export interface NotificationAction {
  /**
   * Color of the button.
   * @default "default"
   */
  color?: ButtonProps["color"];
  /** An icon before the label, e.g. `<Check size={14} />`. */
  icon?: React.ReactNode;
  /** Text of the button. */
  label: string;
  /** Called when the button is clicked - the panel stays open. */
  onClick: () => void;
}

/** A notification of `NotificationCenter`. */
export interface NotificationItem {
  /** Buttons under the text - actions on the notification itself. */
  actions?: NotificationAction[];
  /**
   * The person the notification comes from - their avatar (or initials) in
   * place of the `icon`.
   */
  avatar?: { name: string; src?: string };
  /** The text under the title - three lines at most are shown. */
  body?: React.ReactNode;
  /**
   * Opens the page of the notification - through the router `Link` of
   * `UIProvider`. The title is the link, stretched over the whole row.
   */
  href?: string;
  /** An icon at the start, e.g. `<FileCheck />` - sized to 16px. */
  icon?: React.ReactNode;
  /** Unique among the notifications. */
  id: NotificationId;
  /**
   * Called when the notification is opened - a click on it, Enter on its
   * title. Without `href`, the title is a button then.
   */
  onClick?: () => void;
  /** Read already - an unread notification is marked and counted. */
  read?: boolean;
  /**
   * When it happened - written relative to now ("5 minutes ago"), with the
   * date and time on hover.
   */
  time: Date | string | number;
  /** What happened, e.g. "Invoice FV-2026-0418 was approved". */
  title: React.ReactNode;
}
