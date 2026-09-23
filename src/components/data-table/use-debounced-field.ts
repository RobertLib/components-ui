import { useEffect, useState } from "react";
import debounce from "../../utils/debounce";

/**
 * A text field whose value is committed with a delay - it shows every
 * keystroke at once, calls `onCommit` once typing pauses, and follows
 * `value` when that changes from outside (back button, cleared filters)
 * unless the user is in the middle of typing.
 */
export default function useDebouncedField(
  value: string,
  onCommit: (value: string) => void,
  delay = 300,
) {
  const [fieldValue, setFieldValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);
  const [previousValue, setPreviousValue] = useState(value);

  if (value !== previousValue) {
    setPreviousValue(value);
    if (!isTyping && value !== fieldValue.trim()) setFieldValue(value);
  }

  // The commit callback travels with each call, so the latest one is used
  const [debouncedCommit] = useState(() =>
    debounce((next: string, commit: (value: string) => void) => {
      setIsTyping(false);
      commit(next);
    }, delay),
  );

  useEffect(() => () => debouncedCommit.cancel(), [debouncedCommit]);

  const change = (next: string) => {
    setFieldValue(next);
    setIsTyping(true);
    debouncedCommit(next.trim(), onCommit);
  };

  /** Sets the value and commits it right away. */
  const commitNow = (next: string) => {
    debouncedCommit.cancel();
    setIsTyping(false);
    setFieldValue(next);
    onCommit(next);
  };

  return { change, commitNow, value: fieldValue };
}
