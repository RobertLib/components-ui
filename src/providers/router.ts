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

/** Observe History writes while location readers need the browser fallback. */
function watchHistory() {
  const history = window.history;
  const stops = (["pushState", "replaceState"] as const).map((name) => {
    const own = Object.getOwnPropertyDescriptor(history, name);
    const original = history[name];
    let active = true;
    const observed = function (
      this: History,
      ...args: Parameters<History[typeof name]>
    ) {
      // A failed write must keep its original error and notify nobody.
      const result = original.apply(this, args);
      if (active) notifyLocationChange();
      return result;
    };
    Object.defineProperty(history, name, {
      configurable: true,
      enumerable: own?.enumerable ?? false,
      value: observed,
      writable: true,
    });

    return () => {
      active = false;
      // A router may have wrapped ours since. Leave its method in place;
      // the retained wrapper just passes calls through after unsubscribing.
      if (history[name] !== observed) return;
      if (own) Object.defineProperty(history, name, own);
      else Reflect.deleteProperty(history, name);
    };
  });
  return () => stops.forEach((stop) => stop());
}

let stopWatchingHistory: (() => void) | undefined;

const subscribe = (listener: () => void) => {
  const navigation = getNavigation();
  if (listeners.size === 0 && !navigation) {
    stopWatchingHistory = watchHistory();
  }
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  navigation?.addEventListener("currententrychange", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
    navigation?.removeEventListener("currententrychange", listener);
    if (listeners.size === 0) {
      stopWatchingHistory?.();
      stopWatchingHistory = undefined;
    }
  };
};

const getSnapshot = () => window.location.pathname + window.location.search;

const getServerSnapshot = () => "";

// Listens to nothing - for a router that gives the location itself
const subscribeToNothing = () => () => {};

/**
 * Location of the page, kept up to date on back/forward and History writes.
 * With `follow` false it reads no URL and renders nothing again - for a
 * router that gives the location: a render on a change of the URL would
 * come before the router's own, with the router's old location.
 */
export function useBrowserLocation(follow = true) {
  const location = useSyncExternalStore(
    follow ? subscribe : subscribeToNothing,
    follow ? getSnapshot : getServerSnapshot,
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
 * Makes `useBrowserLocation` read the URL again after a browser navigation.
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
