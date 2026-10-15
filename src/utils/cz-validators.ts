/**
 * Checks of Czech identifiers - IČO, DIČ, rodné číslo, a bank account
 * number, IBAN and PSČ. Pure functions, also for the server: whitespace is
 * left out ("452 74 649"), and letters may be lowercase ("cz…").
 */

/** What a valid birth number tells. */
export interface BirthNumberDetails {
  /** The day of birth - `YYYY-MM-DD`, as `DatePicker` takes it. */
  birthDate: string;
  /** Read from the month - women have 50 added to it. */
  sex: "female" | "male";
}

/** The value without whitespace, its letters uppercase. */
const compact = (value: string) => value.replace(/\s+/g, "").toUpperCase();

const ICO = /^\d{8}$/;
// YYMMDD, an optional slash and 3 digits (before 1954) or 4
const BIRTH_NUMBER = /^(\d{2})(\d{2})(\d{2})\/?(\d{3,4})$/;
// 8 digits of an IČO, 9 or 10 of a birth number or a number of the tax office
const DIC = /^CZ(\d{8,10})$/;
// [prefix-]number/bank code
const BANK_ACCOUNT = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/;
const IBAN = /^[A-Z]{2}\d{2}[A-Z\d]+$/;
const POSTAL_CODE = /^[1-7]\d{4}$/;

// The weights of the digits of an account number from the right - those of
// its prefix are the first six (Decree of the Czech National Bank
// No. 169/2011); Slovak accounts are checked the same way
const ACCOUNT_WEIGHTS = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];

// The length of an IBAN by its country - every country of the SWIFT IBAN
// registry
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24,
  AE: 23,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BH: 22,
  BI: 27,
  BR: 29,
  BY: 28,
  CH: 21,
  CR: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DJ: 27,
  DK: 18,
  DO: 28,
  EE: 20,
  EG: 29,
  ES: 24,
  FI: 18,
  FK: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  GT: 28,
  HN: 28,
  HR: 21,
  HU: 28,
  IE: 22,
  IL: 23,
  IQ: 23,
  IS: 26,
  IT: 27,
  JO: 30,
  KW: 30,
  KZ: 20,
  LB: 28,
  LC: 32,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  LY: 25,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MN: 20,
  MR: 27,
  MT: 31,
  MU: 30,
  NI: 28,
  NL: 18,
  NO: 15,
  OM: 23,
  PK: 24,
  PL: 28,
  PS: 29,
  PT: 25,
  QA: 29,
  RO: 24,
  RS: 22,
  RU: 33,
  SA: 24,
  SC: 31,
  SD: 18,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  SO: 23,
  ST: 25,
  SV: 28,
  TL: 23,
  TN: 24,
  TR: 26,
  UA: 29,
  VA: 22,
  VG: 24,
  XK: 20,
  YE: 30,
};

/**
 * The digits `start` to `end` of `digits`, each times its weight - 8 for
 * the first, 7 for the next, … - as IČO and DIČ weigh them.
 */
function weighDown(digits: string, start: number, end: number) {
  let sum = 0;
  for (let index = start; index < end; index++) {
    sum += Number(digits[index]) * (8 - index + start);
  }
  return sum;
}

/** Whether an account number (or its prefix) passes its check. */
function isAccountPart(digits: string) {
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    sum += Number(digits[digits.length - 1 - index]) * ACCOUNT_WEIGHTS[index];
  }
  return sum % 11 === 0;
}

/**
 * Whether a prefix and a number make an account - the number has at least
 * two digits other than 0.
 */
const isAccount = (prefix: string, number: string) =>
  isAccountPart(prefix) && isAccountPart(number) && /[1-9].*[1-9]/.test(number);

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Whether `value` is an IČO - the identification number of a company or a
 * trader: 8 digits, the last a check digit ("45274649"). A number of fewer
 * digits takes the zeros in front ("00177041").
 */
export function isValidIco(value: string): boolean {
  const ico = compact(value);
  // The remainder 0 makes the check digit 1, the remainder 1 makes it 0
  return (
    ICO.test(ico) && (11 - (weighDown(ico, 0, 7) % 11)) % 10 === Number(ico[7])
  );
}

/**
 * Reads a rodné číslo - "YYMMDD/XXXX", with or without the slash: the day
 * of birth and the sex, or `null` for no valid one. Women have 50 added to
 * the month, and from 2004 on the month may have 20 more (21 - 32, 71 -
 * 82). A number of 10 digits is divisible by 11 - or, given before 1985,
 * ends with 0 where the remainder of its first nine digits is 10; its year
 * is 1954 - 2053. One of 9 digits, without a check digit, was given before
 * 1954. The day is not compared with today - a number of 2040 is read too.
 */
