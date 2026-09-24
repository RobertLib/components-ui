/**
 * A box for what the latest render passed to a hook (its callback, its
 * options). Keep it in state (`useState(() => createLatest(…))`), `set` it
 * in an effect and `get` it in the functions the hook hands out - they then
 * use the latest values without being created anew on every render. Unlike
 * a ref, it can be given to such a function while it is being created.
 */
export default function createLatest<T>(initial: T) {
  let latest = initial;

  return {
    get: () => latest,
    set: (next: T) => {
      latest = next;
    },
  };
}
