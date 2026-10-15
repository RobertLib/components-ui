import { Fragment } from "react";
import { isSafeHref } from "../../../utils/sanitize-rich-text";
import Link from "../link";
import {
  parseValue,
  triggerChars,
  type Mention,
  type MentionOptions,
} from "./markup";

/** How `renderMentions` and `MentionText` show the mentions of a value. */
export interface RenderMentionsOptions extends MentionOptions {
  /**
   * The page of a mentioned person or record - the mention is a link to it
   * then, through the router of `UIProvider`. `undefined` leaves it a chip.
   * A link that is not safe to follow (`javascript:`) is left out: the id
   * comes from the value, which the user wrote.
   */
  getMentionHref?: (mention: Mention) => string | undefined;
  /**
   * Renders a mention yourself - e.g. with a tooltip or a hover card.
   * Without it a mention is a chip with its trigger and label.
   */
  renderMention?: (mention: Mention, index: number) => React.ReactNode;
}

// The chip of a mention - inline, also when it wraps onto another line.
// Forced colors drop its background - a border keeps it apart.
const chipClassName =
  "rounded bg-primary-50 px-1 font-medium text-primary-800 [box-decoration-break:clone] dark:bg-primary-950 dark:text-primary-200 forced-colors:border forced-colors:border-[CanvasText]";

/**
 * A stored value of `MentionInput` as React nodes - its text, and its
 * mentions as chips or links - e.g. for a table cell or an element of your
 * own; `MentionText` is the component. Text is never read as HTML.
 */
export function renderMentions(
  value: string,
  { getMentionHref, renderMention, triggers }: RenderMentionsOptions = {},
): React.ReactNode[] {
  const { mentions, text } = parseValue(value, triggerChars(triggers));
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  mentions.forEach((range, index) => {
    if (range.start > cursor) nodes.push(text.slice(cursor, range.start));
    cursor = range.end;

    const mention: Mention = {
      id: range.id,
      label: range.label,
      trigger: range.trigger,
    };
    if (renderMention) {
      nodes.push(
        <Fragment key={`mention-${index}`}>
          {renderMention(mention, index)}
        </Fragment>,
      );
      return;
    }

    const href = getMentionHref?.(mention);
    const content = mention.trigger + mention.label;
    nodes.push(
      href && isSafeHref(href) ? (
        <Link
          className={chipClassName}
          data-mention=""
          href={href}
          key={`mention-${index}`}
          underline="hover"
        >
          {content}
        </Link>
      ) : (
        <span
          className={chipClassName}
          data-mention=""
          key={`mention-${index}`}
        >
          {content}
        </span>
      ),
    );
  });

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
