import { useSyncExternalStore } from "react";
import { isApplePlatform } from "../utils/shortcut";

const noSubscription = () => () => {};
const notOnServer = () => false;

/**
 * Whether the page runs on an Apple platform - for writing shortcuts the way
 * the platform names its keys. The server, and the first render in the
 * browser that must match it, says no; the browser then corrects it.
 */
export default function useIsApplePlatform() {
  return useSyncExternalStore(noSubscription, isApplePlatform, notOnServer);
}
