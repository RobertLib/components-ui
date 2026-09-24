import { use, useMemo } from "react";
import { deepMerge, toIntlLocale } from "../i18n/format";
import { en } from "../i18n/en";
import type { DeepPartial, Locale, Messages } from "../i18n/types";
import type { RouterAdapter } from "./router";
import { UIContext } from "./ui-context";

export interface UIProviderProps {
  /** The part of the app the configuration applies to - usually all of it. */
  children: React.ReactNode;
  /**
   * Texts, date formats and the first day of the week - the built-in `en`
   * and `cs`, or a locale of your own (see `createLocale`). Defaults to the
   * locale of a surrounding `UIProvider`, or `en`.
   */
  locale?: Locale;
  /** Overrides individual texts of `locale`. */
  messages?: DeepPartial<Messages>;
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
  router,
}: UIProviderProps) {
  const parent = use(UIContext);
  const baseLocale = locale ?? parent?.locale ?? en;

  const resolvedLocale = useMemo(() => {
    // The components hand the code to `Intl`, which throws on one it does
    // not understand ("en_GB") - such a code falls back with a warning
    const code = toIntlLocale(baseLocale.code);
    const valid =
      code === baseLocale.code ? baseLocale : { ...baseLocale, code };

    return messages
      ? { ...valid, messages: deepMerge(valid.messages, messages) }
      : valid;
  }, [baseLocale, messages]);

  const Link = router?.Link ?? parent?.router?.Link;
  const pathname = router?.pathname ?? parent?.router?.pathname;
  const search = router?.search ?? parent?.router?.search;
  const navigate = router?.navigate ?? parent?.router?.navigate;
  const back = router?.back ?? parent?.router?.back;

  const value = useMemo(
    () => ({
      locale: resolvedLocale,
      router: { Link, pathname, search, navigate, back },
    }),
    [resolvedLocale, Link, pathname, search, navigate, back],
  );

  return <UIContext value={value}>{children}</UIContext>;
}
