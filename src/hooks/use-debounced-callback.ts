import { useEffect, useLayoutEffect, useState } from "react";
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
    if (timeout) clearTimeout(timeout);
    pendingArgs = args;
    timeout = setTimeout(run, getLatest().delay);
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
 * current state.
 */
export default function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay = 300,
  { flushOnUnmount = false }: UseDebouncedCallbackOptions = {},
): DebouncedCallback<Args> {
  const [latest] = useState(() =>
    createLatest<Latest<Args>>({ callback, delay, flushOnUnmount }),
  );

  // Layout effect: a call made from an effect of this render already sees
  // its callback
  useLayoutEffect(() => {
    latest.set({ callback, delay, flushOnUnmount });
  });

  const [debounced] = useState(() => createDebounced(latest.get));

  useEffect(
    () => () => {
      if (latest.get().flushOnUnmount) debounced.flush();
      else debounced.cancel();
    },
    [debounced, latest],
  );

  return debounced;
}
