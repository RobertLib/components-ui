/**
 * Keyboard shortcuts written as strings: keys joined by "+", modifiers first
 * - "mod+k", "shift+alt+n", "ctrl+enter", "escape", "?". `mod` is ⌘ on
 * Apple platforms and Ctrl elsewhere - the modifier of an app's shortcuts.
 * The key is a `KeyboardEvent.key` value in any case ("enter", "arrowup",
 * "f2", "k"), with "space" and "plus" for the space and the "+" key.
 */

/** A shortcut split into its modifiers and its key. */
export interface Shortcut {
  alt: boolean;
  ctrl: boolean;
  /** The `KeyboardEvent.key` of the key, lowercase - `" "` for the space. */
  key: string;
  meta: boolean;
  shift: boolean;
}

/** What `matchesShortcut` reads of a keyboard event - a DOM or a React one. */
export interface ShortcutEvent {
  altKey: boolean;
  code?: string;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_ALIASES: Record<
  string,
  "alt" | "ctrl" | "meta" | "mod" | "shift"
> = {
  alt: "alt",
  cmd: "meta",
  command: "meta",
  control: "ctrl",
  ctrl: "ctrl",
  meta: "meta",
  mod: "mod",
  option: "alt",
  shift: "shift",
};

const KEY_ALIASES: Record<string, string> = {
  del: "delete",
  down: "arrowdown",
  esc: "escape",
  left: "arrowleft",
  plus: "+",
  return: "enter",
  right: "arrowright",
  space: " ",
  up: "arrowup",
};

/** Whether the page runs on a Mac, an iPhone or an iPad - `false` on the server. */
export function isApplePlatform() {
  if (typeof navigator === "undefined") return false;

  // `userAgentData` is the modern source, Safari has only `platform`
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform || navigator.platform;

  return /mac|iphone|ipad|ipod/i.test(platform);
}

const toShortcut = (shortcut: string | Shortcut, isApple: boolean) =>
  typeof shortcut === "string" ? parseShortcut(shortcut, isApple) : shortcut;

/**
 * Splits a shortcut like "mod+shift+k" into its modifiers and its key -
 * `mod` becomes `meta` on Apple platforms and `ctrl` elsewhere.
 */
export function parseShortcut(
  shortcut: string,
  isApple = isApplePlatform(),
): Shortcut {
  const parsed: Shortcut = {
    alt: false,
    ctrl: false,
    key: "",
    meta: false,
    shift: false,
  };

  // A "+" at the end is the "+" key: "mod++", "+"
  const parts = shortcut.toLowerCase().split(/\+(?!$)/);

  parts.forEach((rawPart, index) => {
    const part = rawPart.trim();
    const modifier = MODIFIER_ALIASES[part];

    // The last part is the key - "shift" alone is the Shift key
    if (modifier && index < parts.length - 1) {
      parsed[modifier === "mod" ? (isApple ? "meta" : "ctrl") : modifier] =
        true;
    } else {
      parsed.key = KEY_ALIASES[part] ?? (part || " ");
    }
  });

  return parsed;
}

const isLatinLetter = (key: string) => /^[a-z]$/.test(key);
const isDigit = (key: string) => /^[0-9]$/.test(key);

/**
 * Whether a `KeyboardEvent.key` is a character the layout types - not a key
 * of its own like "End" or "ArrowDown", which the numpad sends with NumLock
 * off. A dead key (⌥N on a Mac) waits for the character it accents.
 */
const typesCharacter = (key: string) =>
  [...key].length === 1 || key === "Dead" || key === "Unidentified";

/** A letter of another script than the Latin one - "л" of a Russian layout. */
const isOtherScriptLetter = (key: string) =>
  /^\p{L}$/u.test(key) && !/^\p{Script=Latin}$/u.test(key);

/**
 * Whether the key of an event is the key of a shortcut. A letter or a digit
 * also matches by its place on the keyboard (`event.code`) when the layout
 * types another character there - ⌥N types "˜" on a Mac, the 2 key types
 * "ě" on a Czech keyboard.
 */
function matchesKey(event: ShortcutEvent, key: string, isApple: boolean) {
  const eventKey = event.key.toLowerCase();
  if (eventKey === key) return true;

  // A key of its own is no letter or digit - the numpad keys with NumLock
  // off are End, ArrowDown, … even though their place is Numpad1, Numpad2
  if (!typesCharacter(event.key)) return false;

  // Windows reports AltGr as Ctrl + Alt: what it types there is text - "ś"
  // on a Polish keyboard, "@" on a Czech one - not Ctrl + Alt + S or V. A
  // layout of another script types its own letters with Ctrl + Alt, though
  // (Ctrl + Alt + K is "л" on a Russian keyboard).
  if (
    !isApple &&
    event.ctrlKey &&
    event.altKey &&
    !isOtherScriptLetter(event.key)
  ) {
    return false;
  }

  if (isLatinLetter(key) && !isLatinLetter(eventKey)) {
    return event.code === `Key${key.toUpperCase()}`;
  }

  // The numpad types digits on every layout - only the top row may not
  if (isDigit(key) && !isDigit(eventKey)) {
    return event.code === `Digit${key}`;
  }

  return false;
}

/**
 * Whether a keyboard event is a shortcut like "mod+k". The modifiers must
 * match exactly - "mod+k" is not "mod+shift+k" - except Shift for a symbol
 * written without it: "?" matches however the layout types a question mark.
 */
export function matchesShortcut(
  event: ShortcutEvent,
  shortcut: string | Shortcut,
  isApple = isApplePlatform(),
) {
  const { alt, ctrl, key, meta, shift } = toShortcut(shortcut, isApple);

  // A symbol like "?" or "/" needs Shift on some layouts only
  const isSymbol = key.length === 1 && !isLatinLetter(key) && !isDigit(key);
  const shiftMatches = event.shiftKey === shift || (isSymbol && !shift);

  return (
    event.altKey === alt &&
    event.ctrlKey === ctrl &&
    event.metaKey === meta &&
    shiftMatches &&
    matchesKey(event, key, isApple)
  );
}

// The symbols of the keys on Apple keyboards and in macOS menus
const APPLE_KEY_LABELS: Record<string, string> = {
  backspace: "⌫",
  delete: "⌦",
  // U+FE0E asks for the text glyph - macOS draws ↩ as an emoji otherwise
  enter: "↩\uFE0E",
  escape: "⎋",
  tab: "⇥",
};

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  delete: "Del",
  escape: "Esc",
  pagedown: "PgDn",
  pageup: "PgUp",
};

