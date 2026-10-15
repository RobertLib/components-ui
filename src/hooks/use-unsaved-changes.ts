import { use, useCallback, useInsertionEffect, useRef } from "react";
import { ConfirmContext } from "../providers/confirm-context";
import {
  addLeaveGuard,
  syncListeners,
  type LeaveGuard,
} from "../providers/navigation-guard";
import { useMessages } from "../providers/ui-context";
import isPromiseLike from "../utils/is-promise-like";

export interface UseUnsavedChangesOptions {
  /**
   * Asks instead of "Leave without saving?" - e.g. a dialog with a "Save"
   * button too. Return (or resolve) `true` to leave the page. Several forms
   * with unsaved changes are asked about once, by the first of them.
   */
  onBeforeLeave?: () => boolean | PromiseLike<boolean>;
}

export interface UseUnsavedChangesResult {
  /**
   * Lets the page be left without the question until `dirty` changes -
   * after a save, for a navigation in the same handler, before the `dirty`
   * of the saved form comes with the next render.
   */
  release: () => void;
}

/**
 * Asks before the page is left while a form has unsaved changes (`dirty`):
 * the browser asks before a reload, closing the tab or going to another
 * site; the library asks "Leave without saving?" - in a `ConfirmDialog` of
 * a `ConfirmProvider`, else with the browser's `confirm()` - before the
 * links it renders and its `navigate` and `back` lead to another path, and
 * before back and forward where the browser lets a page stop them. A change
 * of the query alone (a tab, a filter) stays on the page. Ask before the
 * app's own navigations with a blocker of its router and `confirmLeave()`.
 * Several forms ask once together; `dirty` going `false` (saved) asks no
 * more.
 */
export default function useUnsavedChanges(
  dirty: boolean,
  options: UseUnsavedChangesOptions = {},
): UseUnsavedChangesResult {
  const { onBeforeLeave } = options;
  const confirm = use(ConfirmContext);
  const texts = useMessages().ui.unsavedChanges;
  // What the page asks - registered while the component lives
  const guard = useRef<LeaveGuard>({
    ask: () => Promise.resolve(true),
    dirty: false,
    released: false,
  });

  const ask = (): Promise<boolean> => {
    if (onBeforeLeave) {
      const answer = onBeforeLeave();
      return isPromiseLike(answer)
        ? Promise.resolve(answer).then((leave) => leave === true)
        : Promise.resolve(answer === true);
    }
    if (confirm) {
      return confirm({
        cancelLabel: texts.stay,
        confirmColor: "danger",
        confirmLabel: texts.leave,
        message: texts.message,
        title: texts.title,
      });
    }
    return Promise.resolve(
      window.confirm(`${texts.title}\n\n${texts.message}`),
    );
  };

  // Insertion effects follow the actual lifetime - a form Activity hides
  // keeps its changes, and asks for them
  useInsertionEffect(() => {
    guard.current.ask = ask;
  });

  useInsertionEffect(() => addLeaveGuard(guard.current), []);

  useInsertionEffect(() => {
    guard.current.dirty = dirty;
    guard.current.released = false;
    syncListeners();
  }, [dirty]);

  const release = useCallback(() => {
    guard.current.released = true;
    syncListeners();
  }, []);

  return { release };
}
