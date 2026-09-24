import {
  useCallback,
  useLayoutEffect,
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
   * counts as no value: the hook returns `defaultValue`.
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

function subscribe(key: string, listener: () => void) {
  let keyListeners = listeners.get(key);
  if (!keyListeners) {
    keyListeners = new Set();
    listeners.set(key, keyListeners);
  }
  keyListeners.add(listener);

  // Another tab of the app changed the value, or cleared the storage
  // (`key` is `null` then) - what it stored wins over what could not be
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== key) return;
    if (!isLocalStorage(event.storageArea)) return;

    unsaved.delete(key);
    listener();
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0 && listeners.get(key) === keyListeners) {
      listeners.delete(key);
    }
    window.removeEventListener("storage", handleStorage);
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
 * Reads the value of one hook. It stays the same object while the stored
 * text does - `useSyncExternalStore` asks for it on every render.
 */
function createReader<T>() {
  let last: { key: string; text: string; value: T | typeof INVALID } | null =
    null;

  return (
    key: string,
    deserialize: (stored: string) => T,
    defaultValue: T,
  ): T => {
    const text = readStored(key);
    if (text === null) return defaultValue;

    if (!last || last.key !== key || last.text !== text) {
      last = { key, text, value: parse(key, text, deserialize) };
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

  useLayoutEffect(() => {
    latest.set({ defaultValue, deserialize, serialize });
  });

  const subscribeToKey = useCallback(
    (onChange: () => void) => subscribe(key, onChange),
    [key],
  );

  const value = useSyncExternalStore(
    subscribeToKey,
    () => read(key, deserialize, defaultValue),
    () => defaultValue,
  );

  const setValue = useCallback<SetLocalStorageValue<T>>(
    (next) => {
      const current = latest.get();
      const resolved =
        typeof next === "function"
          ? (next as (value: T) => T)(
              read(key, current.deserialize, current.defaultValue),
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