/** "k" → "K", "f2" → "F2", "home" → "Home" */
const capitalize = (key: string) =>
  /^(f\d{1,2}|.)$/.test(key)
    ? key.toUpperCase()
    : key.charAt(0).toUpperCase() + key.slice(1);

/**
 * The keys of a shortcut as the platform writes them, one label per key:
 * `["⌘", "⇧", "K"]` on a Mac (modifiers in the order of macOS menus),
 * `["Ctrl", "Shift", "K"]` elsewhere.
 */
export function getShortcutKeys(
  shortcut: string | Shortcut,
  isApple = isApplePlatform(),
) {
  const { alt, ctrl, key, meta, shift } = toShortcut(shortcut, isApple);

  const modifiers = isApple
    ? [ctrl && "⌃", alt && "⌥", shift && "⇧", meta && "⌘"]
    : [ctrl && "Ctrl", alt && "Alt", shift && "Shift", meta && "Win"];

  return [
    ...modifiers.filter((label) => label !== false),
    (isApple && APPLE_KEY_LABELS[key]) || KEY_LABELS[key] || capitalize(key),
  ];
}

/**
 * A shortcut as text in the platform's notation - "⌘⇧K" on a Mac,
 * "Ctrl+Shift+K" elsewhere. E.g. for a tooltip:
 * `` `Save (${formatShortcut("mod+s")})` ``.
 */
export function formatShortcut(
  shortcut: string | Shortcut,
  isApple = isApplePlatform(),
) {
  return getShortcutKeys(shortcut, isApple).join(isApple ? "" : "+");
}

// `aria-keyshortcuts` names keys by their `KeyboardEvent.key`
const ARIA_KEY_NAMES: Record<string, string> = {
  " ": "Space",
  "+": "Plus",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  arrowup: "ArrowUp",
  pagedown: "PageDown",
  pageup: "PageUp",
};

/**
 * A shortcut as the value of `aria-keyshortcuts` - "Meta+K" on a Mac,
 * "Control+K" elsewhere.
 */
export function toAriaKeyShortcuts(
  shortcut: string | Shortcut,
  isApple = isApplePlatform(),
) {
  const { alt, ctrl, key, meta, shift } = toShortcut(shortcut, isApple);

  return [
    ctrl && "Control",
    alt && "Alt",
    shift && "Shift",
    meta && "Meta",
    ARIA_KEY_NAMES[key] ?? capitalize(key),
  ]
    .filter(Boolean)
    .join("+");
}
