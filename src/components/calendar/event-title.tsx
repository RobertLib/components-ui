import { useMemo } from "react";
import { sanitizeInlineHtml } from "../../utils/sanitize-rich-text";
import type { CalendarEvent } from "./types";

interface EventTitleProps {
  /** The title without `htmlTitle`. */
  children: React.ReactNode;
  event: CalendarEvent;
  /** Classes of the element holding the `htmlTitle`. */
  htmlClassName?: string;
}

/**
 * The title of a tile - the `htmlTitle` of the event reduced to inline
 * formatting (so it cannot run scripts), or the plain `children`.
 */
export default function EventTitle({
  children,
  event,
  htmlClassName,
}: EventTitleProps) {
  const html = useMemo(
    () =>
      typeof event.htmlTitle === "string" && event.htmlTitle
        ? sanitizeInlineHtml(event.htmlTitle)
        : null,
    [event.htmlTitle],
  );

  if (html === null) return <>{children}</>;

  return (
    <div className={htmlClassName} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
