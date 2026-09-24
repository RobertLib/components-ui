import { useEffect, useState } from "react";

/**
 * `value` once it has stopped changing for `delay` milliseconds (300 by
 * default) - e.g. the text of a search field, to load results for once the
 * user pauses typing. The first render returns `value` itself. Values are
 * compared with `Object.is`, so an object created anew on every render
 * never settles.
 */
export default function useDebouncedValue<T>(value: T, delay = 300): T {
  // Functions are held as values, not called as initializers and updaters
  const [debounced, setDebounced] = useState(() => value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(() => value), delay);
    return () => clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}
