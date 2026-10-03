import { foldSearchText } from "./remove-diacritics";

/** Ranges of non-overlapping matches, ignoring case and diacritics, as `[start, end)` indexes into the original text. */
export function findMatches(text: string, term: string): [number, number][] {
  const needle = foldSearchText(term);
  if (!needle) return [];

  const folded = foldSearchText(text);
  let position = folded.indexOf(needle);
  if (position === -1) return [];

  // Map only when individual characters change length. Expansions and
  // removed accents can cancel out, leaving the total length unchanged.
  let origin: number[] | null = null;
  for (let index = 0; index < text.length; index++) {
    const length = foldSearchText(text[index]).length;
    if (!origin && length !== 1) {
      origin = Array.from({ length: index }, (_, offset) => offset);
    }
    if (origin) {
      for (let offset = 0; offset < length; offset++) origin.push(index);
    }
  }

  const matches: [number, number][] = [];
  while (position !== -1) {
    const last = position + needle.length - 1;
    const start = origin ? origin[position] : position;
    let end = origin ? origin[last] + 1 : last + 1;
    // A decomposed accent belongs to its highlighted letter.
    while (end < text.length && foldSearchText(text[end]).length === 0) end++;
    matches.push([start, end]);
    position = folded.indexOf(needle, position + needle.length);
  }

  return matches;
}
