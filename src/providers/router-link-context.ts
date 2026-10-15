import { createContext } from "react";
import type { RouterLocation } from "./navigation-guard";
import type { LinkComponent, NavigateOptions } from "./router";

/** The router `GuardedLink` renders the links of - set by `UIProvider`. */
export interface RouterLinkContextValue {
  /** The location the router gives - `null` without one: the page's. */
  getLocation: () => RouterLocation | null;
  /** The `Link` of the router - a plain `<a>` without one. */
  Link: LinkComponent;
  /** The `navigate` of the router - `undefined` without one. */
  navigate?: (href: string, options?: NavigateOptions) => void;
}

export const RouterLinkContext =
  /* @__PURE__ */ createContext<RouterLinkContextValue | null>(null);
