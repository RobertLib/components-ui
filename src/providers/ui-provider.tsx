import { use, useInsertionEffect, useMemo, useRef, useState } from "react";
import { deepMerge, toIntlLocale } from "../i18n/ui/format";
import { en } from "../i18n/ui/en";
import type { DeepPartial, Locale, Messages } from "../i18n/ui/types";
import DefaultLink from "./default-link";
import {
  browserBack,
  browserNavigate,
  notifyLocationChange,
  type RouterAdapter,
} from "./router";
import {
  RouterActionsContext,
  RouterLocationContext,
  PortalContainerContext,
  UIContext,
  type PortalContainer,
} from "./ui-context";

export interface UIProviderProps {
  /** The part of the app the configuration applies to - usually all of it. */
  children: React.ReactNode;
  /**
   * Texts, date formats and the first day of the week - the built-in `en`
   * and `cs`, or a locale of your own (see `createLocale`). Defaults to the
   * locale of a surrounding `UIProvider`, or `en`.
   */
  locale?: Locale;
  /** Overrides app texts at the root and library texts under `ui`. */
  messages?: DeepPartial<Messages>;
  /**
   * Where popovers, tooltips, menus, dialogs, sheets, toasts and backdrops
   * are rendered - `document.body` by default. Give an element of the page
   * (or a function returning one) for an app inside a shadow root or a
   * fullscreen element. Inherited from a surrounding `UIProvider`; `null`
   * goes back to `document.body`.
   */
  portalContainer?: PortalContainer;
  /**
   * Connects the components to the app's router. Leave it out to use plain
   * `<a>` links and the History API. Parts left out are taken from a
   * surrounding `UIProvider`.
   */
  router?: Partial<RouterAdapter>;
}

/**
 * Configures all components below it. Optional - without it the components
 * use English and plain links - but most apps render it once at the root.
 * A nested provider changes only what it is given, e.g. the language of one
 * part of the page.
 */
export default function UIProvider({
  children,
  locale,
  messages,
  portalContainer,
  router,
}: UIProviderProps) {
  const parent = use(UIContext);
  const parentLocation = use(RouterLocationContext);
  const parentContainer = use(PortalContainerContext);
  const baseLocale = locale ?? parent?.locale ?? en;

  // Compared by value - inline `messages` would give all that reads a text
  // a new locale on every render of the provider (every navigation, with a
  // router adapter)
  const messagesKey = messages ? JSON.stringify(messages) : undefined;
  const stableMessages = useMemo(
    () =>
      messagesKey === undefined
        ? undefined
        : (JSON.parse(messagesKey) as DeepPartial<Messages>),
    [messagesKey],
  );

  const resolvedLocale = useMemo(() => {
    // The components hand the code to `Intl`, which throws on one it does
    // not understand ("en_GB") - such a code falls back with a warning
    const code = toIntlLocale(baseLocale.code);
    const valid =
      code === baseLocale.code ? baseLocale : { ...baseLocale, code };

    return stableMessages
      ? { ...valid, messages: deepMerge(valid.messages, stableMessages) }
      : valid;
  }, [baseLocale, stableMessages]);

  const Link = router?.Link ?? parent?.router?.Link;
  const pathname = router?.pathname ?? parentLocation?.pathname;
  const search = router?.search ?? parentLocation?.search;
  const navigate = router?.navigate ?? parent?.router?.navigate;
  const back = router?.back ?? parent?.router?.back;

  // Inline adapters change identity on every render. Their shared state
  // belongs to this provider; locale, link and back overrides inherit it.
  const [ownRouterScope] = useState(() => ({}));
  const routerScope =
    router?.navigate !== undefined ||
    router?.pathname !== undefined ||
    router?.search !== undefined
      ? ownRouterScope
      : parent?.routerScope;

  // Portals call the current getter during their render, before insertion
  // effects run. A separate context keeps locale-only consumers stable.
  const container =
    portalContainer === undefined ? parentContainer : portalContainer;

  // The components get a `navigate` and a `back` that stay the same,
  // calling the latest ones given - a router's may change on every
  // navigation (React Router's does), an inline one on every render, and
  // each change would render again all that navigates. Before the effects
  // of the children, which may navigate already.
  const latest = useRef({ back, navigate });
  useInsertionEffect(() => {
    latest.current = { back, navigate };
  });
  const hasNavigate = navigate !== undefined;
  const hasBack = back !== undefined;
  // A router given without its `pathname` / `search` changes the URL behind
  // the back of `useBrowserLocation` - only the Navigation API would tell
  // it, which not every browser has. Read the URL again after it navigates,
  // also once more later for a router that changes it asynchronously.
  const tracksLocation = pathname === undefined || search === undefined;
  const stableNavigate = useMemo<RouterAdapter["navigate"]>(() => {
    if (!hasNavigate) return browserNavigate;

    // The arguments as they come - a router may tell apart none and
    // `undefined`
    return (...args) => {
      latest.current.navigate?.(...args);
      if (tracksLocation) {
        notifyLocationChange();
        setTimeout(notifyLocationChange);
      }
    };
  }, [hasNavigate, tracksLocation]);
  const stableBack = useMemo<RouterAdapter["back"]>(
    () => (hasBack ? () => latest.current.back?.() : browserBack),
    [hasBack],
  );

  const value = useMemo(
    () => ({
      locale: resolvedLocale,
      // A nested provider takes them over - the stable ones too. Not the
      // location, which changes on every navigation: all that reads a text
      // would render again with it.
      router: { Link, navigate: stableNavigate, back: stableBack },
      routerScope,
    }),
    [resolvedLocale, Link, stableNavigate, stableBack, routerScope],
  );
  const location = useMemo(() => ({ pathname, search }), [pathname, search]);
  const actions = useMemo(
    () => ({
      back: stableBack,
      Link: Link ?? DefaultLink,
      navigate: stableNavigate,
    }),
    [Link, stableBack, stableNavigate],
  );

  return (
    <UIContext value={value}>
      <PortalContainerContext value={container}>
        <RouterActionsContext value={actions}>
          <RouterLocationContext value={location}>
            {children}
          </RouterLocationContext>
        </RouterActionsContext>
      </PortalContainerContext>
    </UIContext>
  );
}
