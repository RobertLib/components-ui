import { useInsertionEffect, useRef, useState } from "react";

const MAX_PENDING = 50;

/**
 * A value that the owner (props, the URL of a router) applies later than it
 * is changed here - e.g. a router whose `search` updates after `navigate`.
 * `get` returns the latest value: the last one `set` while the owner has not
 * caught up with it yet, otherwise `incoming`. A re-render with the old
 * `incoming` meanwhile does not bring the old value back, so a change made
 * before the owner catches up builds on the pending one.
 *
 * An owner that rejects a change looks the same as one that is late - the
 * rejected value stays pending until the owner shows another value.
 * Returning the exact submitted object confirms a coalesced change back
 * to the shown value. An unchanged primitive or an equal copy alone cannot
 * distinguish that confirmation from an unrelated render.
 * Callers that normalize values can pass the original incoming and submitted
 * objects as tokens, so normalization does not lose that confirmation.
 *
 * The returned object is the same in every render; `isEqual` must be too.
 */
export default function usePendingValue<V>(
  incoming: V,
  isEqual: (a: V, b: V) => boolean,
  incomingToken: unknown = incoming,
) {
  const state = useRef({
    latest: incoming,
    pending: [] as V[],
    seen: incoming,
    seenToken: incomingToken,
    submittedToken: incomingToken,
  });

  // Activity keeps receiving owner updates while hidden. Track every
  // committed value there too, before layout effects can read `get()`.
  useInsertionEffect(() => {
    const current = state.current;
    const changedToken = !Object.is(current.seenToken, incomingToken);
    current.seenToken = incomingToken;
    if (isEqual(current.seen, incoming)) {
      // A loading render or an inline copy of the old query confirms
      // nothing. Only the exact submitted object proves a coalesced return
      // to the shown value; otherwise earlier confirmations may still come.
      current.seen = incoming;
      if (
        changedToken &&
        current.pending.length > 0 &&
        Object.is(current.submittedToken, incomingToken) &&
        isEqual(current.pending[current.pending.length - 1], incoming)
      ) {
        current.pending = [];
        current.latest = incoming;
      }
      return;
    }
    current.seen = incoming;

    // An owner may skip intermediate values. A repeated value confirms its
    // last occurrence, including the changes before it that were skipped.
    const index = current.pending.findLastIndex((value) =>
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
    set: (value: V, submittedToken: unknown = value) => {
      const current = state.current;
      current.latest = value;
      current.submittedToken = submittedToken;

      // Back at what the owner shows with nothing on the way - nothing to
      // wait for. With changes on the way the owner still shows them first,
      // so the return waits behind them.
      if (current.pending.length === 0 && isEqual(value, current.seen)) {
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
