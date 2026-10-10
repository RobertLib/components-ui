import { describe, expect, it } from "vitest";
import { getPendingSearches, observeSearch } from "./pending-searches";

/** What `useUrlState` and `useDataTableQuery` do for a change. */
const navigate = (
  entry: ReturnType<typeof getPendingSearches>,
  search: string,
) => {
  entry.pending = [...entry.pending, search];
};

describe("observeSearch", () => {
  it("lets the changes after the one the router shows wait", () => {
    const entry = getPendingSearches({}, "/people", "");
    navigate(entry, "?status=all");
    navigate(entry, "?status=all&page=3");

    observeSearch(entry, "");
    expect(entry.pending).toEqual(["?status=all", "?status=all&page=3"]);
    observeSearch(entry, "?status=all");
    expect(entry.pending).toEqual(["?status=all&page=3"]);
    observeSearch(entry, "?status=all&page=3");
    expect(entry.pending).toEqual([]);
  });

  it("drops the changes a router showing only the last one ends where it is", () => {
    const entry = getPendingSearches({}, "/people", "");
    // A filter, and off again before the router loaded the first
    navigate(entry, "?status=all");
    navigate(entry, "");

    // The router shows the last - where it was
    observeSearch(entry, "");
    expect(entry.pending).toEqual([]);

    // Back onto the filter is a navigation from elsewhere - the next change
    // builds on it, not on the end of the changes
    observeSearch(entry, "?status=all");
    expect(entry.pending).toEqual([]);
    expect(entry.seen).toBe("?status=all");
  });

  it("drops the changes of a navigation from elsewhere", () => {
    const entry = getPendingSearches({}, "/people", "");
    navigate(entry, "?page=2");

    observeSearch(entry, "?tab=2");
    expect(entry.pending).toEqual([]);
  });

  it("acknowledges the latest occurrence of a repeated pending query before Back", () => {
    const entry = getPendingSearches({}, "/people", "");
    navigate(entry, "?q=a");
    navigate(entry, "?q=b");
    navigate(entry, "?q=a");

    // A loader finishes only the last navigation, skipping a and b.
    observeSearch(entry, "?q=a");
    expect(entry.pending).toEqual([]);
    observeSearch(entry, "?q=b");
    expect(entry.pending).toEqual([]);
    expect(entry.seen).toBe("?q=b");
  });

  it("keeps later distinct changes after a repeated query is acknowledged", () => {
    const entry = getPendingSearches({}, "/people", "");
    navigate(entry, "?q=a");
    navigate(entry, "?q=b");
    navigate(entry, "?q=a");
    navigate(entry, "?q=c");

    observeSearch(entry, "?q=a");
    expect(entry.pending).toEqual(["?q=c"]);
  });
});
