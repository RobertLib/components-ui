/** ISO region code and its international calling prefix, without +. */
export interface PhoneCountry {
  code: string;
  callingCode: string;
}

/** Default picker entries; applications can supply their own country list. */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = Object.entries({
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

/** Read the same digits and international marker for normalization and detection. */
function readPhoneInput(text: string) {
  const input = text.trim().replace(/^00/, "+");
  return {
    digits: input.replace(/\D/g, ""),
    international: input.startsWith("+"),
  };
}

/** Normalize international or national input. National trunk prefixes stay as typed. */
export function normalizePhone(text: string, country: PhoneCountry) {
  const { digits, international } = readPhoneInput(text);
  return digits ? `+${international ? "" : country.callingCode}${digits}` : "";
}

/** Longest matching prefix; shared prefixes retain the selected country. */
export function detectPhoneCountry(
  value: string,
  countries: readonly PhoneCountry[],
  fallback: string,
) {
  const { digits, international } = readPhoneInput(value);
  if (!international) return fallback;
  const matches = countries
    .filter((country) => digits.startsWith(country.callingCode))
    .sort((a, b) => b.callingCode.length - a.callingCode.length);
  const first = matches[0];
  return (
    matches.find(
      (country) =>
        country.code === fallback && country.callingCode === first?.callingCode,
    )?.code ??
    first?.code ??
    fallback
  );
}

/** Structural E.164 validation only; it does not verify a country's numbering plan. */
export function isInternationalPhone(value: string, country: PhoneCountry) {
  return (
    /^\+[1-9]\d{6,14}$/.test(value) &&
    value.startsWith(`+${country.callingCode}`) &&
    value.length > country.callingCode.length + 1
  );
}
