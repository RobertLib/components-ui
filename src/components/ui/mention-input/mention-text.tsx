import cn from "../../../utils/cn";
import { renderMentions, type RenderMentionsOptions } from "./render-mentions";

export interface MentionTextProps
  extends
    Omit<React.ComponentProps<"span">, "children">,
    RenderMentionsOptions {
  /** A stored value of `MentionInput` - text with mention tokens. */
  value: string;
}

/**
 * Shows a stored value of `MentionInput` - a comment, a note - with its
 * mentions as chips, or links with `getMentionHref`, and its line breaks.
 * Pass the `triggers` of the field. `ref` and the other props go to the
 * `<span>` around the text.
 */
export default function MentionText({
  className,
  getMentionHref,
  renderMention,
  triggers,
  value,
  ...props
}: MentionTextProps) {
  return (
    <span
      {...props}
      className={cn("wrap-break-word whitespace-pre-wrap", className)}
    >
      {renderMentions(value, { getMentionHref, renderMention, triggers })}
    </span>
  );
}
