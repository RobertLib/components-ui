import { useEffect, useInsertionEffect, useState } from "react";
import createLatest from "./create-latest";

/** A function whose calls are debounced - see `useDebouncedCallback`. */
export type DebouncedCallback<Args extends unknown[]> = ((
  ...args: Args
) => void) & {
  /** Drops the pending call. */
  cancel: () => void;
  /** Makes the pending call right away - nothing happens when none is pending. */
  flush: () => void;
};

/** Options of `useDebouncedCallback`. */
export interface UseDebouncedCallbackOptions {
  /**
   * Makes a call still pending when the component unmounts, e.g. the last
   * autosave of a form that is being closed. By default it is dropped.
   * Hiding with Activity keeps the pending call and its deadline.
   * Unmounting while hidden flushes just after the unmount commit.
   */
  flushOnUnmount?: boolean;
}

interface Latest<Args extends unknown[]> {
  callback: (...args: Args) => void;
  delay: number;
  flushOnUnmount: boolean;
}

function createDebounced<Args extends unknown[]>(
  getLatest: () => Latest<Args>,
  isMounted: () => boolean,
): DebouncedCallback<Args> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const run = () => {
    const args = pendingArgs;
    timeout = null;
    pendingArgs = null;
    if (args) getLatest().callback(...args);
  };

  const debounced = (...args: Args) => {
    const { delay, flushOnUnmount } = getLatest();
    // A child's cleanup can call this after the owner's unmount cleanup
    // has already canceled its timer. Do not start another pending call.
    if (!isMounted() && !flushOnUnmount) return;
    if (timeout) clearTimeout(timeout);
    pendingArgs = args;
    timeout = setTimeout(run, delay);
  };

  return Object.assign(debounced, {
    cancel: () => {
      if (timeout) clearTimeout(timeout);
      timeout = null;
      pendingArgs = null;
    },
    flush: () => {
      if (timeout) clearTimeout(timeout);
      run();
    },
  });
}

/**
 * A function that calls `callback` once its calls have stopped for `delay`
 * milliseconds (300 by default), with the arguments of the last call - e.g.
 * to save a draft while the user types. It is the same function on every
 * render and calls the `callback` of the latest render, so it sees the
 * current state, including updates committed while Activity hides it.
 * Hiding leaves pending calls and their deadlines alone.
 */
export default function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay = 300,
  { flushOnUnmount = false }: UseDebouncedCallbackOptions = {},
): DebouncedCallback<Args> {
  const [latest] = useState(() =>
    createLatest<Latest<Args>>({ callback, delay, flushOnUnmount }),
  );

  // Before layout effects, including commits made while Activity is hidden:
  // pending calls use the latest callback, delay and unmount option.
  useInsertionEffect(() => {
    latest.set({ callback, delay, flushOnUnmount });
  });

  const [mounted] = useState(() => createLatest(true));
  const [debounced] = useState(() => createDebounced(latest.get, mounted.get));

  // This follows the actual lifetime. A hidden component has no passive
  // cleanup left to run; defer its flush because the callback may update
  // state, which React does not allow inside an insertion effect.
  useInsertionEffect(() => {
    mounted.set(true);
    return () => {
      mounted.set(false);
      if (latest.get().flushOnUnmount) {
        queueMicrotask(() => {
          if (!mounted.get()) debounced.flush();
        });
      } else debounced.cancel();
    };
  }, [debounced, latest, mounted]);

  // Preserve the immediate flush on a visible unmount. Activity hiding and
  // StrictMode replay this cleanup while the component remains mounted.
  // The deferred fallback then finds no pending call to flush again.
  useEffect(
    () => () => {
      if (!mounted.get()) {
        if (latest.get().flushOnUnmount) debounced.flush();
        else debounced.cancel();
      }
    },
    [debounced, latest, mounted],
  );

  return debounced;
}
