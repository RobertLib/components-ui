import { describe, expect, it } from "vitest";
import { cs } from "./cs";
import { en } from "./en";
import { createLocale, deepMerge, formatMessage, formatPlural } from "./format";

describe("formatMessage", () => {
  it("fills known placeholders and keeps unknown ones", () => {
    expect(
      formatMessage("{from}–{to} of {total}", { from: 1, to: 20, total: 50 }),
    ).toBe("1–20 of 50");
    expect(formatMessage("Hello {name}")).toBe("Hello {name}");
  });
});

describe("formatPlural", () => {
  it("picks the Czech plural forms", () => {
    const message = cs.messages.dataTable.selectedCount;
    expect(formatPlural("cs-CZ", message, 1)).toBe("Vybrána 1 položka");
    expect(formatPlural("cs-CZ", message, 3)).toBe("Vybrány 3 položky");
    expect(formatPlural("cs-CZ", message, 5)).toBe("Vybráno 5 položek");
  });

  it("falls back to `other`", () => {
    expect(formatPlural("en-US", { other: "{count} items" }, 1)).toBe(
      "1 items",
    );
  });
});

describe("locales", () => {
  it("define the same messages in every language", () => {
    const keys = (value: object, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, child]) =>
        typeof child === "object" && child !== null && !("other" in child)
          ? keys(child, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      );
    expect(keys(cs.messages).sort()).toEqual(keys(en.messages).sort());
  });

  it("derives a locale with createLocale", () => {
    const enGB = createLocale(en, {
      code: "en-GB",
      formats: { date: "DD/MM/YYYY" },
      weekStartsOn: 1,
    });
    expect(enGB.formats.date).toBe("DD/MM/YYYY");
    expect(enGB.formats.time).toBe(en.formats.time);
    expect(enGB.messages).toEqual(en.messages);
    expect(en.formats.date).toBe("MM/DD/YYYY"); // the base stays untouched
  });

  it("deep-merges plain objects only", () => {
    expect(deepMerge({ a: { b: 1, c: [1, 2] } }, { a: { c: [3] } })).toEqual({
      a: { b: 1, c: [3] },
    });
  });
});
