/**
 * The path of a link in the app, for its router - or `null` for a URL the
 * browser has to load: one with a scheme (`https:`, `mailto:`) or a host
 * (`//host`, also `/\host`, which the browser reads as one). Also a URL of
 * the page's own origin - its path is of the document, with the base path
 * of a router (`basename`), which takes paths without it.
 *
 * The path as the browser reads the link - without the spaces and control
 * characters around it, nor the tabs and line breaks in it, which a router
 * would keep (` /orders` is a path relative to the page for it).
 */
export default function toAppPath(href: string): string | null {
  // What the URL parser drops first, as the browser does for a link
  const path = href
    // eslint-disable-next-line no-control-regex
    .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, "")
    .replace(/[\t\n\r]/g, "");

  if (/^([a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return null;
  if (typeof window === "undefined") return path;

  try {
    // Another origin, as the browser reads it - `/\host`, ` //host`
    const url = new URL(path, window.location.href);
    return url.origin === window.location.origin ? path : null;
  } catch {
    return null;
  }
}
