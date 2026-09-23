import { useEffect, useRef, useState } from "react";

const MAX_PENDING = 50;

/**
 * A value that the owner (props, the URL of a router) applies later than it
 * is changed here - e.g. a router whose `search` updates after `navigate`.
 * `get` returns the latest value: the last one `set` while the owner has not
 * caught up with it yet, otherwise `incoming`. A re-render with the old
 * `incoming` meanwhile does not bring the old value back, so a change made
 * before the owner catches up builds on the pending one.
 *
 * The returned object is the same in every render; `isEqual` must be too.
 */
export default function usePendingValue<V>(
  incoming: V,
  isEqual: (a: V, b: V) => boolean,
) {
  const state = useRef({
    latest: incoming,
    pending: [] as V[],
    seen: incoming,
  });

  useEffect(() => {
    const current = state.current;
    // Only a change of `incoming` counts - not every re-render with it
    if (isEqual(current.seen, incoming)) return;
    current.seen = incoming;

    const index = current.pending.findIndex((value) =>
      isEqual(value, incoming),
    );

    if (index === -1) {
      // Changed from elsewhere, e.g. the back button - it wins
      current.pending = [];
      current.latest = incoming;
      return;
    }

    // The owner caught up with one of the changes - later ones still wait
    current.pending = current.pending.slice(index + 1);
    if (current.pending.length === 0) current.latest = incoming;
  });

  const [access] = useState(() => ({
    get: () => state.current.latest,
    set: (value: V) => {
      const current = state.current;
      current.latest = value;

      // Back at what the owner shows - nothing to wait for
      if (isEqual(value, current.seen)) {
        current.pending = [];
      } else {
        current.pending.push(value);
        // An owner that ignores changes must not make the list grow forever
        if (current.pending.length > MAX_PENDING) current.pending.shift();
      }
    },
  }));

  return access;
}
