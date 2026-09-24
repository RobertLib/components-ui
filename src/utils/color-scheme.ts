import type {
  ColorScheme,
  UseColorSchemeOptions,
} from "../hooks/use-color-scheme";

// Without React, so that server components (Next.js App Router) can call
// getColorSchemeScript - useColorScheme shares the rest

export const DEFAULT_COLOR_SCHEME_STORAGE_KEY = "color-scheme";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const isColorScheme = (value: unknown): value is ColorScheme =>
  value === "light" || value === "dark" || value === "system";

// Text in a <script> element must not close it
const toScriptString = (value: string) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * The source of a small script that applies the remembered color scheme
 * before the page is painted - for the `<head>` of an `index.html`, or of
 * a server-rendered page (`ColorSchemeScript` renders it). Without it, a
 * dark page flashes light until the app has loaded. Pass the options of
 * `useColorScheme`.
 */
export function getColorSchemeScript({
  defaultColorScheme = "system",
  storageKey = DEFAULT_COLOR_SCHEME_STORAGE_KEY,
}: UseColorSchemeOptions = {}) {
  const fallback = isColorScheme(defaultColorScheme)
    ? defaultColorScheme
    : "system";

  return [
    "(function(){",
    `try{var s=localStorage.getItem(${toScriptString(storageKey)})}catch(e){}`,
    `if(s!=="light"&&s!=="dark"&&s!=="system")s=${toScriptString(fallback)};`,
    `try{var d=s==="dark"||(s==="system"&&matchMedia(${toScriptString(DARK_QUERY)}).matches),r=document.documentElement;`,
    `r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}`,
    "})()",
  ].join("");
}
