import logger from "../utils/logger";
import type { DeepPartial, Locale, PluralMessage } from "./types";

type MessageParams = Record<string, string | number>;

// What a locale code `Intl` does not understand is replaced with
const FALLBACK_LOCALE_CODE = "en-US";

const intlLocaleCodes = new Map<string, string>();

/**
 * `code` in the form `Intl` takes - or `en-US` when it is no valid language
 * tag (`"en_GB"`, `""`), with a warning. Such a code would make every
 * `Intl` call throw, and so crash the render of a component. Checked once
 * per code.
 */
export function toIntlLocale(code: string) {
  let resolved = intlLocaleCodes.get(code);

  if (resolved === undefined) {
    try {
      resolved = Intl.getCanonicalLocales(code)[0];
    } catch {
      // Not a language tag - replaced below
    }

    if (!resolved) {
      logger.warn(
        `The locale code "${code}" is no valid language tag (like "en-GB") - "${FALLBACK_LOCALE_CODE}" is used instead.`,
      );
      resolved = FALLBACK_LOCALE_CODE;
    }

    intlLocaleCodes.set(code, resolved);
  }

  return resolved;
}

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
    rules = new Intl.PluralRules(toIntlLocale(localeCode));
    pluralRules.set(localeCode, rules);
  }

  return message[rules.select(count)] ?? message.other;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

/** A number as the language writes it - "12,345" in English, "12 345" in Czech. */
export function formatNumber(localeCode: string, value: number) {
  let format = numberFormats.get(localeCode);

  if (!format) {
    format = new Intl.NumberFormat(toIntlLocale(localeCode));
    numberFormats.set(localeCode, format);
  }

  return format.format(value);
}

/**
 * Picks the plural form of `message` for `count` by the rules of the language
 * and fills in `{count}` - written as the language writes numbers - along
 * with any other `params`.
 */
export function formatPlural(
  localeCode: string,
  message: PluralMessage,
  count: number,
  params?: MessageParams,
) {
  return formatMessage(pluralForm(localeCode, message, count), {
    count: formatNumber(localeCode, count),
    ...params,
  });
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const PLURAL_CATEGORIES: ReadonlySet<string> = new Set<Intl.LDMLPluralRule>([
  "few",
  "many",
  "one",
  "other",
  "two",
  "zero",
]);

// A text with plural forms given with its `other` form is one text: merged
// form by form, the forms the override leaves out would stay in the
// language of the base
const isPluralMessage = (value: Record<string, unknown>) =>
  typeof value.other === "string" &&
  Object.keys(value).every((key) => PLURAL_CATEGORIES.has(key));

/**
 * Deep merge of plain objects - arrays and other values are replaced, and
 * so is a plural message by one given with its `other` form. `undefined`
 * and `null` keep the value of the base: translation tools export a text
 * nobody translated yet as `null`.
 */
export function deepMerge<T>(base: T, overrides?: DeepPartial<T>): T {
  if (!overrides) return base;

  const result = { ...base } as Record<string, unknown>;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) continue;

    const current = result[key];
    result[key] =
      isPlainObject(current) &&
      isPlainObject(value) &&
      !(isPluralMessage(current) && isPluralMessage(value))
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
 *
 * A text with plural forms is replaced as a whole when the override has its
 * `other` form - so no form of the base language is left in it. A text left
 * out - or `null`, as translation tools export an untranslated one - keeps
 * the text of the base.
 */
export function createLocale(base: Locale, overrides: DeepPartial<Locale>) {
  return deepMerge(base, overrides);
}
