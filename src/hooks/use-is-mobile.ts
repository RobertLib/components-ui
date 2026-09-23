import { useSyncExternalStore } from "react";

/** Below Tailwind's `md` breakpoint (768px). */
const MOBILE_QUERY = "(max-width: 767.98px)";

const hasMatchMedia = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

function subscribe(onChange: () => void) {
  if (hasMatchMedia()) {
    const query = window.matchMedia(MOBILE_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }

  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const getSnapshot = () =>
  hasMatchMedia()
    ? window.matchMedia(MOBILE_QUERY).matches
    : window.innerWidth < 768;

const getServerSnapshot = () => false;

/**
 * Whether the viewport is narrower than Tailwind's `md` breakpoint. Read
 * synchronously on the first render, so layouts do not flash the desktop
 * variant on phones.
 */
export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
