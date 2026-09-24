import type { RichTextFormat } from "../../utils/sanitize-rich-text";

/** A tool of the `RichTextEditor` toolbar. */
export type RichTextTool =
  | "blockquote"
  | "bold"
  | "bulletList"
  | "clearFormatting"
  | "code"
  | "heading2"
  | "heading3"
  | "horizontalRule"
  | "indent"
  | "italic"
  | "link"
  | "numberedList"
  | "outdent"
  | "paragraph"
  | "redo"
  | "strikethrough"
  | "table"
  | "underline"
  | "undo";

/** A tool of the toolbar, or `"|"` - a divider between groups of tools. */
export type RichTextToolbarItem = RichTextTool | "|";

/**
 * The toolbar of `RichTextEditor` when `toolbar` is left out - everything
 * but inline code, horizontal rules and tables.
 */
export const DEFAULT_RICH_TEXT_TOOLBAR: readonly RichTextToolbarItem[] = [
  "undo",
  "redo",
  "|",
  "paragraph",
  "heading2",
  "heading3",
  "|",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "|",
  "bulletList",
  "numberedList",
  "outdent",
  "indent",
  "|",
  "blockquote",
  "link",
  "|",
  "clearFormatting",
];

// The formatting each tool makes - what the value of the editor keeps
const FORMATS: readonly RichTextFormat[] = [
  "blockquote",
  "bold",
  "bulletList",
  "code",
  "heading2",
  "heading3",
  "horizontalRule",
  "italic",
  "link",
  "numberedList",
  "strikethrough",
  "table",
  "underline",
];

/** The formats the tools of a toolbar make. */
export const formatsOf = (toolbar: readonly RichTextToolbarItem[]) =>
  FORMATS.filter((format) => toolbar.includes(format));

const formatsByKeys = new Map<string, readonly RichTextFormat[]>();

/**
 * The formats of a key of `formatsOf(toolbar).join()` - the same array for
 * the same key.
 */
export function formatsByKey(key: string) {
  let formats = formatsByKeys.get(key);

  if (!formats) {
    formats = FORMATS.filter((format) => key.split(",").includes(format));
    formatsByKeys.set(key, formats);
  }
  return formats;
}

/** A keyboard shortcut - Ctrl (⌘ on Apple devices) with a key. */
export interface Shortcut {
  alt?: boolean;
  /** The key - a lower-case letter, a digit or `[`, `]`, `\`. */
  key: string;
  shift?: boolean;
}

export const UNDO_SHORTCUT: Shortcut = { key: "z" };
export const REDO_SHORTCUT: Shortcut = { key: "z", shift: true };

/** The shortcuts of the tools - undo and redo work also without their buttons. */
export const SHORTCUTS: Partial<Record<RichTextTool, Shortcut>> = {
  blockquote: { key: "9", shift: true },
  bold: { key: "b" },
  bulletList: { key: "8", shift: true },
  clearFormatting: { key: "\\" },
  code: { key: "e" },
  heading2: { alt: true, key: "2" },
  heading3: { alt: true, key: "3" },
  indent: { key: "]" },
  italic: { key: "i" },
  link: { key: "k" },
  numberedList: { key: "7", shift: true },
  outdent: { key: "[" },
  paragraph: { alt: true, key: "0" },
  redo: REDO_SHORTCUT,
  strikethrough: { key: "x", shift: true },
  underline: { key: "u" },
  undo: UNDO_SHORTCUT,
};

const CODE_KEYS: Record<string, string> = {
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
};

/**
 * The key of a shortcut an event is - digits and brackets by their place
 * on the keyboard, as Shift and Alt change what they type (Shift+7 is "&",
 * Option+2 "™" on a Mac); letters by the layout (the Z of a German
 * keyboard), or by their place on a layout of other letters (Cyrillic).
 */
function shortcutKey(event: KeyboardEvent | React.KeyboardEvent) {
  const { code } = event;
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (CODE_KEYS[code]) return CODE_KEYS[code];

  const key = event.key.toLowerCase();
  if (/^[a-z]$/.test(key) && !event.altKey) return key;
  return /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : key;
}

/** Whether a key press is the shortcut. */
export function isShortcut(
  event: KeyboardEvent | React.KeyboardEvent,
  shortcut: Shortcut,
  isApple: boolean,
) {
  const modifier = isApple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;

  return (
    modifier &&
    // AltGr (Ctrl+Alt on Windows) types characters - `{` on a German keyboard
    !event.getModifierState?.("AltGraph") &&
    event.altKey === !!shortcut.alt &&
    event.shiftKey === !!shortcut.shift &&
    shortcutKey(event) === shortcut.key
  );
}

/** Names of the modifier keys - see `Messages.richTextEditor.keys`. */
interface KeyNames {
  alt: string;
  ctrl: string;
  shift: string;
}

/** A shortcut as the keyboard labels it - "Ctrl+Shift+7", "⇧⌘7". */
export function formatShortcut(
  shortcut: Shortcut,
  isApple: boolean,
  names: KeyNames,
) {
  const key = shortcut.key.toUpperCase();

  // The order of the menus of macOS: Control, Option, Shift, Command
  if (isApple) {
    return `${shortcut.alt ? "⌥" : ""}${shortcut.shift ? "⇧" : ""}⌘${key}`;
  }
  return [
    names.ctrl,
    shortcut.alt && names.alt,
    shortcut.shift && names.shift,
    key,
  ]
    .filter(Boolean)
    .join("+");
}

/** A shortcut for `aria-keyshortcuts` - "Control+Shift+7". */
export function ariaShortcut(shortcut: Shortcut, isApple: boolean) {
  return [
    isApple ? "Meta" : "Control",
    shortcut.alt && "Alt",
    shortcut.shift && "Shift",
    shortcut.key.toUpperCase(),
  ]
    .filter(Boolean)
    .join("+");
}
