import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};

/**
 * `false` on the server and while a server-rendered page hydrates, `true`
 * right after - and from the first render of a page rendered in the
 * browser only.
 */
export default function useIsHydrated() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}
