import { describe, expect, it } from "vitest";
import { findMatches as findTreeMatches } from "../tree-view/tree-model";
import { findMatches } from "./find-matches";
import { applyDataTableQuery, createDataTableQuery } from "./query";

// DataTable and TreeView search as Autocomplete, TagsInput and CommandPalette
// do - the texts of other scripts fold the same way, composed or not
describe.each([
  ["DataTable", findMatches],
  ["TreeView", findTreeMatches],
])("%s findMatches", (_, find) => {
  it("finds a voiced kana by its plain one, also written decomposed", () => {
    expect(find("かがみ", "か")).toEqual([
      [0, 1],
      [1, 2],
    ]);
    // "が" written as "か" and the combining voicing mark
    expect(find("がみ", "が")).toEqual([[0, 2]]);
  });

  it("matches Korean written composed or not", () => {
    const decomposed = "한국".normalize("NFD");
    expect(find(decomposed, "한국")).toEqual([[0, decomposed.length]]);
    expect(find("한국어", "한국".normalize("NFD"))).toEqual([[0, 2]]);
  });

  it("matches the Greek final sigma by the plain one", () => {
    expect(find("ΟΔΟΣ", "οδος")).toEqual([[0, 4]]);
  });
});

describe("applyDataTableQuery search", () => {
  it("folds the texts of other scripts like the highlight does", () => {
    const rows = [{ name: "ΟΔΟΣ" }, { name: "한국".normalize("NFD") }];
    const columns = [{ key: "name" as const, label: "Name" }];
    const search = (term: string) =>
      applyDataTableQuery(
        rows,
        { ...createDataTableQuery(), search: term },
        columns,
      ).rows.map((row) => row.name);

    expect(search("οδος")).toEqual(["ΟΔΟΣ"]);
    expect(search("한국")).toEqual(["한국".normalize("NFD")]);
  });
});
