/*
 * The URL changes a page makes that its router shows late - a router may
 * apply a navigation after a render or two. `useDataTableQuery` and
 * `useUrlState` build each change on the ones still on their way, so that
 * two changes in a row (a filter, then the page) do not lose the first.
 */

// An owner that ignores the changes must not make the list grow forever
export const MAX_PENDING_SEARCHES = 50;

/** The URL changes of the tables of one page that the router shows late. */
export interface PendingSearches {
  /** Searches navigated to that the router has not shown yet, oldest first. */
  pending: string[];
  /** The search the router showed last. */
  seen: string;
  /** Mounted hooks sharing the entry - it goes when the last one does. */
  users: number;
}

// Shared by the hooks of one router and page - `useDataTableQuery` and
// `useUrlState` - so changes of several tables (`urlPrefix`) and of the
// state of the page compose while that router catches up. Another router may
// have the same pathname without sharing its pending changes.
const pendingSearches = new WeakMap<object, Map<string, PendingSearches>>();

export const getRouterSearches = (scope: object) => {
  let pages = pendingSearches.get(scope);
  if (!pages) {
    pages = new Map();
    pendingSearches.set(scope, pages);
  }
  return pages;
};

export const getPendingSearches = (
  scope: object,
  pathname: string,
  search: string,
) => {
  const pages = getRouterSearches(scope);
  let entry = pages.get(pathname);

  if (!entry) {
    entry = { pending: [], seen: search, users: 0 };
    pages.set(pathname, entry);
  }

  return entry;
};

/** Takes note of the search the router shows. */
export function observeSearch(entry: PendingSearches, search: string) {
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
export function documentHash(pathname: string) {
  if (typeof window === "undefined") return "";

  const { hash, pathname: documentPath } = window.location;

  // A hash router keeps its own path in the hash (`#/people`, `#!/people`),
  // which `pathname` and `search` stand for - also at its root, where the
  // path of the page is `/` too
  if (/^#!?\//.test(hash)) return "";

  // Not the router of the page, e.g. an in-memory one
  return documentPath.endsWith(pathname) ? hash : "";
}
