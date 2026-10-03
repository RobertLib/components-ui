import { foldSearchText } from "../../../utils/remove-diacritics";

/**
 * The default `filterOptions` of an Autocomplete with static options: those
 * whose label contains the term, ignoring case and diacritics - "cilovy"
 * finds "Cílový". All of them for an empty term. A `filterOptions` of your
 * own can build on it, e.g. to cap the list or to add matches on other
 * fields.
 */
export function defaultFilterOptions<T extends { label: string }>(
  options: T[],
  search: string,
): T[] {
  const term = foldSearchText(search.trim());
  if (!term) return options;
  return options.filter((option) =>
    foldSearchText(option.label).includes(term),
  );
}
