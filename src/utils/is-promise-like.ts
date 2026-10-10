/**
 * Whether `value` is a promise - also the thenable of another library
 * (Bluebird) or of another realm (an iframe), which `instanceof Promise`
 * misses. `Promise.resolve(value)` makes it a promise of this realm.
 */
export default function isPromiseLike<T = unknown>(
  value: unknown,
): value is PromiseLike<T> {
  return typeof (value as PromiseLike<T> | null)?.then === "function";
}
