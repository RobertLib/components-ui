import {
  findMatchRanges,
  rankMatch,
  toSearchable,
  toSearchWords,
  type MatchRange,
} from "../command-palette/match";
import type { MentionSuggestion } from "./markup";

/**
 * The suggestions of a static list that match `query` - ignoring case and
 * diacritics, in the label first, then in the description and the
 * keywords; the best matches first, at most `max` of them.
 */
export function filterSuggestions(
  suggestions: readonly MentionSuggestion[],
  query: string,
  max: number,
): MentionSuggestion[] {
  const words = toSearchWords(query);
  if (words.length === 0) return suggestions.slice(0, max);

  return suggestions
    .flatMap((suggestion) => {
      const rank = rankMatch(
        toSearchable(suggestion.label),
        toSearchable(
          [suggestion.description, ...(suggestion.keywords ?? [])].join(" "),
        ).folded,
        words,
      );
      return rank === null ? [] : [{ rank, suggestion }];
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, max)
    .map(({ suggestion }) => suggestion);
}

/** Where the words of `query` are in `label` - to show them in bold. */
export const findLabelMatches = (label: string, query: string): MatchRange[] =>
  findMatchRanges(toSearchable(label), toSearchWords(query));
