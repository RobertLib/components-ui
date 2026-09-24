import { useSyncExternalStore } from "react";
import logger from "../../utils/logger";
import { normalizeSizes } from "./sizes";

// Splitters with the same key (and other tabs) follow each other's changes
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * The text saved under `key`. Just reading `localStorage` throws with
 * blocked site data or in a sandboxed iframe - `typeof localStorage` too.
 */
function readStored(key: string | undefined) {
  if (!key) return null;

  try {
    return typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(key);
  } catch {
    return null;
  }
}

// The server has no storage - it renders the default sizes, which is also
// what the page hydrates with before switching to the saved ones
const getServerSnapshot = () => null;

/**
 * The sizes saved under `key` as text - `null` without any, on the server
 * and while a server-rendered page hydrates.
 */
export function useStoredSizes(key: string | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    getServerSnapshot,
  );
}

/** Saved `sizes` for `count` panes - `null` when there are none that fit. */
export function parseStoredSizes(
  text: string | null,
  count: number,
): number[] | null {
  if (!text) return null;

  let saved: unknown;
  try {
    saved = JSON.parse(text);
  } catch {
    return null;
  }

  // Saved for another number of panes, or edited by hand - the default
  // sizes then
  if (
    !Array.isArray(saved) ||
    saved.length !== count ||
    !saved.every(
      (size) => typeof size === "number" && Number.isFinite(size) && size >= 0,
    ) ||
    !saved.some((size) => size > 0)
  ) {
    return null;
  }

  return normalizeSizes(saved, count);
}

/** Saves `sizes` under `key` - rounded, so the saved text stays short. */
export function saveSizes(key: string, sizes: readonly number[]) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(sizes.map((size) => Math.round(size * 100) / 100)),
    );
  } catch (error) {
    // Blocked or full storage - the sizes are just not remembered
    logger.warn("Splitter: the sizes could not be saved", error);
  }

  listeners.forEach((listener) => listener());
}
