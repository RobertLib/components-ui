import useMediaQuery from "./use-media-query";

/** Below Tailwind's `md` breakpoint (768px). */
const MOBILE_QUERY = "(max-width: 767.98px)";

/**
 * Whether the viewport is narrower than Tailwind's `md` breakpoint. Read
 * synchronously on the first render, so layouts do not flash the desktop
 * variant on phones.
 */
export default function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}
