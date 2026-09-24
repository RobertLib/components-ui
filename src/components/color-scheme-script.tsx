import type { UseColorSchemeOptions } from "../hooks/use-color-scheme";
import { getColorSchemeScript } from "../utils/color-scheme";

export interface ColorSchemeScriptProps extends UseColorSchemeOptions {
  /** The nonce of a Content Security Policy that allows inline scripts only with it. */
  nonce?: string;
}

/**
 * An inline script for the `<head>` of a server-rendered page (Next.js,
 * Remix, …) that applies the color scheme remembered by `useColorScheme`
 * before the page is painted - so a dark page does not flash light. Pass
 * the options of `useColorScheme`. It runs only as part of the server's
 * HTML - a page rendered in the browser needs the script of
 * `getColorSchemeScript` in its `index.html`.
 */
export default function ColorSchemeScript({
  nonce,
  ...options
}: ColorSchemeScriptProps) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: getColorSchemeScript(options) }}
      nonce={nonce}
    />
  );
}
