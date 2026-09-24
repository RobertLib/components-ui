import { describe, expect, it } from "vitest";
import {
  findMatchRanges,
  rankMatch,
  toSearchable,
  toSearchWords,
} from "./match";

const rank = (label: string, query: string, other = "") =>
  rankMatch(
    toSearchable(label),
    toSearchable(other).folded,
    toSearchWords(query),
  );

describe("toSearchWords", () => {
  it("folds the words of the search and drops the empty ones", () => {
    expect(toSearchWords("  Nová   FAKTURA ")).toEqual(["nova", "faktura"]);
    expect(toSearchWords("   ")).toEqual([]);
  });
});

describe("rankMatch", () => {
  it("matches ignoring case and diacritics", () => {
    expect(rank("Účetní období", "ucetni")).not.toBeNull();
    expect(rank("Łódź office", "lodz")).not.toBeNull();
    expect(rank("Customers", "invoice")).toBeNull();
  });

  it("needs every word, in the label or the other texts", () => {
    expect(rank("New invoice", "invoice new")).not.toBeNull();
    expect(rank("New invoice", "new bill", "bill receipt")).not.toBeNull();
    expect(rank("New invoice", "new order")).toBeNull();
  });

  it("ranks the start of the label before the start of a word before the rest", () => {
    const start = rank("Invoices", "inv");
    const wordStart = rank("Overdue invoices", "inv");
    const inside = rank("Reinvoicing", "inv");
    const elsewhere = rank("Billing", "inv", "invoices");

    expect(start).toBeLessThan(wordStart!);
    expect(wordStart).toBeLessThan(inside!);
    expect(inside).toBeLessThan(elsewhere!);
  });
});

describe("findMatchRanges", () => {
  const ranges = (text: string, query: string) =>
    findMatchRanges(toSearchable(text), toSearchWords(query));

  it("finds every occurrence of every word in the original text", () => {
    expect(ranges("Žádost o žádost", "zadost")).toEqual([
      [0, 6],
      [9, 15],
    ]);
    expect(ranges("Settings of the account", "acc set")).toEqual([
      [0, 3],
      [16, 19],
    ]);
  });

  it("merges overlapping matches", () => {
    expect(ranges("Anna", "ann nna")).toEqual([[0, 4]]);
  });

  it("keeps a combining accent with its letter", () => {
    // "é" written as "e" and a combining acute accent
    const text = "Café order";
    expect(ranges(text, "cafe")).toEqual([[0, 5]]);
  });

  it("finds nothing without words", () => {
    expect(ranges("Customers", "")).toEqual([]);
  });
});
