import { useCallback, useEffect, useRef, useState } from "react";

/** Options of `useClipboard`. */
export interface UseClipboardOptions {
  /** How long `copied` stays `true` after a copy, in milliseconds. */
  timeout?: number;
}

/** What `useClipboard` returns. */
export interface UseClipboardResult {
  /**
   * Copies `text` to the clipboard. Resolves with whether it worked - it
   * never rejects, a failure is in `error`. Call it right in the event
   * handler of a click or a key: browsers let only such a user action write
   * to the clipboard.
   */
  copy: (text: string) => Promise<boolean>;
  /** `true` for `timeout` ms after a successful copy. */
  copied: boolean;
  /** Why the last copy failed - `null` again after a successful one. */
  error: Error | null;
  /** Clears `copied` and `error` - a copy still on its way no longer sets them. */
  reset: () => void;
}

// A DOMException (`NotAllowedError`) is kept as it is - an `Error` in
// browsers, not in every test environment
const toError = (reason: unknown): Error =>
  reason instanceof Error ||
  (typeof DOMException !== "undefined" && reason instanceof DOMException)
    ? (reason as Error)
    : new Error(String(reason), { cause: reason });

/**
 * The way of copying from before the Clipboard API - pages served over
 * plain http (an intranet app) have no `navigator.clipboard`. It copies a
 * selected piece of text, without moving the focus.
 */
function copyWithCommand(text: string) {
  const holder = document.createElement("span");
  holder.textContent = text;
  // Selectable, and keeping line breaks and spaces - but not seen
  holder.style.cssText =
    "all:unset;position:fixed;top:0;clip:rect(0,0,0,0);white-space:pre;user-select:text;-webkit-user-select:text";
  document.body.append(holder);

  const selection = document.getSelection();
  const previousRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index),
      )
    : [];
  const range = document.createRange();
  range.selectNodeContents(holder);
  selection?.removeAllRanges();
  selection?.addRange(range);

  // The text itself, whatever the browser would make of the selection
  const handleCopy = (event: ClipboardEvent) => {
    event.clipboardData?.setData("text/plain", text);
    event.preventDefault();
  };
  document.addEventListener("copy", handleCopy);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.removeEventListener("copy", handleCopy);
    holder.remove();
    selection?.removeAllRanges();
    previousRanges.forEach((previous) => selection?.addRange(previous));
  }

  if (!copied) throw new Error("The browser does not allow copying here.");
}

/** Writes `text` to the clipboard - a rejection says why it could not. */
function writeToClipboard(text: string) {
  return new Promise<void>((resolve) => {
    // Called right away, within the user action
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      resolve(navigator.clipboard.writeText(text));
    } else {
      copyWithCommand(text);
      resolve();
    }
  });
}

/**
 * Copies text to the clipboard and tells how it went: `copied` for a moment
 * after a copy - to switch a "Copy" button to "Copied" - or the `error`.
 * `CopyButton` is built with it.
 */
export default function useClipboard({
  timeout = 2000,
}: UseClipboardOptions = {}): UseClipboardResult {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Counts the copies - only the result of the last one is shown
  const attempt = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const reset = useCallback(() => {
    attempt.current += 1;
    if (timer.current) clearTimeout(timer.current);
    setCopied(false);
    setError(null);
  }, []);

  const copy = useCallback(
    (text: string) => {
      attempt.current += 1;
      const current = attempt.current;

      return writeToClipboard(text).then(
        () => {
          if (current === attempt.current) {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), timeout);
            setError(null);
            setCopied(true);
          }
          return true;
        },
        (reason: unknown) => {
          if (current === attempt.current) {
            if (timer.current) clearTimeout(timer.current);
            setCopied(false);
            setError(toError(reason));
          }
          return false;
        },
      );
    },
    [timeout],
  );

  return { copied, copy, error, reset };
}
