import {
  useCallback,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createDataTableQuery,
  DEFAULT_PAGE_SIZE_OPTIONS,
  isSameQuery,
  readQueryFromSearch,
  writeQueryToSearch,
  type DataTableQuery,
} from "./query";
import logger from "../../../utils/logger";
import {
  documentHash,
  getPendingSearches,
  getRouterSearches,
  MAX_PENDING_SEARCHES,
  observeSearch,
} from "../../../utils/pending-searches";
import { useRouter, useRouterScope } from "../../../providers/ui-context";

export interface UseDataTableQueryOptions {
  /** Initial (and URL default) values, e.g. `{ pageSize: 50, sortBy: "name" }`. */
  defaults?: Partial<DataTableQuery>;
  /**
   * `syncWithUrl`: page sizes the URL may ask for - pass the
   * `pageSizeOptions` of the table (default `DEFAULT_PAGE_SIZE_OPTIONS`).
   * Another size falls back to the default one, with a warning in
   * development.
   */
  pageSizeOptions?: number[];
  /** Replace the history entry on changes instead of adding one. */
  replace?: boolean;
  /**
   * Keep the query in the URL (`?page=2&sortBy=name&…`), so it survives a
   * reload, can be shared and follows the back button. Uses the router
   * configured in `UIProvider`.
   */
  syncWithUrl?: boolean;
  /** Prefix of the URL parameters, for several tables on one page. */
  urlPrefix?: string;
}

export type SetDataTableQuery = (
  next: DataTableQuery | ((previous: DataTableQuery) => DataTableQuery),
) => void;

// The page sizes `setQuery` warned about - once each
const warnedPageSizes = new Set<number>();

/**
 * `query`, as the same object while it asks for the same rows - an app
 * fetching in `useEffect(…, [query])` must not fetch again when only other
 * parameters of the URL change (another table's, the app's).
 */
function useSameQuery(query: DataTableQuery | null) {
  const [previous, setPrevious] = useState(query);
  const isSame =
    previous === query ||
    (previous !== null && query !== null && isSameQuery(previous, query));

  if (!isSame) setPrevious(query);

  return isSame ? previous : query;
}

/**
 * State for a controlled `DataTable` - in React state, or in the URL with
 * `syncWithUrl`:
 *
 * ```tsx
 * const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });
 * // …fetch the rows for `query`…
 * <DataTable query={query} onQueryChange={setQuery} … />
 * ```
 */
export default function useDataTableQuery({
  defaults,
  pageSizeOptions,
  replace = false,
  syncWithUrl = false,
  urlPrefix = "",
}: UseDataTableQueryOptions = {}): [DataTableQuery, SetDataTableQuery] {
  const router = useRouter();
  const routerScope = useRouterScope();
  const { pathname, search: routerSearch } = router;

  // Compared by value, so an inline `defaults` object is fine
  const defaultsKey = JSON.stringify(defaults ?? {});
  const stableDefaults = useMemo(
    () => JSON.parse(defaultsKey) as Partial<DataTableQuery>,
    [defaultsKey],
  );
  const pageSizesKey = pageSizeOptions?.join(",");
  const stablePageSizes = useMemo(
    () => pageSizesKey?.split(",").map(Number),
    [pageSizesKey],
  );

  const [localQuery, setLocalQuery] = useState(() =>
    createDataTableQuery(stableDefaults),
  );

  const parsedUrlQuery = useMemo(
    () =>
      syncWithUrl
        ? readQueryFromSearch(routerSearch, {
            defaults: stableDefaults,
            pageSizeOptions: stablePageSizes,
            prefix: urlPrefix,
          })
        : null,
    [routerSearch, stablePageSizes, stableDefaults, syncWithUrl, urlPrefix],
  );
  const urlQuery = useSameQuery(parsedUrlQuery);

  // Read by `setQuery`, which may run several times before a re-render - and
  // before a router that updates `search` asynchronously catches up
  const latestRouter = useRef({ router, scope: routerScope });

  // Activity keeps the hook alive: pending callbacks must see router
  // updates committed while hidden, before any layout effect can call them.
  useInsertionEffect(() => {
    latestRouter.current = { router, scope: routerScope };
  });

  // The entry of the page lives while a table of the page uses it - a new
  // page (or the next test) starts without the old pending changes. Hiding
  // with Activity must retain pending navigations until a real unmount.
  useInsertionEffect(() => {
    if (!syncWithUrl) return;

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
  }, [pathname, routerScope, syncWithUrl]);

  useInsertionEffect(() => {
    if (syncWithUrl) {
      observeSearch(
        getPendingSearches(routerScope, pathname, routerSearch),
        routerSearch,
      );
    }
  });

  const setQuery = useCallback<SetDataTableQuery>(
    (next) => {
      if (!syncWithUrl) {
        setLocalQuery((previous) => {
          const resolved = typeof next === "function" ? next(previous) : next;
          // An equal query keeps the object - and fetches nothing again
          return isSameQuery(previous, resolved) ? previous : resolved;
        });
        return;
      }

      const { router: currentRouter, scope } = latestRouter.current;
      const entry = getPendingSearches(
        scope,
        currentRouter.pathname,
        currentRouter.search,
      );
      observeSearch(entry, currentRouter.search);

      // The latest search - with the changes the router does not show yet,
      // also those of the other tables of the page
      const currentSearch = entry.pending.at(-1) ?? currentRouter.search;
      const urlOptions = {
        defaults: stableDefaults,
        pageSizeOptions: stablePageSizes,
        prefix: urlPrefix,
      };
      const resolved =
        typeof next === "function"
          ? next(readQueryFromSearch(currentSearch, urlOptions))
          : next;
      const search = writeQueryToSearch(currentSearch, resolved, urlOptions);

      // The URL would read back another page size - the "rows per page" of a
      // table offering more sizes than the hook would snap back silently.
      // Said once per page size.
      if (
        !(stablePageSizes ?? DEFAULT_PAGE_SIZE_OPTIONS).includes(
          resolved.pageSize,
        ) &&
        !warnedPageSizes.has(resolved.pageSize) &&
        readQueryFromSearch(search, urlOptions).pageSize !== resolved.pageSize
      ) {
        warnedPageSizes.add(resolved.pageSize);
        logger.warn(
          `useDataTableQuery: the page size ${resolved.pageSize} is not one of its \`pageSizeOptions\` - the URL cannot keep it. Pass the \`pageSizeOptions\` of the table to the hook too.`,
        );
      }

      if (search === currentSearch) return;

      // Also a change back to what the router shows waits for its turn - the
      // changes before it still arrive first, and a change made meanwhile
      // must build on this one, not on them
      entry.pending = [...entry.pending, search].slice(-MAX_PENDING_SEARCHES);

      currentRouter.navigate(
        `${currentRouter.pathname}${search}${documentHash(currentRouter.pathname)}`,
        { replace },
      );
    },
    [replace, stableDefaults, stablePageSizes, syncWithUrl, urlPrefix],
  );

  return [urlQuery ?? localQuery, setQuery];
}
