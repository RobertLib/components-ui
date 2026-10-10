import { createContext, use, useMemo } from "react";
import DefaultLink from "./default-link";
import { en } from "../i18n/ui/en";
import type { Locale, Messages } from "../i18n/ui/types";
import {
  browserBack,
  browserNavigate,
  useBrowserLocation,
  type RouterAdapter,
} from "./router";

/**
 * Where overlays are rendered - an element, or a function returning one
 * (read when an overlay opens). `null` or nothing is `document.body`.
 */
export type PortalContainer =
  HTMLElement | null | (() => HTMLElement | null | undefined);

export interface UIContextValue {
  locale: Locale;
  portalContainer?: PortalContainer;
  /** The router given - its location is in `RouterLocationContext`. */
  router?: Partial<Pick<RouterAdapter, "back" | "Link" | "navigate">>;
  /** Stable identity of the provider that configures navigation or location. */
  routerScope?: object;
}

export const UIContext = /* @__PURE__ */ createContext<UIContextValue | null>(
  null,
);

/**
 * What of the router of the nearest `UIProvider` stays the same on a
 * navigation, with the defaults filled in - so that a component rendering a
 * link or navigating does not render again on every change of the URL.
 */
export const RouterActionsContext = /* @__PURE__ */ createContext<Pick<
  RouterAdapter,
  "back" | "Link" | "navigate"
> | null>(null);

/**
 * The location the router of the nearest `UIProvider` gives - apart from
 * `UIContext`, so that a navigation renders again only what reads it
 * (`useRouter`), not every component with a text, a locale or a portal.
 */
export const RouterLocationContext = /* @__PURE__ */ createContext<Partial<
  Pick<RouterAdapter, "pathname" | "search">
> | null>(null);

// Without a custom router, every hook uses the same browser history.
const browserRouterScope = {};

/** Internal identity for state shared by the hooks of one router. */
export function useRouterScope(): object {
  return use(UIContext)?.routerScope ?? browserRouterScope;
}

/** The active locale (texts, formats, first day of the week). */
export function useLocale(): Locale {
  return use(UIContext)?.locale ?? en;
}

/**
 * The element the overlays of the library (popovers, tooltips, menus,
 * dialogs, toasts) are rendered into - `portalContainer` of `UIProvider`,
 * `document.body` by default. Returns a getter: call it when rendering the
 * portal, not on the server.
 */
export function usePortalContainer(): () => HTMLElement {
  const container = use(UIContext)?.portalContainer;

  return () =>
    (typeof container === "function" ? container() : container) ??
    document.body;
}

/** Application texts at the root; library texts are in `useMessages().ui`. */
export function useMessages(): Messages {
  return useLocale().messages;
}

const browserActions: Pick<RouterAdapter, "back" | "Link" | "navigate"> = {
  back: browserBack,
  Link: DefaultLink,
  navigate: browserNavigate,
};

/**
 * `back`, `Link` and `navigate` of the router adapter, without reading the
 * location - unlike `useRouter`, the component does not render again on
 * every change of the URL.
 */
export function useRouterActions(): Pick<
  RouterAdapter,
  "back" | "Link" | "navigate"
> {
  return use(RouterActionsContext) ?? browserActions;
}

/** `navigate` of the router adapter - see `useRouterActions`. */
export function useNavigate(): RouterAdapter["navigate"] {
  return useRouterActions().navigate;
}

/** The router adapter with the defaults filled in. */
export function useRouter(): RouterAdapter {
  const location = use(RouterLocationContext);
  // The URL of the page only for what the router does not give
  const browserLocation = useBrowserLocation(
    location?.pathname === undefined || location.search === undefined,
  );
  const { back, Link, navigate } = useRouterActions();

  const pathname = location?.pathname ?? browserLocation.pathname;
  const search = location?.search ?? browserLocation.search;

  return useMemo(
    () => ({ back, Link, navigate, pathname, search }),
    [back, Link, navigate, pathname, search],
  );
}
