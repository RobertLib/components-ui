import { use, useEffect, useLayoutEffect, useRef } from "react";
import {
  hasOverlayAbove,
  isBelowModalOverlay,
  OverlayContext,
} from "../components/overlay-stack";
import { matchesShortcut } from "../utils/shortcut";

/** Options of one shortcut of `useHotkeys`. */
export interface HotkeyOptions {
  /**
   * Also when the focus is in a text field, a select or a `contentEditable`
   * element - where the keys type text otherwise. Right for shortcuts with
   * Ctrl / ⌘ like `"mod+s"`, wrong for single keys like `"?"`.
   */
  allowInFields?: boolean;
  /** Overrides the `preventDefault` of the hook for this shortcut. */
  preventDefault?: boolean;
}

/**
 * A shortcut (see the shortcut syntax on the Kbd page), the function it
 * calls and its options: `["mod+k", openSearch]`.
 */
export type Hotkey = [
  shortcut: string,
  handler: (event: KeyboardEvent) => void,
  options?: HotkeyOptions,
];

/** Options of `useHotkeys`. */
export interface UseHotkeysOptions {
  /** `false` turns all the shortcuts of the hook off, e.g. while a form is saving. */
  enabled?: boolean;
  /**
   * Calls `preventDefault()` on the key presses of the shortcuts, so the
   * browser does not also do what it does on them (⌘S saves the page, Ctrl
   * + K focuses its search).
   */
  preventDefault?: boolean;
}

// Inputs of these types do not type text - a shortcut works in them
const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

// Also the elements of the components that take typed keys themselves - the
// select-only combobox of `Autocomplete` picks options by letters
const TYPING_ROLES =
  "[role=textbox], [role=searchbox], [role=combobox], [role=spinbutton]";

// jsdom lacks `isContentEditable`
const EDITABLE =
  "[contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']";

/** Whether keys pressed in `element` type text (or pick by typing). */
function isTypingTarget(element: EventTarget | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(element.type);
  }

  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable ||
    element.closest(EDITABLE) !== null ||
    element.matches(TYPING_ROLES)
  );
}

interface Latest {
  ancestors: string[];
  hotkeys: Hotkey[];
  preventDefault: boolean;
}

function handleKeyDown(
  event: KeyboardEvent,
  { ancestors, hotkeys, preventDefault }: Latest,
) {
  // Used up by the page - e.g. by an editor with the same shortcut, or a
  // dialog's Escape - or a key of an input method editor (IME) composing
  // text
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229) {
    return;
  }

  // The element in a shadow root, not its host
  const target = event.composedPath?.()[0] ?? event.target;
  const inField = isTypingTarget(target);

  const hotkey = hotkeys.find(
    ([shortcut, , options]) =>
      (!inField || options?.allowInFields) && matchesShortcut(event, shortcut),
  );
  // The shortcuts of the page do not work under a modal dialog - those of a
  // component in the dialog do. An Escape is for the topmost overlay: a
  // popover, menu or tooltip open elsewhere closes first.
  if (
    !hotkey ||
    isBelowModalOverlay(ancestors) ||
    (event.key === "Escape" && hasOverlayAbove(ancestors))
  ) {
    return;
  }

  const [, handler, options] = hotkey;
  if (options?.preventDefault ?? preventDefault) event.preventDefault();
  handler(event);
}

/**
 * Registers keyboard shortcuts of the page while the component is mounted:
 * `useHotkeys([["mod+k", openSearch], ["?", showHelp]])`. See the shortcut
 * syntax on the Kbd page - `mod` is ⌘ on a Mac and Ctrl elsewhere.
 *
 * Keys typed into a text field do not count, unless the shortcut allows it
 * (`allowInFields`). A key press the page has already handled
 * (`preventDefault()`) does not count either, and the shortcuts do not work
 * under a modal dialog - unless the component is in it. An `escape`
 * shortcut waits while a popover, menu or tooltip the component is not in is
 * open: that Escape closes the overlay. One key press calls one shortcut,
 * the first that matches.
 */
export default function useHotkeys(
  hotkeys: Hotkey[],
  { enabled = true, preventDefault = true }: UseHotkeysOptions = {},
) {
  const ancestors = use(OverlayContext);
  // The shortcuts of the latest render - an inline array does not register
  // the listener anew on every render
  const latest = useRef<Latest>({ ancestors, hotkeys, preventDefault });

  useLayoutEffect(() => {
    latest.current = { ancestors, hotkeys, preventDefault };
  });

  useEffect(() => {
    if (!enabled) return;

    // Bubble phase, like the overlays: the key handlers of the page and its
    // controls come first
    const listener = (event: KeyboardEvent) =>
      handleKeyDown(event, latest.current);

    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [enabled]);
}
