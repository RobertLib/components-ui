/** Messages to the other browser tabs of the app - see `openTabChannel`. */
export interface TabChannel<T> {
  /** Stops listening. */
  close: () => void;
  /** Sends a message to the other tabs - any value `structuredClone` and JSON take. */
  post: (message: T) => void;
}

/**
 * Opens the channel `name` between the tabs of the app: a
 * `BroadcastChannel`, or `localStorage` in a browser without one - its
 * `storage` event reaches the other tabs. `onMessage` gets what the other
 * tabs post. Call in the browser only, e.g. in an effect.
 */
export function openTabChannel<T>(
  name: string,
  onMessage: (message: T) => void,
): TabChannel<T> {
  if (typeof BroadcastChannel === "function") {
    const channel = new BroadcastChannel(name);
    channel.onmessage = (event: MessageEvent) => onMessage(event.data as T);

    return {
      close: () => channel.close(),
      post: (message) => {
        try {
          channel.postMessage(message);
        } catch {
          // Closed meanwhile - nobody listens
        }
      },
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== name || !event.newValue) return;
    try {
      onMessage((JSON.parse(event.newValue) as { message: T }).message);
    } catch {
      // Not a message of the channel
    }
  };
  window.addEventListener("storage", handleStorage);

  return {
    close: () => window.removeEventListener("storage", handleStorage),
    post: (message) => {
      try {
        // A new value each time - an equal one would fire no `storage`
        localStorage.setItem(
          name,
          JSON.stringify({ message, sent: `${Date.now()}-${Math.random()}` }),
        );
      } catch {
        // Blocked or full storage - this tab only
      }
    },
  };
}
