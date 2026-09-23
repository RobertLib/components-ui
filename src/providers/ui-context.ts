import { createContext, use, useMemo } from "react";
import DefaultLink from "./default-link";
import { en } from "../i18n/en";
import type { Locale, Messages } from "../i18n/types";
import {
  browserBack,
  browserNavigate,
  notifyLocationChange,
  useBrowserLocation,
  type RouterAdapter,
} from "./router";

export interface UIContextValue {
  locale: Locale;
  router?: Partial<RouterAdapter>;
}

export const UIContext = createContext<UIContextValue | null>(null);

/** The active locale (texts, formats, first day of the week). */
export function useLocale(): Locale {
  return use(UIContext)?.locale ?? en;
}

/** The texts of the active locale. */
export function useMessages(): Messages {
  return useLocale().messages;
}

/** The router adapter with the defaults filled in. */
export function useRouter(): RouterAdapter {
  const router = use(UIContext)?.router;
  const browserLocation = useBrowserLocation();

  const Link = router?.Link ?? DefaultLink;
  const pathname = router?.pathname ?? browserLocation.pathname;
  const search = router?.search ?? browserLocation.search;
  const back = router?.back ?? browserBack;

  // A router given without its `pathname` / `search` changes the URL behind
  // the back of `useBrowserLocation` - only the Navigation API would tell
  // it, which not every browser has. Read the URL again after it navigates,
  // also once more later for a router that changes it asynchronously.
  const routerNavigate = router?.navigate;
  const tracksLocation =
    router?.pathname === undefined || router?.search === undefined;

  const navigate = useMemo<RouterAdapter["navigate"]>(() => {
    if (!routerNavigate) return browserNavigate;
    if (!tracksLocation) return routerNavigate;

    return (href, options) => {
      routerNavigate(href, options);
      notifyLocationChange();
      setTimeout(notifyLocationChange);
    };
  }, [routerNavigate, tracksLocation]);

  return useMemo(
    () => ({ back, Link, navigate, pathname, search }),
    [back, Link, navigate, pathname, search],
  );
}
