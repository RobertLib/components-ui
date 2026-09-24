import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatShortcut,
  getShortcutKeys,
  isApplePlatform,
  matchesShortcut,
  parseShortcut,
  toAriaKeyShortcuts,
  type ShortcutEvent,
} from "./shortcut";

const press = (key: string, init: Partial<ShortcutEvent> = {}) => ({
  altKey: false,
  ctrlKey: false,
  key,
  metaKey: false,
  shiftKey: false,
  ...init,
});

describe("parseShortcut", () => {
  it("resolves mod by the platform", () => {
    expect(parseShortcut("mod+k", true)).toEqual({
      alt: false,
      ctrl: false,
      key: "k",
      meta: true,
      shift: false,
    });
    expect(parseShortcut("mod+k", false)).toMatchObject({
      ctrl: true,
      meta: false,
    });
  });

  it("reads the aliases of modifiers and keys in any case", () => {
    expect(parseShortcut("Cmd+Option+Shift+Esc", false)).toEqual({
      alt: true,
      ctrl: false,
      key: "escape",
      meta: true,
      shift: true,
    });
    expect(parseShortcut("control+space").key).toBe(" ");
    expect(parseShortcut("ctrl+up").key).toBe("arrowup");
    expect(parseShortcut("return").key).toBe("enter");
  });

  it("takes a trailing plus for the plus key", () => {
    expect(parseShortcut("mod++", false)).toMatchObject({
      ctrl: true,
      key: "+",
    });
    expect(parseShortcut("+").key).toBe("+");
    expect(parseShortcut("ctrl+plus").key).toBe("+");
  });

  it("takes a lone modifier for its key", () => {
    expect(parseShortcut("shift")).toMatchObject({
      key: "shift",
      shift: false,
    });
  });
});

describe("matchesShortcut", () => {
  it("requires exactly the modifiers of the shortcut", () => {
    expect(matchesShortcut(press("k", { ctrlKey: true }), "mod+k", false)).toBe(
      true,
    );
    expect(matchesShortcut(press("k", { metaKey: true }), "mod+k", true)).toBe(
      true,
    );
    expect(matchesShortcut(press("k", { metaKey: true }), "mod+k", false)).toBe(
      false,
    );
    expect(
      matchesShortcut(
        press("K", { ctrlKey: true, shiftKey: true }),
        "mod+k",
        false,
      ),
    ).toBe(false);
    expect(matchesShortcut(press("k"), "mod+k", false)).toBe(false);
  });

  it("matches letters in any case", () => {
    expect(
      matchesShortcut(
        press("K", { ctrlKey: true, shiftKey: true }),
        "ctrl+shift+k",
      ),
    ).toBe(true);
  });

  it("ignores Shift for a symbol written without it", () => {
    expect(matchesShortcut(press("?", { shiftKey: true }), "?")).toBe(true);
    expect(matchesShortcut(press("?"), "?")).toBe(true);
    expect(matchesShortcut(press("?"), "shift+?")).toBe(false);
  });

  it("requires Shift to match for named keys", () => {
    expect(matchesShortcut(press("Enter", { shiftKey: true }), "enter")).toBe(
      false,
    );
    expect(
      matchesShortcut(press("Enter", { shiftKey: true }), "shift+enter"),
    ).toBe(true);
  });

  it("matches a letter by its place when the layout types another character", () => {
    // ⌥N on a Mac types a dead key
    expect(
      matchesShortcut(
        press("˜", { altKey: true, code: "KeyN" }),
        "alt+n",
        true,
      ),
    ).toBe(true);
    // A Cyrillic layout
    expect(
      matchesShortcut(press("л", { code: "KeyK", ctrlKey: true }), "ctrl+k"),
    ).toBe(true);
    // A Latin letter decides by itself - a QWERTZ Z sits where QWERTY has Y
    expect(
      matchesShortcut(press("z", { code: "KeyY", ctrlKey: true }), "ctrl+y"),
    ).toBe(false);
  });

  it("matches a digit by its place on a Czech keyboard", () => {
    expect(
      matchesShortcut(press("ě", { code: "Digit2", ctrlKey: true }), "ctrl+2"),
    ).toBe(true);
    expect(matchesShortcut(press("2", { code: "Numpad2" }), "2")).toBe(true);
    expect(matchesShortcut(press("š", { code: "Digit3" }), "2")).toBe(false);
  });

  it("takes the numpad keys of NumLock off for what they are", () => {
    // End and ArrowDown - not the digits 1 and 2 printed on the keys
    expect(matchesShortcut(press("End", { code: "Numpad1" }), "1", false)).toBe(
      false,
    );
    expect(
      matchesShortcut(press("ArrowDown", { code: "Numpad2" }), "2", false),
    ).toBe(false);
    expect(
      matchesShortcut(press("ArrowDown", { code: "Numpad2" }), "arrowdown"),
    ).toBe(true);
  });

  it("takes text typed with AltGr for text, not for Ctrl + Alt", () => {
    // Windows reports AltGr as Ctrl + Alt - "@" on a Czech keyboard, "ś" on
    // a Polish one
    expect(
      matchesShortcut(
        press("@", { altKey: true, code: "KeyV", ctrlKey: true }),
        "mod+alt+v",
        false,
      ),
    ).toBe(false);
    expect(
      matchesShortcut(
        press("ś", { altKey: true, code: "KeyS", ctrlKey: true }),
        "ctrl+alt+s",
        false,
      ),
    ).toBe(false);
    // …and a dead key, "ˇ" of AltGr + 2 on a Czech keyboard
    expect(
      matchesShortcut(
        press("Dead", { altKey: true, code: "Digit2", ctrlKey: true }),
        "ctrl+alt+2",
        false,
      ),
    ).toBe(false);
    // A letter of another script is still the key of its place
    expect(
      matchesShortcut(
        press("л", { altKey: true, code: "KeyK", ctrlKey: true }),
        "ctrl+alt+k",
        false,
      ),
    ).toBe(true);
    // On a Mac ⌃⌥ is no AltGr
    expect(
      matchesShortcut(
        press("˜", { altKey: true, code: "KeyN", ctrlKey: true }),
        "ctrl+alt+n",
        true,
      ),
    ).toBe(true);
  });

  it("accepts a parsed shortcut", () => {
    expect(matchesShortcut(press("Escape"), parseShortcut("esc"), false)).toBe(
      true,
    );
  });
});

