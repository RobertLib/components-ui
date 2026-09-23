import type { DeepPartial, Locale, PluralMessage } from "./types";

type MessageParams = Record<string, string | number>;

/**
 * Fills the `{name}` placeholders of a message. Unknown placeholders are left
 * as they are, so a missing parameter is visible instead of silently empty.
 */
export function formatMessage(template: string, params?: MessageParams) {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in params ? String(params[key]) : placeholder,
  );
}

const pluralRules = new Map<string, Intl.PluralRules>();

/** The form of `message` the rules of the language use for `count`. */
export function pluralForm(
  localeCode: string,
  message: PluralMessage,
  count: number,
) {
  let rules = pluralRules.get(localeCode);

  if (!rules) {
    rules = new Intl.PluralRules(localeCode);
    pluralRules.set(localeCode, rules);
  }

  return message[rules.select(count)] ?? message.other;
}

/**
 * Picks the plural form of `message` for `count` by the rules of the language
 * and fills in `{count}` along with any other `params`.
 */
export function formatPlural(
  localeCode: string,
  message: PluralMessage,
  count: number,
  params?: MessageParams,
) {
  return formatMessage(pluralForm(localeCode, message, count), {
    count,
    ...params,
  });
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Deep merge of plain objects - arrays and other values are replaced. */
export function deepMerge<T>(base: T, overrides?: DeepPartial<T>): T {
  if (!overrides) return base;

  const result = { ...base } as Record<string, unknown>;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;

    const current = result[key];
    result[key] =
      isPlainObject(current) && isPlainObject(value)
        ? deepMerge(current, value)
        : value;
  }

  return result as T;
}

/**
 * Derives a locale from an existing one, e.g. British English from the
 * built-in `en`:
 *
 * ```ts
 * const enGB = createLocale(en, {
 *   code: "en-GB",
 *   weekStartsOn: 1,
 *   formats: { date: "DD/MM/YYYY", dateTime: "DD/MM/YYYY HH:mm" },
 * });
 * ```
 */
export function createLocale(base: Locale, overrides: DeepPartial<Locale>) {
  return deepMerge(base, overrides);
}
