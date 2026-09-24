import { useLayoutEffect } from "react";
import useIsHydrated from "./use-is-hydrated";
import useLocalStorage from "./use-local-storage";
import useMediaQuery from "./use-media-query";
import {
  DARK_QUERY,
  DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  isColorScheme,
} from "../utils/color-scheme";

export {
  DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  getColorSchemeScript,
} from "../utils/color-scheme";

/** The color scheme the user chose - `system` follows the operating system. */
export type ColorScheme = "light" | "dark" | "system";

/** The color scheme the page shows. */
export type ResolvedColorScheme = "light" | "dark";

/** Options of `useColorScheme` - pass the same to `ColorSchemeScript`. */
export interface UseColorSchemeOptions {
  /**
   * The scheme until the user chooses one.
   * @default "system"
   */
  defaultColorScheme?: ColorScheme;
  /**
   * `localStorage` key the choice is remembered under.
   * @default "color-scheme"
   */
  storageKey?: string;
}

/** What `useColorScheme` returns. */
export interface UseColorSchemeResult {
  /** The chosen scheme. */
  colorScheme: ColorScheme;
  /** The scheme the page shows - that of the system for `system`. */
  resolvedColorScheme: ResolvedColorScheme;
  /** Chooses a scheme, remembers it and applies it. */
  setColorScheme: (colorScheme: ColorScheme) => void;
}

// The choice is stored as plain text, which the script of
// `getColorSchemeScript` reads before any of the app has loaded
const serialize = (colorScheme: ColorScheme) => colorScheme;

function deserialize(stored: string): ColorScheme {
  if (!isColorScheme(stored)) {
    throw new Error(`"${stored}" is no color scheme`);
  }
  return stored;
}

/** Shows `colorScheme` - the `dark` class of `<html>` and `color-scheme`. */
function applyColorScheme(colorScheme: ResolvedColorScheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", colorScheme === "dark");
  root.style.colorScheme = colorScheme;
}

/**
 * The color scheme of the page - light, dark or that of the system - which
 * the user chooses, e.g. with `ColorSchemeToggle`. The choice is remembered
 * in `localStorage` and shown as the `dark` class of `<html>` (the
 * class-based dark mode of Tailwind, see Theming) and its `color-scheme`.
 * While it is `system`, the page follows the system setting as it changes.
 *
 * Every component using it applies the scheme, and the hooks with the same
 * `storageKey` share it - keep one mounted all the time (in the app layout),
 * so the page follows the system. Against a flash of the wrong scheme
 * before the app loads, put `ColorSchemeScript` (or the script of
 * `getColorSchemeScript`) into the `<head>` of the page.
 */
export default function useColorScheme({
  defaultColorScheme = "system",
  storageKey = DEFAULT_COLOR_SCHEME_STORAGE_KEY,
}: UseColorSchemeOptions = {}): UseColorSchemeResult {
  const [colorScheme, setColorScheme] = useLocalStorage<ColorScheme>(
    storageKey,
    defaultColorScheme,
    { deserialize, serialize },
  );
  const systemIsDark = useMediaQuery(DARK_QUERY);
  const isHydrated = useIsHydrated();

  const resolvedColorScheme: ResolvedColorScheme =
    colorScheme === "system" ? (systemIsDark ? "dark" : "light") : colorScheme;

  // Before the browser paints. Not with what the server rendered - that
  // would undo what the script applied, until the page has hydrated.
  useLayoutEffect(() => {
    if (isHydrated) applyColorScheme(resolvedColorScheme);
  }, [isHydrated, resolvedColorScheme]);

  return {
    colorScheme,
    resolvedColorScheme,
    setColorScheme: (next: ColorScheme) => setColorScheme(next),
  };
}