describe("formatting", () => {
  it("writes the keys in the notation of the platform", () => {
    expect(getShortcutKeys("mod+shift+k", true)).toEqual(["⇧", "⌘", "K"]);
    expect(getShortcutKeys("mod+shift+k", false)).toEqual([
      "Ctrl",
      "Shift",
      "K",
    ]);
    expect(formatShortcut("mod+shift+k", true)).toBe("⇧⌘K");
    expect(formatShortcut("mod+shift+k", false)).toBe("Ctrl+Shift+K");
  });

  it("orders the modifiers like the platform's menus", () => {
    expect(formatShortcut("meta+shift+alt+ctrl+a", true)).toBe("⌃⌥⇧⌘A");
    expect(formatShortcut("meta+shift+alt+ctrl+a", false)).toBe(
      "Ctrl+Alt+Shift+Win+A",
    );
  });

  it("labels the named keys", () => {
    expect(formatShortcut("mod+enter", true)).toBe("⌘↩\uFE0E");
    expect(formatShortcut("mod+enter", false)).toBe("Ctrl+Enter");
    expect(formatShortcut("esc", false)).toBe("Esc");
    expect(formatShortcut("shift+space", false)).toBe("Shift+Space");
    expect(formatShortcut("alt+arrowup", false)).toBe("Alt+↑");
    expect(formatShortcut("f2", false)).toBe("F2");
    expect(formatShortcut("home", false)).toBe("Home");
    expect(formatShortcut("mod++", false)).toBe("Ctrl++");
  });

  it("builds the value of aria-keyshortcuts", () => {
    expect(toAriaKeyShortcuts("mod+shift+k", true)).toBe("Shift+Meta+K");
    expect(toAriaKeyShortcuts("mod+k", false)).toBe("Control+K");
    expect(toAriaKeyShortcuts("alt+arrowup")).toBe("Alt+ArrowUp");
    expect(toAriaKeyShortcuts("escape")).toBe("Escape");
    expect(toAriaKeyShortcuts("ctrl+space")).toBe("Control+Space");
    expect(toAriaKeyShortcuts("ctrl+plus")).toBe("Control+Plus");
  });
});

describe("isApplePlatform", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects Apple platforms", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(isApplePlatform()).toBe(true);

    vi.stubGlobal("navigator", { platform: "iPhone" });
    expect(isApplePlatform()).toBe(true);

    vi.stubGlobal("navigator", { platform: "Win32" });
    expect(isApplePlatform()).toBe(false);
  });

  it("prefers the user agent data", () => {
    vi.stubGlobal("navigator", {
      platform: "",
      userAgentData: { platform: "macOS" },
    });
    expect(isApplePlatform()).toBe(true);
  });

  it("is false without a navigator - on the server", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isApplePlatform()).toBe(false);
  });
});
