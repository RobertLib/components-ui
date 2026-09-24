import { useMemo, useSyncExternalStore } from "react";

/** Props every link the components render receives. */
export type LinkComponentProps = Omit<
  React.ComponentPropsWithRef<"a">,
  "href"
> & {
  /** Target URL. */
  href: string;
};

export type LinkComponent = React.ComponentType<LinkComponentProps>;

export interface NavigateOptions {
  /** Replace the current history entry instead of adding a new one. */
  replace?: boolean;
}

/**
 * How the components talk to the app's router. Every part is optional when
 * passed to `UIProvider` - the defaults use plain `<a>` links and the
 * browser History API, so the library works with any router or none.
 */
export interface RouterAdapter {
  /** Goes one step back in the history (the back button of `Header`). */
  back: () => void;
  /** Renders internal links (`Button link`, `Tabs`, `Drawer`, …). */
  Link: LinkComponent;
  /**
   * Changes the URL without a page reload (e.g. the `DataTable` URL state).
   * Pass `pathname` and `search` of the same router with it - the components
   * read the new URL from them.
   */
  navigate: (href: string, options?: NavigateOptions) => void;
  /** Current path - marks the active item of `Drawer` and `Tabs`. */
  pathname: string;
  /** Current query string including the leading `?`, or `""`. */
  search: string;
}

const listeners = new Set<() => void>();

// The Navigation API also reports the History API calls of other code, such
// as a router given only as `navigate` - where the browser supports it
const getNavigation = () => (window as { navigation?: EventTarget }).navigation;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  getNavigation()?.addEventListener("currententrychange", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
    getNavigation()?.removeEventListener("currententrychange", listener);
  };
};

const getSnapshot = () => window.location.pathname + window.location.search;

const getServerSnapshot = () => "";

/** Location of the page, kept up to date on back/forward and `browserNavigate`. */
export function useBrowserLocation() {
  const location = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return useMemo(() => {
    const index = location.indexOf("?");
    return index === -1
      ? { pathname: location, search: "" }
      : { pathname: location.slice(0, index), search: location.slice(index) };
  }, [location]);
}

/**
 * Makes `useBrowserLocation` read the URL again - after it was changed by
 * code it does not see, e.g. a router given to `UIProvider` only as
 * `navigate` in a browser without the Navigation API.
 */
export function notifyLocationChange() {
  listeners.forEach((listener) => listener());
}

export function browserNavigate(href: string, options?: NavigateOptions) {
  if (options?.replace) {
    window.history.replaceState(window.history.state, "", href);
  } else {
    window.history.pushState(null, "", href);
  }

  notifyLocationChange();
}

export const browserBack = () => window.history.back();
