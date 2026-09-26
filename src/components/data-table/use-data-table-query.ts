import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDataTableQuery,
  DEFAULT_PAGE_SIZE_OPTIONS,
  isSameQuery,
  readQueryFromSearch,
  writeQueryToSearch,
  type DataTableQuery,
} from "./query";
import logger from "../../utils/logger";
import { useRouter } from "../../providers/ui-context";

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

// An owner that ignores the changes must not make the list grow forever
const MAX_PENDING = 50;

// The page sizes `setQuery` warned about - once each
const warnedPageSizes = new Set<number>();

/** The URL changes of the tables of one page that the router shows late. */
interface PendingSearches {
  /** Searches navigated to that the router has not shown yet, oldest first. */
  pending: string[];
  /** The search the router showed last. */
  seen: string;
  /** Mounted hooks sharing the entry - it goes when the last one does. */
  users: number;
}

// Shared by all hooks of a page (keyed by its path), so that the changes of
// several tables (`urlPrefix`) made before the router catches up build on
// each other instead of the last one overwriting the others
const pendingSearches = new Map<string, PendingSearches>();

const getPendingSearches = (pathname: string, search: string) => {
  let entry = pendingSearches.get(pathname);

  if (!entry) {
    entry = { pending: [], seen: search, users: 0 };
    pendingSearches.set(pathname, entry);
  }

  return entry;
};

/** Takes note of the search the router shows. */
function observeSearch(entry: PendingSearches, search: string) {
  // Only a change counts - not every render with the same search
  if (search === entry.seen) return;
  entry.seen = search;

  const index = entry.pending.indexOf(search);
  // Not one of the changes - from elsewhere, e.g. the back button, which
  // wins. Otherwise the router caught up with one of them - later ones
  // still wait.
  entry.pending = index === -1 ? [] : entry.pending.slice(index + 1);
}

/**
 * The hash to keep when navigating - the document hash (`#details`) under a
 * history router, also one with a `basename` (`/app/people` for `/people`).
 */
function documentHash(pathname: string) {
  if (typeof window === "undefined") return "";

  const { hash, pathname: documentPath } = window.location;

  // A hash router keeps its own path in the hash (`#/people`, `#!/people`),
  // which `pathname` and `search` stand for - also at its root, where the
  // path of the page is `/` too
  if (/^#!?\//.test(hash)) return "";

  // Not the router of the page, e.g. an in-memory one
  return documentPath.endsWith(pathname) ? hash : "";
}

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
  const latestRouter = useRef(router);

  useEffect(() => {
    latestRouter.current = router;
  });

  // The entry of the page lives while a table of the page uses it - a new
  // page (or the next test) starts without the old pending changes
  useEffect(() => {
    if (!syncWithUrl) return;

    const { search } = latestRouter.current;
    const entry = getPendingSearches(pathname, search);
    if (entry.users === 0) {
      entry.pending = [];
      entry.seen = search;
    }
    entry.users += 1;

    return () => {
      entry.users -= 1;
      if (entry.users === 0) pendingSearches.delete(pathname);
    };
  }, [pathname, syncWithUrl]);

  useEffect(() => {
    if (syncWithUrl) {
      observeSearch(getPendingSearches(pathname, routerSearch), routerSearch);
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

      const currentRouter = latestRouter.current;
      const entry = getPendingSearches(
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
      entry.pending = [...entry.pending, search].slice(-MAX_PENDING);

      currentRouter.navigate(
        `${currentRouter.pathname}${search}${documentHash(currentRouter.pathname)}`,
        { replace },
      );
    },
    [replace, stableDefaults, stablePageSizes, syncWithUrl, urlPrefix],
  );

  return [urlQuery ?? localQuery, setQuery];
}