export function parseBirthNumber(value: string): BirthNumberDetails | null {
  const match = BIRTH_NUMBER.exec(compact(value));
  if (!match) return null;

  const [, yy, mm, dd, serial] = match;
  let year = 1900 + Number(yy);
  if (serial.length === 3) {
    if (year >= 1954) return null;
  } else if (year < 1954) {
    year += 100;
  }

  let month = Number(mm);
  const female = month > 50;
  if (female) month -= 50;
  // The numbers of a day ran out - from 2004 on, 20 more is added
  if (month > 20) {
    if (year < 2004) return null;
    month -= 20;
  }
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  if (serial.length === 4) {
    const remainder = Number(yy + mm + dd + serial.slice(0, 3)) % 11;
    const check = Number(serial[3]);
    // The number is divisible by 11 when its check digit is the remainder
    const valid =
      remainder === 10 ? check === 0 && year < 1985 : check === remainder;
    if (!valid) return null;
  }

  return {
    birthDate: `${year}-${pad(month)}-${pad(day)}`,
    sex: female ? "female" : "male",
  };
}

/**
 * Whether `value` is a rodné číslo - "780123/4562", with or without the
 * slash. See `parseBirthNumber` for the rules.
 */
export function isValidBirthNumber(value: string): boolean {
  return parseBirthNumber(value) !== null;
}

/**
 * Whether `value` is a Czech DIČ - the tax identification number: `CZ`
 * and the IČO of a company ("CZ45274649"), the birth number of a person
 * ("CZ7801234562"), or 9 digits starting with 6 the tax office gave with a
 * check digit - VAT groups (`CZ699…`) and people without a birth number.
 */
export function isValidDic(value: string): boolean {
  const match = DIC.exec(compact(value));
  if (!match) return false;

  const digits = match[1];
  if (digits.length === 8) return isValidIco(digits);
  if (digits.length === 9 && digits[0] === "6") {
    // The check of the tax office (the first digit left out): the
    // remainder 0 makes the check digit 8, 1 makes it 9, 2 makes it 0, …
    return ((weighDown(digits, 1, 8) % 11) + 8) % 10 === Number(digits[8]);
  }
  return isValidBirthNumber(digits);
}

/**
 * Whether `value` is a Czech bank account number - "[prefix-]number/bank
 * code": a prefix of up to 6 digits, a number of 2 to 10 digits, both
 * passing the check of the Czech National Bank, and a bank code of 4
 * digits ("19-2000145399/0800"). The bank code is not looked up.
 */
export function isValidBankAccount(value: string): boolean {
  const match = BANK_ACCOUNT.exec(compact(value));
  return !!match && isAccount(match[1] ?? "", match[2]);
}

/**
 * Whether `value` is an IBAN - a country of the SWIFT IBAN registry, the
 * length of its IBANs, and the check digits (mod 97). A Czech or a Slovak
 * IBAN also has an account number that passes its check.
 */
export function isValidIban(value: string): boolean {
  const iban = compact(value);
  const country = iban.slice(0, 2);
  if (!IBAN.test(iban) || IBAN_LENGTHS[country] !== iban.length) return false;

  // 00, 01 and 99 are no check digits - but would pass with others
  const checkDigits = Number(iban.slice(2, 4));
  if (checkDigits < 2 || checkDigits > 98) return false;

  // The country and the check digits moved to the end, the letters
  // replaced by 10 - 35: the number gives 1 divided by 97
  let remainder = 0;
  for (const char of iban.slice(4) + iban.slice(0, 4)) {
    const digit = Number.parseInt(char, 36);
    remainder = (remainder * (digit < 10 ? 10 : 100) + digit) % 97;
  }
  if (remainder !== 1) return false;

  // The bank code, the prefix and the number of the account
  if (country === "CZ" || country === "SK") {
    return (
      /^\d+$/.test(iban.slice(4)) &&
      isAccount(iban.slice(8, 14), iban.slice(14))
    );
  }
  return true;
}

/**
 * Writes an IBAN in groups of four - "CZ65 0800 0000 1920 0014 5399" -
 * without checking it.
 */
export function formatIban(value: string): string {
  return compact(value).replace(/(.{4})(?!$)/g, "$1 ");
}

/**
 * Whether `value` is a Czech PSČ - the postal code: 5 digits, the first 1
 * to 7 ("110 00", "11000").
 */
export function isValidPostalCode(value: string): boolean {
  return POSTAL_CODE.test(compact(value));
}

/**
 * Writes a postal code of 5 digits as "110 00" - a value of another shape
 * is returned as it is.
 */
export function formatPostalCode(value: string): string {
  const code = compact(value);
  return /^\d{5}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : value;
}
