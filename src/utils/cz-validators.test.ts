import { describe, expect, it } from "vitest";
import {
  formatIban,
  formatPostalCode,
  isValidBankAccount,
  isValidBirthNumber,
  isValidDic,
  isValidIban,
  isValidIco,
  isValidPostalCode,
  parseBirthNumber,
} from "./cz-validators";

describe("isValidIco", () => {
  it.each([
    // ČEZ: 4·8 + 5·7 + 2·6 + 7·5 + 4·4 + 6·3 + 4·2 = 156, 156 % 11 = 2 → 9
    "45274649",
    // Komerční banka: 128 % 11 = 7 → 4
    "45317054",
    // Škoda Auto: 77 % 11 = 0 → 1
    "00177041",
    // Hlavní město Praha: 77 % 11 = 0 → 1
    "00064581",
    // 121 % 11 = 0 → 1
    "25123891",
    // The remainder 1 makes the check digit 0: 6·2 = 12
    "00000060",
    // The remainder 10 makes it 1: 5·2 = 10
    "00000051",
  ])("takes %s", (ico) => {
    expect(isValidIco(ico)).toBe(true);
  });

  it("leaves whitespace out", () => {
    expect(isValidIco(" 452 74 649 ")).toBe(true);
    expect(isValidIco("45 274 649")).toBe(true);
    expect(isValidIco("45274649\n")).toBe(true);
  });

  it.each([
    ["a wrong check digit", "45274648"],
    ["flipped digits", "45724649"],
    ["the last two digits flipped", "45274694"],
    ["zeros alone", "00000000"],
    ["7 digits", "4527464"],
    ["9 digits", "452746490"],
    ["a letter", "4527464a"],
    ["a DIČ", "CZ45274649"],
    ["a dash", "4527-4649"],
    ["nothing", ""],
  ])("refuses %s", (_, ico) => {
    expect(isValidIco(ico)).toBe(false);
  });
});

describe("parseBirthNumber", () => {
  it.each([
    // 780123456 % 11 = 2 - the number is divisible by 11
    ["780123/4562", "1978-01-23", "male"],
    ["7801234562", "1978-01-23", "male"],
    [" 780123 / 4562 ", "1978-01-23", "male"],
    // Women have 50 added to the month: 785123456 % 11 = 7
    ["785123/4567", "1978-01-23", "female"],
    ["710319/2745", "1971-03-19", "male"],
    // 9 digits without a check digit - before 1954
    ["530101/123", "1953-01-01", "male"],
    ["445229/001", "1944-02-29", "female"],
    // From 2004 on, 20 more: 042101123 % 11 = 9, 107215123 % 11 = 4
    ["042101/1239", "2004-01-01", "male"],
    ["107215/1234", "2010-02-15", "female"],
    // The 29th of February of a leap year
    ["000229/1234", "2000-02-29", "male"],
    ["005229/1239", "2000-02-29", "female"],
    // Before 1985 the remainder 10 makes the check digit 0:
    // 780123002 % 11 = 10
    ["780123/0020", "1978-01-23", "male"],
  ])("reads %s", (value, birthDate, sex) => {
    expect(parseBirthNumber(value)).toEqual({ birthDate, sex });
    expect(isValidBirthNumber(value)).toBe(true);
  });

  it("reads a year up to 2053 - not compared with today", () => {
    // 530101123 % 11 = 2
    expect(parseBirthNumber("530101/1232")).toEqual({
      birthDate: "2053-01-01",
      sex: "male",
    });
  });

  it.each([
    ["a wrong check digit", "780123/4561"],
    ["flipped digits", "780123/4526"],
    ["9 digits after 1953", "540101/123"],
    ["the 29th of February of 1943", "435229/001"],
    ["the 29th of February of 1900", "000229/123"],
    // The check digits fit - the month does not
    ["20 more before 2004", "032101/1240"],
    ["20 more in 1978", "782123/4564"],
    ["the remainder 10 from 1985 on", "900101/0030"],
    ["the remainder 10 without the check digit 0", "780123/0021"],
    ["the 30th of February", "780230/1232"],
    ["the month 13", "781301/1239"],
    ["the month 0", "780001/1230"],
    ["the day 0", "780100/1230"],
    ["8 digits", "78012345"],
    ["11 digits", "78012345621"],
    ["a slash elsewhere", "7801/234562"],
    ["two slashes", "780123//4562"],
    ["a letter", "78012a/4562"],
    ["a dash", "780123-4562"],
    ["nothing", ""],
  ])("refuses %s", (_, value) => {
    expect(parseBirthNumber(value)).toBeNull();
    expect(isValidBirthNumber(value)).toBe(false);
  });
});

