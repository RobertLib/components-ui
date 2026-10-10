import { toLatinDigit } from "../input-mask";

/** ISO region code and its international calling prefix, without +. */
export interface PhoneCountry {
  code: string;
  callingCode: string;
}

/** Default picker entries; applications can supply their own country list. */
export const PHONE_COUNTRIES: readonly PhoneCountry[] =
  /* @__PURE__ */ Object.entries({
    AT: "43",
    AU: "61",
    BE: "32",
    BR: "55",
    CA: "1",
    CH: "41",
    CN: "86",
    CZ: "420",
    DE: "49",
    DK: "45",
    EE: "372",
    ES: "34",
    FI: "358",
    FR: "33",
    GB: "44",
    GR: "30",
    HR: "385",
    HU: "36",
    IE: "353",
    IL: "972",
    IN: "91",
    IS: "354",
    IT: "39",
    JP: "81",
    KR: "82",
    LT: "370",
    LU: "352",
    LV: "371",
    MX: "52",
    NL: "31",
    NO: "47",
    NZ: "64",
    PL: "48",
    PT: "351",
    RO: "40",
    RS: "381",
    SE: "46",
    SI: "386",
    SK: "421",
    TR: "90",
    UA: "380",
    US: "1",
    ZA: "27",
  }).map(([code, callingCode]) => ({ code, callingCode }));

// Calling codes several regions share, and the region each belongs to first
const MAIN_COUNTRIES: Readonly<Record<string, string>> = {
  1: "US",
  7: "RU",
  39: "IT",
  44: "GB",
  47: "NO",
  61: "AU",
  212: "MA",
  262: "RE",
  290: "SH",
  358: "FI",
  590: "GP",
  599: "CW",
};

// Signs of the full-width forms of an East Asian input method; its digits
// are taken by toLatinDigit
const FULL_WIDTH_SIGNS: Readonly<Record<string, string>> = {
  "＋": "+",
  "（": "(",
  "）": ")",
};

/** Read the same digits and international marker for normalization and detection. */
function readPhoneInput(text: string) {
  // The bidi marks of a number copied from a chat app or the contacts
  // (format characters) would hide its +
  const input = Array.from(
    text.replace(/\p{Cf}/gu, ""),
    (char) => toLatinDigit(char) ?? FULL_WIDTH_SIGNS[char] ?? char,
  )
    .join("")
    .trim()
    .replace(/^00/, "+")
    // The trunk prefix of "+44 (0)20 ..." is dialled only within the country
    .replace(/^(\+\D*\d+\D*?)\(\s*0\s*\)/, "$1");
  return {
    digits: input.replace(/\D/g, ""),
    international: input.startsWith("+"),
  };
}

/**
 * Normalize international or national input. National trunk prefixes stay
 * as typed; a (0) after an international calling code is dropped.
 */
export function normalizePhone(text: string, country: PhoneCountry) {
  const { digits, international } = readPhoneInput(text);
  return digits ? `+${international ? "" : country.callingCode}${digits}` : "";
}

/** Longest calling prefix of the countries an international value starts with. */
export function matchCallingCode(
  value: string,
  countries: readonly PhoneCountry[],
) {
  const { digits, international } = readPhoneInput(value);
  if (!international) return undefined;
  let longest: string | undefined;
  for (const { callingCode } of countries) {
    if (
      digits.startsWith(callingCode) &&
      callingCode.length > (longest?.length ?? 0)
    ) {
      longest = callingCode;
    }
  }
  return longest;
}

/**
 * Country of the longest matching prefix. A shared prefix retains the
 * selected country, else it is the main one of the prefix (US for +1) when
 * listed, else the first listed.
 */
export function detectPhoneCountry(
  value: string,
  countries: readonly PhoneCountry[],
  fallback: string,
) {
  const callingCode = matchCallingCode(value, countries);
  if (callingCode === undefined) return fallback;
  const matches = countries.filter(
    (country) => country.callingCode === callingCode,
  );
  return (
    matches.find((country) => country.code === fallback) ??
    matches.find((country) => country.code === MAIN_COUNTRIES[callingCode]) ??
    matches[0]
  ).code;
}

/** Structural E.164 validation only; it does not verify a country's numbering plan. */
export function isInternationalPhone(value: string, country: PhoneCountry) {
  return (
    /^\+[1-9]\d{6,14}$/.test(value) &&
    value.startsWith(`+${country.callingCode}`) &&
    value.length > country.callingCode.length + 1
  );
}
