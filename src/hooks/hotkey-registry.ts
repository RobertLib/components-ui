import { useState, useSyncExternalStore } from "react";
import {
  isBelowModalOverlayUnder,
  subscribeToOverlayStack,
} from "../components/ui/overlay-stack";

/** A shortcut of `useHotkeys` with a `description`, as the help lists it. */
export interface RegisteredHotkey {
  /** The overlays around the component that registered it, outermost first. */
  ancestors: string[];
  /** What it does, e.g. "Save". */
  description: string;
  /** The heading it is listed under. */
  group?: string;
  /** Tells the registered shortcuts apart. */
  id: number;
  /** The shortcut, in the syntax of `Kbd`. */
  shortcut: string;
}

// The shortcuts of the mounted, enabled `useHotkeys` - by the registration
// they came with, in the order they were registered. Filled by effects
// only, so the server has none.
const registrations = new Map<object, RegisteredHotkey[]>();
const listeners = new Set<() => void>();
let lastId = 0;

const notify = () => {
  for (const listener of listeners) listener();
};

/**
 * Registers the described shortcuts of a `useHotkeys` - until the returned
 * function is called (the component unmounts, or the hook is disabled).
 */
export function registerHotkeys(
  entries: Omit<RegisteredHotkey, "id">[],
): () => void {
  const key = {};
  registrations.set(
    key,
    entries.map((entry) => {
      lastId += 1;
      return { ...entry, id: lastId };
    }),
  );
  notify();

  return () => {
    registrations.delete(key);
    notify();
  };
}

/** Calls `listener` when shortcuts are registered or unregistered. */
function subscribeToHotkeys(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Also when an overlay opens or closes - a modal dialog puts the shortcuts
// of the page under it out of reach
const subscribe = (listener: () => void) => {
  const stopHotkeys = subscribeToHotkeys(listener);
  const stopOverlays = subscribeToOverlayStack(listener);
  return () => {
    stopHotkeys();
    stopOverlays();
  };
};

const NONE: RegisteredHotkey[] = [];
const getServerSnapshot = () => NONE;

/**
 * Reads the shortcuts that work under the overlay `under` - the same array
 * while they are the same, as `useSyncExternalStore` needs.
 */
function createReader() {
  let key = "";
  let list = NONE;

  return (under: string) => {
    const next = [...registrations.values()]
      .flat()
      .filter((entry) => !isBelowModalOverlayUnder(entry.ancestors, under));
    const nextKey = next.map((entry) => entry.id).join(" ");
    if (nextKey !== key) {
      key = nextKey;
      list = next.length === 0 ? NONE : next;
    }
    return list;
  };
}

/**
 * The registered shortcuts that work now - not those of a page under a
 * modal dialog. `under` is the id of an overlay to leave out with the ones
 * above it: the dialog that lists them, opened over the page.
 */
export function useRegisteredHotkeys(under = ""): RegisteredHotkey[] {
  const [read] = useState(createReader);

  return useSyncExternalStore(subscribe, () => read(under), getServerSnapshot);
}
