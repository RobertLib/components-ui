/**
 * Which links lead to the current page - the rule `Drawer`, `Tabs` and
 * `TreeView` mark their active item by. Plain functions without React, so
 * that server components can call them too.
 */

// Resolves the links - the origin itself is never used
const URL_BASE = "http://localhost";

// A scheme (`https:`, `mailto:`) or a protocol-relative `//host` - a link
// that leaves the app
const SCHEME = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * The path of `url` as links are compared by: percent-escaped as the URL
 * parser writes it (with capital hex digits) and without a trailing slash -
 * `/nastavení`, `/nastaven%c3%ad` and `/nastaven%C3%AD/` are one page.
 */
const comparablePath = (url: URL) => {
  const path = url.pathname.replace(/%[\da-f]{2}/gi, (escape) =>
    escape.toUpperCase(),
  );
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
};

/** How a link leads to the current page - see `createLinkMatcher`. */
export interface LinkMatch {
  /** The link is the current page itself, not a page above it. */
  exact: boolean;
  /** The query parameters of the link. */
  params: [string, string][];
  /** Length of the path of the link - the longer, the more specific. */
  path: number;
  /**
   * The number of the query parameters of the link, when the page has all
   * of them - `-1` when it lacks some.
   */
  query: number;
}

/**
 * Matches links against the current page (`pathname`, and `search` with
 * its leading `?`): `null` for a link that leads elsewhere, else how it
 * leads there. A link matches its page and the pages below it - `/users`
 * on `/users/42`, not on `/users-archive`; `/` only itself. A relative path
 * is resolved as the browser resolves it, and neither percent-encoding nor
 * a trailing slash makes a difference. A link of just a query or an anchor
 * (`?tab=all`, `#top`) and a link with a scheme or a host (`https://…`,
 * `//…`, `mailto:…`) match nothing.
 */
export function createLinkMatcher(
  pathname: string,
  search = "",
): (href: string) => LinkMatch | null {
  // The server of the default router adapter knows no page
  if (!pathname) return () => null;

  const current = new URL(URL_BASE);
  // The setters escape what a path or a query cannot hold as it is
  current.pathname = pathname;
  current.search = search;
  const currentPath = comparablePath(current);

  return (href) => {
    // No page of its own - a query or an anchor of the current one - or
    // no page of the app
    if (!href.split(/[?#]/)[0] || SCHEME.test(href)) return null;

    let target: URL;
    try {
      target = new URL(href, current);
    } catch {
      return null;
    }
    // The URL parser reads `/\host` as another host too
    if (target.origin !== current.origin) return null;

    const path = comparablePath(target);
    const exact = currentPath === path;
    if (!exact && (path === "/" || !currentPath.startsWith(`${path}/`))) {
      return null;
    }

    const params = Array.from(target.searchParams);
    const query = params.every(([key, value]) =>
      current.searchParams.getAll(key).includes(value),
    )
      ? params.length
      : -1;

    return { exact, params, path: path.length, query };
  };
}

/**
 * Whether `href` is the current page or one of its sub-pages - `/users` is
 * active on `/users/42` but not on `/users-archive`, and `/` only on `/`.
 * The query and the hash of `href` do not matter; a relative path is
 * resolved against `pathname`, and percent-encoding and a trailing slash
 * make no difference (`/nastavení` is active on `/nastaven%C3%AD/`). A link
 * of just a query or an anchor, and an address with a scheme or a host
 * (`https://…`, `mailto:…`), are never active.
 */
export function isActivePath(pathname: string, href: string) {
  return createLinkMatcher(pathname)(href) !== null;
}

/**
 * The item whose link leads to the current page - of several, the most
 * specific one: the longest path (`/users/new` over `/users` on
 * `/users/new`), then the one whose query parameters the page has, the most
 * of them (`/tasks?filter=mine` over `/tasks?filter=all` on
 * `/tasks?filter=mine`), and the first of equal ones.
 */
export function findActiveLink<T>(
  items: Iterable<T>,
  getHref: (item: T) => string | undefined,
  pathname: string,
  search = "",
): T | undefined {
  const match = createLinkMatcher(pathname, search);
  let active: T | undefined;
  let best: LinkMatch | null = null;

  for (const item of items) {
    const href = getHref(item);
    const result = href ? match(href) : null;

    if (
      result &&
      (!best ||
        result.path > best.path ||
        (result.path === best.path && result.query > best.query))
    ) {
      active = item;
      best = result;
    }
  }

  return active;
}
