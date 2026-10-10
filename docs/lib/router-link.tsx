import { Link, useLocation } from "react-router";
import type { LinkComponentProps } from "components-ui";

/**
 * The library's links rendered by React Router - defined once at module
 * level, so its identity never changes (a component created during render
 * would remount every link on each navigation).
 */
export default function RouterLink({ href, ...props }: LinkComponentProps) {
  const { pathname, search, hash } = useLocation();
  if (/^\s*(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) {
    return <Link to={href} {...props} />;
  }
  // Resolve relative URLs like an <a>, matching the library's active links.
  // The router's path excludes its basename, which Link adds back itself.
  const current = new URL("http://router");
  current.pathname = pathname;
  current.search = search;
  current.hash = hash;
  const url = new URL(href, current);
  const to =
    url.origin !== current.origin
      ? href
      : `${url.pathname}${url.search}${url.hash}`;

  return <Link to={to} {...props} />;
}