describe("isValidDic", () => {
  it.each([
    // The IČO of a company
    "CZ45274649",
    "CZ25123891",
    "cz 452 74 649",
    // The birth number of a person - 10 digits, or 9 before 1954
    "CZ7801234562",
    "CZ7103192745",
    "CZ530101123",
    // VAT groups, numbers of the tax office with their check digit:
    // 9·8 + 9·7 + 7·4 + 3·3 + 3·2 = 178, 178 % 11 = 2 → 0
    "CZ699007330",
    // 181 % 11 = 5 → 3
    "CZ699007433",
    // 158 % 11 = 4 → 2
    "CZ699000372",
    // 129 % 11 = 8 → 6
    "CZ640903926",
  ])("takes %s", (dic) => {
    expect(isValidDic(dic)).toBe(true);
  });

  it.each([
    ["no CZ", "45274649"],
    ["another country", "SK45274649"],
    ["an invalid IČO", "CZ45274648"],
    ["an invalid birth number", "CZ7801234561"],
    ["9 digits of a birth number after 1953", "CZ540101123"],
    ["a wrong check digit of the tax office", "CZ699007331"],
    ["flipped digits of the tax office", "CZ699007303"],
    ["7 digits", "CZ4527464"],
    ["11 digits", "CZ78012345621"],
    ["a slash", "CZ780123/4562"],
    ["CZ alone", "CZ"],
    ["nothing", ""],
  ])("refuses %s", (_, dic) => {
    expect(isValidDic(dic)).toBe(false);
  });
});

describe("isValidBankAccount", () => {
  it.each([
    // The prefix 9·1 + 1·2 = 11; the number 2·6 + 1·10 + 4·5 + 5·8 + 3·4 +
    // 9·2 + 9·1 = 121
    "19-2000145399/0800",
    "000019-2000145399/0800",
    "2000145399/0800",
    " 19 - 2000145399 / 0800 ",
    // The shortest: 5·1 + 3·2 = 11
    "35/0100",
  ])("takes %s", (account) => {
    expect(isValidBankAccount(account)).toBe(true);
  });

  it.each([
    ["flipped digits of the number", "19-2000145939/0800"],
    ["a wrong prefix", "18-2000145399/0800"],
    ["zeros alone", "0000000000/0800"],
    ["one digit", "5/0800"],
    ["11 digits", "12000145399/0800"],
    ["a prefix of 7 digits", "0000019-2000145399/0800"],
    ["a bank code of 3 digits", "2000145399/080"],
    ["a letter in the bank code", "2000145399/08O0"],
    ["no bank code", "19-2000145399"],
    ["nothing", ""],
  ])("refuses %s", (_, account) => {
    expect(isValidBankAccount(account)).toBe(false);
  });
});

describe("isValidIban", () => {
  it.each([
    // The examples of the Czech, German, British and Slovak banks
    "CZ6508000000192000145399",
    "CZ65 0800 0000 1920 0014 5399",
    "cz6508000000192000145399",
    "DE89370400440532013000",
    "GB29NWBK60161331926819",
    "gb29 nwbk 6016 1331 9268 19",
    "SK3112000000198742637541",
    // The highest check digits
    "DE98370400440532013032",
  ])("takes %s", (iban) => {
    expect(isValidIban(iban)).toBe(true);
  });

  it.each([
    ["flipped digits", "CZ6508000000192000145939"],
    ["wrong check digits", "CZ6608000000192000145399"],
    // 01 passes the check as 98 does - but is no check digit
    ["the check digits 01", "DE01370400440532013032"],
    ["a short one", "DE8937040044053201300"],
    ["a long one", "DE893704004405320130000"],
    ["an unknown country", "XX89370400440532013000"],
    ["a country of the wrong length", "CZ89370400440532013000"],
    // The check digits fit - the account does not
    ["a wrong Czech account number", "CZ9208000000192000145398"],
    ["a wrong Czech prefix", "CZ3008000000182000145399"],
    ["a Czech account of zeros", "CZ6108000000000000000000"],
    ["a letter in a Czech account", "CZ620800000019200014539A"],
    ["a wrong Slovak account number", "SK0412000000198742637542"],
    ["a dash", "CZ65-0800-0000-1920-0014-5399"],
    ["nothing", ""],
  ])("refuses %s", (_, iban) => {
    expect(isValidIban(iban)).toBe(false);
  });
});

describe("formatIban", () => {
  it("writes groups of four", () => {
    expect(formatIban("CZ6508000000192000145399")).toBe(
      "CZ65 0800 0000 1920 0014 5399",
    );
    expect(formatIban(" gb29nwbk 60161331926819 ")).toBe(
      "GB29 NWBK 6016 1331 9268 19",
    );
    expect(formatIban("CZ65 0800 0000 1920 0014 5399")).toBe(
      "CZ65 0800 0000 1920 0014 5399",
    );
    expect(formatIban("")).toBe("");
  });
});

describe("isValidPostalCode", () => {
  it.each(["11000", "110 00", " 602 00 ", "74601", "799 00"])(
    "takes %s",
    (code) => {
      expect(isValidPostalCode(code)).toBe(true);
    },
  );

  it.each([
    ["a Slovak one", "811 01"],
    ["one starting with 9", "91101"],
    ["one starting with 0", "01000"],
    ["4 digits", "1100"],
    ["6 digits", "110000"],
    ["a letter", "110 0a"],
    ["nothing", ""],
  ])("refuses %s", (_, code) => {
    expect(isValidPostalCode(code)).toBe(false);
  });
});

describe("formatPostalCode", () => {
  it("writes 5 digits as 123 45", () => {
    expect(formatPostalCode("11000")).toBe("110 00");
    expect(formatPostalCode(" 110 00 ")).toBe("110 00");
  });

  it("returns another value as it is", () => {
    expect(formatPostalCode("1100")).toBe("1100");
    expect(formatPostalCode("Praha")).toBe("Praha");
  });
});
