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

  it("matches a Greek label in capitals with a search typed in lower case", () => {
    // Lowercased letter by letter the last "Σ" is "σ", typed it is "ς"
    expect(rank("ΟΔΟΣ ΑΘΗΝΑΣ", "οδος")).not.toBeNull();
    expect(rank("Οδός Αθηνάς", "ΑΘΗΝΑΣ")).not.toBeNull();
  });

  it("matches Korean text written composed or decomposed", () => {
    const composed = "한국어";
    const decomposed = composed.normalize("NFD");

    expect(rank(composed, decomposed)).not.toBeNull();
    expect(rank(decomposed, composed)).not.toBeNull();
  });

  it("matches a label typed as it is - its marks typed in any order, its letters past U+FFFF", () => {
    // The dagesh before the sheva, the shadda before the fatha - the other
    // way round than NFD sorts them
    const hebrew = "\u05D1\u05BC\u05B0\u05E8";
    const arabic = "\u0634\u0651\u064E\u0645\u0633";
    // "Deseret" in Deseret, whose letters take two code units each
    const deseret =
      "\u{10414}\u{1042F}\u{10445}\u{10428}\u{10449}\u{1042F}\u{1043B}";

    expect(rank(hebrew, hebrew)).toBe(0);
    expect(rank(arabic, arabic)).toBe(0);
    expect(rank(arabic, "\u0634\u064E\u0651")).toBe(0);
    expect(rank(deseret, deseret)).toBe(0);
    // Its capital in lower case
    expect(rank(deseret, "\u{1043C}\u{1042F}")).toBe(0);
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

  it("does not take a mark or a letter past U+FFFF for the end of a word", () => {
    const inside = rank("Reinvoicing", "inv");

    // After the voicing mark of ガ, which folding leaves as a mark of its own
    expect(rank("ガス", "ス")).toBe(inside);
    // After a Hebrew letter with its points
    expect(rank("בְּר", "ר")).toBe(inside);
    // After a letter of two code units
    expect(rank("\u{10414}\u{1042F}\u{10445}", "\u{1042F}")).toBe(inside);
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

  it("keeps the voicing mark with its kana", () => {
    // "ガ" written as "カ" and a combining voicing mark
    expect(ranges("\u30ab\u3099ス", "カ")).toEqual([[0, 2]]);
    expect(ranges("ガス 한국", "한")).toEqual([[3, 4]]);
  });

  it("keeps the marks with their letter and a letter past U+FFFF whole", () => {
    // The dagesh before the sheva - NFD swaps them
    expect(ranges("\u05D1\u05BC\u05B0\u05E8", "\u05D1")).toEqual([[0, 3]]);
    // The shadda before the fatha
    expect(ranges("\u0634\u0651\u064E\u0645", "\u0645")).toEqual([[3, 4]]);
    // A capital of Deseret, which takes two code units
    expect(ranges("\u{10414}\u{1042F} \u{10414}", "\u{1043C}")).toEqual([
      [0, 2],
      [5, 7],
    ]);
  });

  it("finds nothing without words", () => {
    expect(ranges("Customers", "")).toEqual([]);
  });
});
