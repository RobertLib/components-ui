import { useEffect, useLayoutEffect, useState } from "react";
import debounce from "../../utils/debounce";

// An owner that ignores the commits must not make the list grow forever
const MAX_PENDING = 20;

/**
 * A text field whose value is committed with a delay - it shows every
 * keystroke at once, calls `onCommit` once typing pauses, and follows
 * `value` when that changes from outside (back button, cleared filters)
 * unless the user is in the middle of typing.
 *
 * The owner may show the commits late (a router applying navigations
 * later): a commit it shows while a newer one is on its way does not bring
 * the older text back into the field.
 *
 * A new `resetKey` ("Clear filters" pressed) shows `value` again at once and
 * drops the text still waiting to be committed.
 */
export default function useDebouncedField(
  value: string,
  onCommit: (value: string) => void,
  delay = 300,
  resetKey = 0,
) {
  const [fieldValue, setFieldValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);

  // A text typed but not committed yet leaves `value` as it was - clearing
  // the filters changes nothing the field could follow, so the key tells it
  const [seenResetKey, setSeenResetKey] = useState(resetKey);

  if (resetKey !== seenResetKey) {
    setSeenResetKey(resetKey);
    setIsTyping(false);
    setFieldValue(value);
  }
  // What the owner showed last, and the values committed here that it has
  // not shown yet, oldest first
  const [owner, setOwner] = useState({ pending: [] as string[], seen: value });

  if (value !== owner.seen) {
    const index = owner.pending.indexOf(value);

    if (index === -1) {
      // Changed from outside - it wins over the commits on their way
      setOwner({ pending: [], seen: value });
      if (!isTyping && value !== fieldValue.trim()) setFieldValue(value);
    } else {
      // The owner caught up with one of the commits - the field shows it
      // or a newer text already
      setOwner({ pending: owner.pending.slice(index + 1), seen: value });
    }
  }

  const commit = (next: string) => {
    setOwner((current) => ({
      ...current,
      // Back at what the owner shows, nothing waits - unless commits are
      // still on their way: the owner shows them first, then this one
      pending:
        current.pending.length === 0 && next === current.seen
          ? []
          : [...current.pending, next].slice(-MAX_PENDING),
    }));
    onCommit(next);
  };

  // The commit callback travels with each call, so the latest one is used
  const [debouncedCommit] = useState(() =>
    debounce((next: string, commitLatest: (value: string) => void) => {
      setIsTyping(false);
      commitLatest(next);
    }, delay),
  );

  useEffect(() => () => debouncedCommit.cancel(), [debouncedCommit]);

  // The commit of the text typed before the reset must not bring it back -
  // dropped as the reset renders, before a timer can run
  useLayoutEffect(() => {
    debouncedCommit.cancel();
  }, [debouncedCommit, resetKey]);

  const change = (next: string) => {
    setFieldValue(next);
    setIsTyping(true);
    debouncedCommit(next.trim(), commit);
  };

  /** Sets the value and commits it right away. */
  const commitNow = (next: string) => {
    debouncedCommit.cancel();
    setIsTyping(false);
    setFieldValue(next);
    commit(next);
  };

  return { change, commitNow, value: fieldValue };
}
