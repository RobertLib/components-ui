import { foldSearchText as fold } from "../../../utils/remove-diacritics";

/** `[start, end)` indexes of a match in a text. */
export type MatchRange = [start: number, end: number];

/** A text as the search compares it. */
export interface SearchableText {
  /** Without diacritics and in lower case - "Žluťoučký" is "zlutoucky". */
  folded: string;
  /**
   * For every character of `folded`, the index of the character of `text`
   * it comes from - folding may change the length, and the combining marks
   * of a letter fold with it.
   */
  origin: number[];
  text: string;
}

// A character with the combining marks on it - an accent, the voicing mark
// of a kana, the points of Hebrew. Folded together, as the search is: NFD
// sorts the marks of a letter (a shadda typed before a fatha comes after
// it), and a letter past U+FFFF is lowercased whole, not in halves. Marks
// at the start of a text are on no character.
const CHARACTER = /\P{M}\p{M}*|\p{M}+/gu;
const CHARACTER_AT = /\P{M}\p{M}*|\p{M}+/uy;
// A part of a word - a mark too: the voicing mark of a kana stays one when
// folded
const WORD_CHARACTER = /[\p{L}\p{M}\p{N}]/u;

/** Prepares `text` for searching - see `SearchableText`. */
export function toSearchable(text: string): SearchableText {
  let folded = "";
  const origin: number[] = [];

  for (const { 0: char, index } of text.matchAll(CHARACTER)) {
    const foldedChar = fold(char);
    folded += foldedChar;
    for (let offset = 0; offset < foldedChar.length; offset++) {
      origin.push(index);
    }
  }

  return { folded, origin, text };
}

/** Where the character at `index` of `text` ends - after its marks. */
function endOfCharacter(text: string, index: number) {
  CHARACTER_AT.lastIndex = index;
  return CHARACTER_AT.test(text) ? CHARACTER_AT.lastIndex : index + 1;
}

/** The words of a search - folded like `SearchableText`, without empty ones. */
export const toSearchWords = (query: string) =>
  fold(query).split(/\s+/).filter(Boolean);

/** Whether `word` occurs in `folded` at the start of one of its words. */
function startsAWord(folded: string, word: string) {
  let position = folded.indexOf(word);

  while (position !== -1) {
    // The character before - a letter past U+FFFF whole, not its second half
    const before = Array.from(
      folded.slice(Math.max(position - 2, 0), position),
    ).at(-1);
    if (before === undefined || !WORD_CHARACTER.test(before)) {
      return true;
    }
    position = folded.indexOf(word, position + 1);
  }
  return false;
}

// How well a word of the search matches an item - lower is better
const LABEL_START = 0;
const LABEL_WORD_START = 1;
const IN_LABEL = 2;
const ELSEWHERE = 3;

/**
 * How well an item matches the `words` of a search - `null` when one of
 * them is in neither its label nor its `other` texts (the description and
 * the keywords, folded). Lower is better: the label starting with a word
 * comes first, then a word of the label starting with it, then the label
 * containing it, then the other texts.
 */
export function rankMatch(
  label: SearchableText,
  other: string,
  words: string[],
): number | null {
  let rank = 0;

  for (const word of words) {
    const position = label.folded.indexOf(word);

    if (position === 0) rank += LABEL_START;
    else if (position > 0) {
      rank += startsAWord(label.folded, word) ? LABEL_WORD_START : IN_LABEL;
    } else if (other.includes(word)) rank += ELSEWHERE;
    else return null;
  }

  return rank;
}

/**
 * Where the `words` of a search occur in a text, in the indexes of the
 * original text - sorted, overlapping matches merged.
 */
export function findMatchRanges(
  { folded, origin, text }: SearchableText,
  words: string[],
): MatchRange[] {
  const ranges: MatchRange[] = [];

  for (const word of words) {
    let position = folded.indexOf(word);

    while (position !== -1) {
      // The last letter with its marks - an accent, the voicing mark of a
      // kana - and both halves of a letter past U+FFFF
      const end = endOfCharacter(text, origin[position + word.length - 1]);

      ranges.push([origin[position], end]);
      position = folded.indexOf(word, position + word.length);
    }
  }

  ranges.sort((a, b) => a[0] - b[0]);

  return ranges.reduce<MatchRange[]>((merged, range) => {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
    return merged;
  }, []);
}
