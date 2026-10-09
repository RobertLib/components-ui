import {
  useCallback,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useRouterScope } from "../providers/ui-context";
import {
  documentHash,
  getPendingSearches,
  getRouterSearches,
  MAX_PENDING_SEARCHES,
  observeSearch,
} from "../utils/pending-searches";

export interface UseUrlStateOptions<T extends Record<string, string>> {
  /**
   * Prefix of the parameters in the URL - `orders.` for `?orders.page=2` -
   * for two lists on one page.
   */
  prefix?: string;
  /**
   * Replace the history entry on changes instead of adding one - an update
   * may say otherwise (`update({ q }, { replace: true })` for the letters
   * typed into a search, while a filter picked adds an entry the back
   * button returns from).
   */
  replace?: boolean;
  /**
   * Keys set back to their default when another key changes - `["page"]`:
   * a list starts at its first page again once its search or a filter
   * changes. A change of the key itself keeps it.
   */
  resetOnChange?: readonly (keyof T & string)[];
}

export interface UrlStateUpdateOptions {
  /** Replace the history entry instead of adding one - see `replace`. */
  replace?: boolean;
}

/** Changes some of the values of `useUrlState` - the others stay. */
export type SetUrlState<T extends Record<string, string>> = (
  changes: Partial<T>,
  options?: UrlStateUpdateOptions,
) => void;

/** The values of `defaults` as the search of a URL has them. */
function readState<T extends Record<string, string>>(
  search: string,
  defaults: T,
  prefix: string,
): T {
  const params = new URLSearchParams(search);
  const state: Record<string, string> = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    state[key] = params.get(prefix + key) ?? fallback;
  }
  return state as T;
}

const isSameState = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((key) => a[key] === b[key]);

/**
 * State kept in the query of the URL - the search, the filters, the sorting
 * and the page of a list, the tab of a page - so that it survives a reload,
 * can be shared and follows the back button: a detail opened from the list
 * returns to it as it was left. Works through the router of `UIProvider`.
 *
 * The values are strings, each with its default in `defaults` (also its
 * type): a value equal to its default is left out of the URL, and the other
 * parameters of the URL stay as they are. Changes made one after another
 * before the router shows them build on each other - also those of the
 * `DataTable`s of the page.
 *
 * ```tsx
 * const [state, update] = useUrlState(
 *   { q: "", status: "active", page: "1" },
 *   { resetOnChange: ["page"] },
 * );
 * const page = Number(state.page) || 1;
 * <Select onChange={(event) => update({ status: event.target.value })} … />
 * ```
 *
 * For a text field, `useDebouncedField(state.q, (q) => update({ q }, {
 * replace: true }))` writes into the URL once the typing pauses.
 */
export default function useUrlState<T extends Record<string, string>>(
  defaults: T,
  { prefix = "", replace = false, resetOnChange }: UseUrlStateOptions<T> = {},
): [T, SetUrlState<T>] {
  const router = useRouter();
  const routerScope = useRouterScope();
  const { pathname, search: routerSearch } = router;

  // Compared by value, so inline `defaults` and `resetOnChange` are fine
  const defaultsKey = JSON.stringify(defaults);
  const stableDefaults = useMemo(
    () => JSON.parse(defaultsKey) as T,
    [defaultsKey],
  );
  const resetKey = (resetOnChange ?? []).join("\u0000");
  const stableResets = useMemo(
    () => (resetKey ? resetKey.split("\u0000") : []),
    [resetKey],
  );

  // The same object while the values are the same - an effect depending on
  // the state must not run again when another parameter of the URL changes
  const parsed = useMemo(
    () => readState(routerSearch, stableDefaults, prefix),
    [prefix, routerSearch, stableDefaults],
  );
  const [state, setState] = useState(parsed);
  if (state !== parsed && !isSameState(state, parsed)) setState(parsed);
  const shown = isSameState(state, parsed) ? state : parsed;

  // Read by `update`, which may run several times before a re-render - and
  // before a router that updates `search` asynchronously catches up
  const latestRouter = useRef({ router, scope: routerScope });

  // Activity keeps the hook alive: an update called while it is hidden
  // must see the router of the last commit
  useInsertionEffect(() => {
    latestRouter.current = { router, scope: routerScope };
  });

  // The page's entry of pending changes lives while a hook of the page uses
  // it - a new page starts without the old ones
  useInsertionEffect(() => {
    const { search } = latestRouter.current.router;
    const entry = getPendingSearches(routerScope, pathname, search);
    if (entry.users === 0) {
      entry.pending = [];
      entry.seen = search;
    }
    entry.users += 1;

    return () => {
      entry.users -= 1;
      if (entry.users === 0) getRouterSearches(routerScope).delete(pathname);
    };
  }, [pathname, routerScope]);

  useInsertionEffect(() => {
    observeSearch(
      getPendingSearches(routerScope, pathname, routerSearch),
      routerSearch,
    );
  });

  const update = useCallback<SetUrlState<T>>(
    (changes, options) => {
      const { router: currentRouter, scope } = latestRouter.current;
      const entry = getPendingSearches(
        scope,
        currentRouter.pathname,
        currentRouter.search,
      );
      observeSearch(entry, currentRouter.search);

      // The latest search - with the changes the router does not show yet
      const currentSearch = entry.pending.at(-1) ?? currentRouter.search;
      const current = readState(currentSearch, stableDefaults, prefix);
      const next: Record<string, string> = { ...current };

      for (const [key, value] of Object.entries(changes)) {
        if (!(key in stableDefaults)) continue;
        next[key] = value ?? stableDefaults[key];
      }

      const changed = Object.keys(next).filter(
        (key) => next[key] !== current[key],
      );
      if (changed.length === 0) return;

      // Another value changed - the keys of `resetOnChange` start over,
      // unless they were changed too
      if (changed.some((key) => !stableResets.includes(key))) {
        for (const key of stableResets) {
          if (!(key in changes)) next[key] = stableDefaults[key];
        }
      }

      const params = new URLSearchParams(currentSearch);
      for (const key of Object.keys(stableDefaults)) {
        if (next[key] === stableDefaults[key]) {
          params.delete(prefix + key);
        } else {
          params.set(prefix + key, next[key]);
        }
      }

      const query = params.toString();
      const search = query ? `?${query}` : "";

      // Also a change back to what the router shows waits for its turn
      entry.pending = [...entry.pending, search].slice(-MAX_PENDING_SEARCHES);

      currentRouter.navigate(
        `${currentRouter.pathname}${search}${documentHash(currentRouter.pathname)}`,
        { replace: options?.replace ?? replace },
      );
    },
    [prefix, replace, stableDefaults, stableResets],
  );

  return [shown, update];
}
