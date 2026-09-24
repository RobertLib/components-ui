import { describe, expect, it, vi } from "vitest";
import { cs } from "./cs";
import { en } from "./en";
import {
  createLocale,
  deepMerge,
  formatMessage,
  formatPlural,
  toIntlLocale,
} from "./format";

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
    // A decimal count has its own form
    expect(formatPlural("cs-CZ", message, 1.5)).toBe("Vybráno 1,5 položky");
    expect(formatPlural("cs-CZ", cs.messages.dateRangePicker.days, 0.5)).toBe(
      "0,5 dne",
    );
  });

  it("gives every Czech text with plural forms its form of decimals", () => {
    const pluralMessages = (value: object): object[] =>
      Object.values(value).flatMap((child) =>
        typeof child !== "object" || child === null
          ? []
          : "other" in child
            ? [child]
            : pluralMessages(child),
      );
    const messages = pluralMessages(cs.messages);
    expect(messages.length).toBeGreaterThan(10);
    for (const message of messages) {
      expect(Object.keys(message).sort()).toEqual([
        "few",
        "many",
        "one",
        "other",
      ]);
    }
  });

  it("falls back to `other`", () => {
    expect(formatPlural("en-US", { other: "{count} items" }, 1)).toBe(
      "1 items",
    );
  });

  it("writes the count as the language writes numbers", () => {
    expect(
      formatPlural("en-US", en.messages.dataTable.selection.selectAll, 12345),
    ).toBe("Select all 12,345 rows");
    expect(
      formatPlural("cs-CZ", cs.messages.dataTable.selection.selectAll, 12345),
    ).toBe("Vybrat všech 12 345 řádků");
    // A `count` of the params wins
    expect(
      formatPlural("en-US", { other: "{count}" }, 2, { count: "two" }),
    ).toBe("two");
  });

  it("falls back to en-US for an invalid locale code", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const message = en.messages.dataTable.selectedCount;
    expect(formatPlural("en_GB", message, 1)).toBe("1 item selected");
    expect(formatPlural("", message, 1500)).toBe("1,500 items selected");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"en_GB"'));
  });
});

describe("toIntlLocale", () => {
  it("keeps valid codes and replaces invalid ones once, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toIntlLocale("cs-CZ")).toBe("cs-CZ");
    expect(toIntlLocale("en-gb")).toBe("en-GB");
    expect(toIntlLocale("de_AT")).toBe("en-US");
    expect(toIntlLocale("de_AT")).toBe("en-US");
    expect(warn).toHaveBeenCalledTimes(1);
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

  it("replaces a text with plural forms as a whole", () => {
    const de = createLocale(en, {
      code: "de-DE",
      messages: {
        dataTable: { selectedCount: { other: "Ausgewählt: {count}" } },
      },
    });
    expect(de.messages.dataTable.selectedCount).toEqual({
      other: "Ausgewählt: {count}",
    });
    expect(formatPlural(de.code, de.messages.dataTable.selectedCount, 1)).toBe(
      "Ausgewählt: 1",
    );
    // The rest of the group is still merged
    expect(de.messages.dataTable.noData).toBe(en.messages.dataTable.noData);

    // Without its `other` form an override changes single forms
    expect(
      deepMerge(cs.messages.calendar, { more: { one: "+{count} jiná" } }).more,
    ).toEqual({ ...cs.messages.calendar.more, one: "+{count} jiná" });
    // A group that merely has an `other` key is still merged
    expect(
      deepMerge(
        { group: { other: "a", label: "b" } },
        { group: { other: "c" } },
      ),
    ).toEqual({ group: { other: "c", label: "b" } });
  });

  it("keeps the base text for one nobody translated (null)", () => {
    // How translation tools export the texts of a new language
    const de = createLocale(
      en,
      JSON.parse(
        '{"code":"de-DE","messages":{"common":{"cancel":"Abbrechen","loading":null},"avatar":{"more":null}}}',
      ),
    );
    expect(de.messages.common.cancel).toBe("Abbrechen");
    expect(de.messages.common.loading).toBe(en.messages.common.loading);
    expect(de.messages.avatar.more).toEqual(en.messages.avatar.more);
  });
});
