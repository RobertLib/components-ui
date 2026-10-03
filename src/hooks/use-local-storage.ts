import {
  useCallback,
  useInsertionEffect,
  useState,
  useSyncExternalStore,
} from "react";
import createLatest from "./create-latest";
import logger from "../utils/logger";

/** Options of `useLocalStorage`. */
export interface UseLocalStorageOptions<T> {
  /**
   * Turns the stored text into the value - `JSON.parse` by default. A text
   * it cannot read (it throws, e.g. on data of an older version of the app)
   * counts as no value: the hook returns `defaultValue`. `JSON.parse` takes
   * any JSON - also `null`, or an object where the app wants an array. To
   * be sure of the shape, check it here and throw when it does not fit:
   * `(text) => { const value = JSON.parse(text); if (!Array.isArray(value))
   * throw new Error("No list"); return value; }`. Changing this function
   * reads the stored text again. Keep its reference stable (e.g. with
   * `useCallback`) to keep a parsed object's identity between renders.
   */
  deserialize?: (stored: string) => T;
  /** Turns the value into the stored text - `JSON.stringify` by default. */
  serialize?: (value: T) => string;
}

/**
 * Sets the value - or, given a function, what it returns for the current
 * value. `undefined` removes it.
 */
export type SetLocalStorageValue<T> = (value: T | ((current: T) => T)) => void;

/** What `useLocalStorage` returns: the value, its setter and its removal. */
export type UseLocalStorageResult<T> = [
  value: T,
  setValue: SetLocalStorageValue<T>,
  remove: () => void,
];

// Values that could not be written (blocked or full storage) as the text
// they would be stored as - `null` for a removal. They stand in for the
// stored ones until the page is reloaded.
const unsaved = new Map<string, string | null>();

// The hooks of this page by key - a change made by one reaches the others
const listeners = new Map<string, Set<() => void>>();

// Unsaved values outlive subscriptions, including while Activity hides all
// their hooks. Keep observing other tabs until those values are gone too.
let isStorageSubscribed = false;

// Read on every render - an unreadable storage is reported once
let isUnreadableReported = false;

/**
 * The text stored under `key`. Just reading `localStorage` throws with
 * blocked site data or in a sandboxed iframe - `typeof localStorage` too.
 */
function readLocalStorage(key: string) {
  try {
    return typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(key);
  } catch (error) {
    if (!isUnreadableReported) {
      isUnreadableReported = true;
      logger.error("Failed to read from localStorage", error);
    }
    return null;
  }
}

const readStored = (key: string) =>
  unsaved.has(key) ? (unsaved.get(key) ?? null) : readLocalStorage(key);

function writeStored(key: string, text: string | null) {
  try {
    if (text === null) localStorage.removeItem(key);
    else localStorage.setItem(key, text);
    unsaved.delete(key);
  } catch (error) {
    logger.error(`Failed to save "${key}" to localStorage`, error);
    unsaved.set(key, text);
  }

  syncStorageSubscription();
  listeners.get(key)?.forEach((listener) => listener());
}

/** Whether a `storage` event is about `localStorage` - not `sessionStorage`. */
function isLocalStorage(area: Storage | null) {
  try {
    return area === null || area === localStorage;
  } catch {
    return false;
  }
}

// Another tab's write or clear wins over values we could not save, even
// when none of their hooks currently subscribe to the store.
function handleStorage(event: StorageEvent) {
  if (!isLocalStorage(event.storageArea)) return;

  if (event.key === null) {
    unsaved.clear();
    listeners.forEach((keyListeners) =>
      keyListeners.forEach((listener) => listener()),
    );
  } else {
    unsaved.delete(event.key);
    listeners.get(event.key)?.forEach((listener) => listener());
  }
  syncStorageSubscription();
}

/** A single listener follows both active hooks and unsaved values. */
function syncStorageSubscription() {
  if (typeof window === "undefined") return;
  const shouldSubscribe = listeners.size > 0 || unsaved.size > 0;
  if (shouldSubscribe === isStorageSubscribed) return;

  if (shouldSubscribe) window.addEventListener("storage", handleStorage);
  else window.removeEventListener("storage", handleStorage);
  isStorageSubscribed = shouldSubscribe;
}

function subscribe(key: string, listener: () => void) {
  let keyListeners = listeners.get(key);
  if (!keyListeners) {
    keyListeners = new Set();
    listeners.set(key, keyListeners);
  }
  keyListeners.add(listener);
  syncStorageSubscription();

  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0 && listeners.get(key) === keyListeners) {
      listeners.delete(key);
    }
    syncStorageSubscription();
  };
}

const INVALID = Symbol("invalid");

function parse<T>(
  key: string,
  text: string,
  deserialize: (stored: string) => T,
): T | typeof INVALID {
  try {
    return deserialize(text);
  } catch (error) {
    logger.warn(
      `The value of "${key}" in localStorage cannot be read - the default value is used instead.`,
      error,
    );
    return INVALID;
  }
}

/**
 * Reads the value of one hook. It stays the same object while the key,
 * stored text and deserializer stay the same, also for updater functions.
 */
function createReader<T>() {
  let last: {
    deserialize: (stored: string) => T;
    key: string;
    text: string;
    value: T | typeof INVALID;
  } | null = null;

  return (
    key: string,
    text: string | null,
    deserialize: (stored: string) => T,
    defaultValue: T,
  ): T => {
    if (text === null) return defaultValue;

    if (
      !last ||
      last.key !== key ||
      last.text !== text ||
      last.deserialize !== deserialize
    ) {
      last = { deserialize, key, text, value: parse(key, text, deserialize) };
    }
    return last.value === INVALID ? defaultValue : last.value;
  };
}

/**
 * A value remembered in `localStorage` under `key`, as JSON - use it like
 * `useState`: `const [view, setView] = useLocalStorage("orders-view",
 * "table")`. The hooks with the same key share the value, also across the
 * browser tabs of the app. `defaultValue` stands in while nothing (or
 * nothing readable) is stored, on the server and while the page hydrates.
 * When the storage cannot be written (private mode, a full quota) the value
 * still changes, until the page is reloaded.
 */
export default function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  {
    deserialize = JSON.parse,
    serialize = JSON.stringify,
  }: UseLocalStorageOptions<T> = {},
): UseLocalStorageResult<T> {
  const [read] = useState(() => createReader<T>());
  const [latest] = useState(() =>
    createLatest({ defaultValue, deserialize, serialize }),
  );

  // Pending writes also use options committed while Activity is hidden.
  useInsertionEffect(() => {
    latest.set({ defaultValue, deserialize, serialize });
  });

  const subscribeToKey = useCallback(
    (onChange: () => void) => subscribe(key, onChange),
    [key],
  );

  // The store snapshot is the text itself. Parsing outside it lets an
  // inline deserializer return a new object without changing the snapshot
  // on every render and scheduling another render of the hook.
  const stored = useSyncExternalStore(
    subscribeToKey,
    () => readStored(key),
    () => null,
  );
  const value = read(key, stored, deserialize, defaultValue);

  const setValue = useCallback<SetLocalStorageValue<T>>(
    (next) => {
      const current = latest.get();
      const resolved =
        typeof next === "function"
          ? (next as (value: T) => T)(
              read(
                key,
                readStored(key),
                current.deserialize,
                current.defaultValue,
              ),
            )
          : next;

      writeStored(
        key,
        resolved === undefined ? null : current.serialize(resolved),
      );
    },
    [key, latest, read],
  );

  const remove = useCallback(() => writeStored(key, null), [key]);

  return [value, setValue, remove];
}
