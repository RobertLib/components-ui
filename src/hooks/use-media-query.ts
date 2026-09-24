import { useCallback, useSyncExternalStore } from "react";

/** Options of `useMediaQuery`. */
export interface UseMediaQueryOptions {
  /**
   * The value on the server, and while a server-rendered page hydrates -
   * the server cannot know the screen. The hook switches to the real value
   * right after hydration. A page rendered in the browser only gets the
   * real value on its first render.
   */
  serverValue?: boolean;
}

const hasMatchMedia = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

// jsdom has no `matchMedia` - a lone width query is answered from the width
// of the window there, the way `useIsMobile` always did
const WIDTH_QUERY = /^\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/;

/** Whether a `min-width` / `max-width` query matches - `undefined` for others. */
function matchesWidth(query: string) {
  const match = WIDTH_QUERY.exec(query.trim());
  if (!match) return undefined;

  const width = Number(match[2]);
  return match[1] === "min"
    ? window.innerWidth >= width
    : window.innerWidth <= width;
}

function subscribe(query: string, onChange: () => void) {
  if (hasMatchMedia()) {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }

  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const getMatches = (query: string, serverValue: boolean) =>
  hasMatchMedia()
    ? window.matchMedia(query).matches
    : (matchesWidth(query) ?? serverValue);

/**
 * Whether a CSS media query matches, e.g. `"(min-width: 1024px)"` or
 * `"(prefers-reduced-motion: reduce)"` - and it follows its changes. Read
 * synchronously on the first render in the browser, so a layout does not
 * flash its other variant; the server renders `serverValue`.
 */
export default function useMediaQuery(
  query: string,
  { serverValue = false }: UseMediaQueryOptions = {},
) {
  const subscribeToQuery = useCallback(
    (onChange: () => void) => subscribe(query, onChange),
    [query],
  );

  return useSyncExternalStore(
    subscribeToQuery,
    () => getMatches(query, serverValue),
    () => serverValue,
  );
}
