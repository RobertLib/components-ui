import { useMemo, useSyncExternalStore } from "react";
import { sanitizeInlineHtml } from "../../utils/sanitize-rich-text";
import type { CalendarEvent } from "./types";

interface EventTitleProps {
  /** The title without `htmlTitle` - and before the page is hydrated. */
  children: React.ReactNode;
  /** Classes of the element holding `children`. */
  className?: string;
  /** The event - its `htmlTitle` replaces `children`. */
  event: CalendarEvent;
  /** Classes of the element holding the `htmlTitle`. */
  htmlClassName?: string;
}

const subscribe = () => () => {};

/** A link of a sanitized title - only a safe `href` is kept. */
const HAS_LINK = /<a\s[^>]*href=/i;

/**
 * The title of a tile - the `htmlTitle` of the event reduced to inline
 * formatting (so it cannot run scripts), or the plain `children`. Screen
 * readers get the title from the name of the tile, so this copy is hidden
 * from them - unless it has links, which must stay reachable.
 */
export default function EventTitle({
  children,
  className,
  event,
  htmlClassName,
}: EventTitleProps) {
  // A server has no DOMParser to sanitize with: it renders the plain title,
  // and so does the render that hydrates its HTML - the `htmlTitle` follows.
  // Rendered in the browser from the start, it shows at once.
  const canSanitize = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const html = useMemo(
    () =>
      canSanitize && typeof event.htmlTitle === "string" && event.htmlTitle
        ? sanitizeInlineHtml(event.htmlTitle)
        : null,
    [canSanitize, event.htmlTitle],
  );

  if (html === null) {
    return (
      <span aria-hidden="true" className={className}>
        {children}
      </span>
    );
  }

  return (
    <span
      aria-hidden={HAS_LINK.test(html) ? undefined : true}
      className={htmlClassName}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
