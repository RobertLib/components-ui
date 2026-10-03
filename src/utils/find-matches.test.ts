import { describe, expect, it } from "vitest";
import { findMatches } from "./find-matches";

describe("findMatches", () => {
  it("finds every match, ignoring case and diacritics", () => {
    expect(findMatches("Česká pošta, česko", "cesk")).toEqual([
      [0, 4],
      [13, 17],
    ]);
    expect(findMatches("Šimon a Simona", "sim")).toEqual([
      [0, 3],
      [8, 11],
    ]);
  });

  it("returns no ranges for an empty or absent match", () => {
    expect(findMatches("Orders", "x")).toEqual([]);
    expect(findMatches("Orders", "")).toEqual([]);
    expect(findMatches("Orders", "\u0301")).toEqual([]);
    expect(findMatches("", "a")).toEqual([]);
  });

  it("keeps matches adjacent without overlapping", () => {
    expect(findMatches("aaaaa", "aa")).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it("includes decomposed accents at the end of a match", () => {
    const text = "Pr\u030ci\u0301lis\u030c";
    expect(findMatches(text, "lis")).toEqual([[5, 9]]);
    expect(findMatches(text, "ri")).toEqual([[1, 5]]);
    expect(findMatches("a\u0301\u0308b", "a")).toEqual([[0, 3]]);
  });

  it("maps mixed expansions and removed accents even when total lengths match", () => {
    const text = "a\u0301b\u0301한";
    expect(findMatches(text, "b")).toEqual([[2, 4]]);
    expect(findMatches(text, "한")).toEqual([[4, 5]]);
  });

  it("returns UTF-16 indexes after a supplementary character", () => {
    expect(findMatches("😀a\u0301", "a")).toEqual([[2, 4]]);
    expect(findMatches("a😀b", "😀")).toEqual([[1, 3]]);
  });

  it("finds a voiced kana by its plain one, also written decomposed", () => {
    expect(findMatches("かがみ", "か")).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(findMatches("がみ", "が")).toEqual([[0, 2]]);
  });

  it("matches Korean written composed or not", () => {
    const decomposed = "한국".normalize("NFD");
    expect(findMatches(decomposed, "한국")).toEqual([[0, decomposed.length]]);
    expect(findMatches("한국어", "한국".normalize("NFD"))).toEqual([[0, 2]]);
  });

  it("matches the Greek final sigma by the plain one", () => {
    expect(findMatches("ΟΔΟΣ", "οδος")).toEqual([[0, 4]]);
  });
});
