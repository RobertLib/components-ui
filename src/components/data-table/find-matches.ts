import { foldSearchText } from "../../utils/remove-diacritics";

/**
 * Finds the ranges of `text` matching `term`, ignoring case and diacritics -
 * "cilovy" matches "Cílový". Returns `[start, end)` indexes into `text`.
 */
export function findMatches(text: string, term: string): [number, number][] {
  const needle = foldSearchText(term);

  if (!needle) return [];

  // Fold the text character by character, remembering where each folded
  // character came from - folding can change the length of the string
  let folded = "";
  const origin: number[] = [];

  for (let index = 0; index < text.length; index++) {
    const char = foldSearchText(text[index]);
    for (let offset = 0; offset < char.length; offset++) {
      folded += char[offset];
      origin.push(index);
    }
  }

  const matches: [number, number][] = [];
  let position = folded.indexOf(needle);

  while (position !== -1) {
    const start = origin[position];
    const end = origin[position + needle.length - 1] + 1;
    matches.push([start, end]);
    position = folded.indexOf(needle, position + needle.length);
  }

  return matches;
}
