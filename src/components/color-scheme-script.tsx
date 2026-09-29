import type { UseColorSchemeOptions } from "../hooks/use-color-scheme";
import { getColorSchemeScript } from "../utils/color-scheme";

export interface ColorSchemeScriptProps
  extends
    Omit<
      React.ComponentProps<"script">,
      "children" | "dangerouslySetInnerHTML" | "src"
    >,
    UseColorSchemeOptions {
  /** The nonce of a Content Security Policy that allows inline scripts only with it. */
  nonce?: string;
}

/**
 * An inline script for the `<head>` of a server-rendered page (Next.js,
 * Remix, …) that applies the color scheme remembered by `useColorScheme`
 * before the page is painted - so a dark page does not flash light. Pass
 * the options of `useColorScheme`. It runs only as part of the server's
 * HTML - a page rendered in the browser needs the script of
 * `getColorSchemeScript` in its `index.html`. `ref` and the other props go
 * to the `<script>`.
 */
export default function ColorSchemeScript({
  defaultColorScheme,
  nonce,
  storageKey,
  ...props
}: ColorSchemeScriptProps) {
  return (
    <script
      {...props}
      dangerouslySetInnerHTML={{
        __html: getColorSchemeScript({ defaultColorScheme, storageKey }),
      }}
      nonce={nonce}
    />
  );
}
