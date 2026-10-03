import { findMatches } from "./find-matches";

interface HighlightedTextProps {
  /** What to highlight - case and diacritics do not matter. */
  term?: string;
  /** The text to show. */
  text: string;
}

/** `text` with the matches of `term` in bold - rendered as React nodes, never as HTML. */
export default function HighlightedText({ term, text }: HighlightedTextProps) {
  const matches = term ? findMatches(text, term) : [];

  if (matches.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<b key={index}>{text.slice(start, end)}</b>);
    cursor = end;
  });

  if (cursor < text.length) parts.push(text.slice(cursor));

  return <>{parts}</>;
}
