import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDataTableQuery,
  isSameQuery,
  readQueryFromSearch,
  writeQueryToSearch,
  type DataTableQuery,
} from "./query";
import usePendingValue from "./use-pending-value";
import { useRouter } from "../../providers/ui-context";

export interface UseDataTableQueryOptions {
  /** Initial (and URL default) values, e.g. `{ pageSize: 50, sortBy: "name" }`. */
  defaults?: Partial<DataTableQuery>;
  /**
   * `syncWithUrl`: page sizes the URL may ask for - pass the
   * `pageSizeOptions` of the table (default `DEFAULT_PAGE_SIZE_OPTIONS`).
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

interface UrlState {
  query: DataTableQuery;
  search: string;
}

const isSameUrlState = (a: UrlState, b: UrlState) =>
  a.search === b.search && isSameQuery(a.query, b.query);

export type SetDataTableQuery = (
  next: DataTableQuery | ((previous: DataTableQuery) => DataTableQuery),
) => void;

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

  const urlQuery = useMemo(
    () =>
      syncWithUrl
        ? readQueryFromSearch(router.search, {
            defaults: stableDefaults,
            pageSizeOptions: stablePageSizes,
            prefix: urlPrefix,
          })
        : null,
    [router.search, stablePageSizes, stableDefaults, syncWithUrl, urlPrefix],
  );

  const query = urlQuery ?? localQuery;

  // Read by `setQuery`, which may run several times before a re-render - and
  // before a router that updates `search` asynchronously catches up
  const latest = usePendingValue(
    { query, search: router.search },
    isSameUrlState,
  );
  const latestRouter = useRef(router);

  useEffect(() => {
    latestRouter.current = router;
  });

  const setQuery = useCallback<SetDataTableQuery>(
    (next) => {
      if (!syncWithUrl) {
        setLocalQuery((previous) =>
          typeof next === "function" ? next(previous) : next,
        );
        return;
      }

      const { query: current, search: currentSearch } = latest.get();
      const currentRouter = latestRouter.current;
      const resolved = typeof next === "function" ? next(current) : next;
      const search = writeQueryToSearch(currentSearch, resolved, {
        defaults: stableDefaults,
        prefix: urlPrefix,
      });

      latest.set({ query: resolved, search });

      if (search !== currentSearch) {
        // A history router keeps the hash - a hash router has its own path
        // in it, which `pathname` stands for
        const hash =
          typeof window !== "undefined" &&
          window.location.pathname === currentRouter.pathname
            ? window.location.hash
            : "";

        currentRouter.navigate(`${currentRouter.pathname}${search}${hash}`, {
          replace,
        });
      }
    },
    [latest, replace, stableDefaults, syncWithUrl, urlPrefix],
  );

  return [query, setQuery];
}
