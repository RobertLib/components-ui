import { describe, expect, it, vi } from "vitest";
import {
  applyDataTableQuery,
  createDataTableQuery,
  readQueryFromSearch,
  resetPagination,
  setFilter,
  toggleSort,
  toOffsetParams,
  toRelayVariables,
  writeQueryToSearch,
} from "./query";
import { findMatches } from "./find-matches";
import type { Column } from "./types";

interface Row {
  born: string;
  id: number;
  name: string;
  salary: number | null;
  status: string;
}

const rows: Row[] = [
  {
    born: "1990-05-01",
    id: 1,
    name: "Šimon Novák",
    salary: 50_000,
    status: "active",
  },
  {
    born: "1985-12-24",
    id: 2,
    name: "Anna Svobodová",
    salary: null,
    status: "invited",
  },
  {
    born: "1990-01-15",
    id: 3,
    name: "Zoë Weber",
    salary: 70_000,
    status: "active",
  },
  {
    born: "2001-07-30",
    id: 4,
    name: "Karel Dvořák",
    salary: 30_000,
    status: "suspended",
  },
];

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name", sortable: true },
  { filter: "select", key: "status", label: "Status" },
  { filter: "date", key: "born", label: "Born" },
  {
    filter: "custom",
    filterFn: (row, value) => (row.salary ?? 0) >= Number(value),
    key: "salary",
    label: "Salary",
    sortable: true,
  },
];

describe("query transitions", () => {
  it("cycles sorting asc -> desc -> none and resets paging", () => {
    let query = createDataTableQuery({ after: "x", page: 3 });
    query = toggleSort(query, "name");
    expect(query).toMatchObject({
      after: null,
      order: "asc",
      page: 1,
      sortBy: "name",
    });
    query = toggleSort(query, "name");
    expect(query).toMatchObject({ order: "desc", sortBy: "name" });
    query = toggleSort(query, "name");
    expect(query.sortBy).toBeNull();
  });

  it("sets and removes filters", () => {
    const query = setFilter(
      createDataTableQuery({ page: 2 }),
      "status",
      "active",
    );
    expect(query.filters).toEqual({ status: "active" });
    expect(query.page).toBe(1);
    expect(setFilter(query, "status", "").filters).toEqual({});
  });

  it("keeps the query of an unchanged filter, and so its page", () => {
    const query = createDataTableQuery({ filters: { status: "a" }, page: 3 });
    expect(setFilter(query, "status", "a")).toBe(query);
    expect(setFilter(query, "name", "")).toBe(query);
  });

  it("skips undefined overrides - an optional prop passed on", () => {
    const pageSize: number | undefined = undefined;

    expect(createDataTableQuery({ pageSize, sortBy: undefined })).toEqual(
      createDataTableQuery(),
    );
    expect(readQueryFromSearch("", { defaults: { pageSize } }).pageSize).toBe(
      20,
    );
    expect(
      writeQueryToSearch("", createDataTableQuery({ page: 2 }), {
        defaults: { page: undefined },
      }),
    ).toBe("?page=2");
    expect(
      resetPagination(createDataTableQuery({ page: 3, pageSize: 50 }), {
        pageSize,
      }),
    ).toMatchObject({ page: 1, pageSize: 50 });
  });
});

describe("request helpers", () => {
  it("maps to Relay arguments forward and backward", () => {
    const forward = createDataTableQuery({
      after: "c10",
      pageSize: 10,
      search: "an",
    });
    expect(toRelayVariables(forward)).toEqual({
      after: "c10",
      filters: undefined,
      first: 10,
      order: undefined,
      search: "an",
      sortBy: undefined,
    });
    const backward = createDataTableQuery({
      before: "c11",
      pageSize: 10,
      sortBy: "name",
    });
    expect(toRelayVariables(backward)).toMatchObject({
      before: "c11",
      last: 10,
      order: "asc",
      sortBy: "name",
    });
    expect(toRelayVariables(backward)).not.toHaveProperty("first");
  });

  it("maps to offset parameters", () => {
    expect(
      toOffsetParams(createDataTableQuery({ page: 3, pageSize: 25 })),
    ).toMatchObject({
      limit: 25,
      offset: 50,
      page: 3,
      pageSize: 25,
    });
  });
});

describe("URL state", () => {
  it("round-trips a query and keeps unrelated parameters", () => {
    const query = createDataTableQuery({
      filters: { status: "active" },
      order: "desc",
      page: 2,
      search: "nov",
      sortBy: "name",
    });
    const search = writeQueryToSearch("?tab=users", query, { prefix: "t_" });
    expect(search).toContain("tab=users");
    expect(readQueryFromSearch(search, { prefix: "t_" })).toEqual(query);
  });

  it("leaves defaults out of the URL and survives garbage", () => {
    expect(
      writeQueryToSearch("", createDataTableQuery({ pageSize: 50 }), {
        defaults: { pageSize: 50 },
      }),
    ).toBe("");
    expect(
      readQueryFromSearch("?page=abc&pageSize=-1&filters=%7Bbroken&order=up"),
    ).toEqual(createDataTableQuery());
  });

  it("accepts only the offered page sizes from the URL", () => {
    expect(readQueryFromSearch("?pageSize=50").pageSize).toBe(50);
    expect(readQueryFromSearch("?pageSize=1000000").pageSize).toBe(20);
    expect(
      readQueryFromSearch("?pageSize=40", { pageSizeOptions: [20, 40] })
        .pageSize,
    ).toBe(40);
    expect(
      readQueryFromSearch("?pageSize=50", {
        defaults: { pageSize: 40 },
        pageSizeOptions: [20, 40],
      }).pageSize,
    ).toBe(40);
  });

  it("compares and writes the filters in any order of their keys", () => {
    const defaults = { filters: { status: "active", team: "A" } };
    // Cleared and set again - the key moved to the end
    const query = setFilter(
      setFilter(createDataTableQuery(defaults), "status", ""),
      "status",
      "active",
    );

    expect(writeQueryToSearch("", query, { defaults })).toBe("");
    expect(
      writeQueryToSearch(
        "",
        createDataTableQuery({ filters: { b: "2", a: "1" } }),
      ),
    ).toBe(
      writeQueryToSearch(
        "",
        createDataTableQuery({ filters: { a: "1", b: "2" } }),
      ),
    );
  });

  it("records a turned-off default sorting", () => {
    const defaults = { sortBy: "name" };
    const search = writeQueryToSearch(
      "",
      createDataTableQuery({ sortBy: null }),
      { defaults },
    );
    expect(readQueryFromSearch(search, { defaults }).sortBy).toBeNull();
  });
});

describe("applyDataTableQuery", () => {
  const names = (query = createDataTableQuery()) =>
    applyDataTableQuery(rows, query, columns).rows.map((row) => row.name);

  it("filters by each filter type", () => {
    expect(names(createDataTableQuery({ filters: { name: "simon" } }))).toEqual(
      ["Šimon Novák"],
    );
    expect(
      names(createDataTableQuery({ filters: { status: "active" } })),
    ).toHaveLength(2);
    expect(
      names(createDataTableQuery({ filters: { born: "1990" } })),
    ).toHaveLength(2);
    expect(
      names(createDataTableQuery({ filters: { salary: "60000" } })),
    ).toEqual(["Zoë Weber"]);
  });

  it("ignores filters of no filterable column", () => {
    expect(
      names(createDataTableQuery({ filters: { id: "1", unknown: "x" } })),
    ).toHaveLength(4);
    // A `filterFn` filters without a `filter` field too
    expect(
      applyDataTableQuery(
        rows,
        createDataTableQuery({ filters: { id: "1" } }),
        [
          ...columns,
          {
            filterFn: (row, value) => String(row.id) === value,
            key: "id",
            label: "ID",
          },
        ],
      ).total,
    ).toBe(1);
  });

  it("searches the given columns, ignoring diacritics", () => {
    expect(names(createDataTableQuery({ search: "dvorak" }))).toEqual([
      "Karel Dvořák",
    ]);
    const byName = applyDataTableQuery(
      rows,
      createDataTableQuery({ search: "active" }),
      columns,
      {
        searchColumns: [columns[0]],
      },
    );
    expect(byName.total).toBe(0);
  });

  it("sorts with empty values last in both directions", () => {
    expect(
      names(createDataTableQuery({ order: "asc", sortBy: "salary" })),
    ).toEqual(["Karel Dvořák", "Šimon Novák", "Zoë Weber", "Anna Svobodová"]);
    expect(
      names(createDataTableQuery({ order: "desc", sortBy: "salary" })).at(-1),
    ).toBe("Anna Svobodová");
  });

  it("matches ISO date-times with a time zone by their local date", () => {
    // Just after midnight and just before it, local time - in any time zone
    // one of them lies on another day in UTC
    const moments = [
      new Date(2026, 8, 25, 0, 30),
      new Date(2026, 8, 24, 23, 30),
    ];
    const events = moments.map((moment, id) => ({
      id,
      at: moment.toISOString(),
    }));
    const eventColumns: Column<(typeof events)[number]>[] = [
      { filter: "datetime", key: "at", label: "At" },
    ];
    const matching = (filter: string) =>
      applyDataTableQuery(
        events,
        createDataTableQuery({ filters: { at: filter } }),
        eventColumns,
      ).rows.map((event) => event.id);

    expect(matching("2026-09-25")).toEqual([0]);
    expect(matching("2026-09-24")).toEqual([1]);
    expect(matching("2026-09-24T23:30")).toEqual([1]);
  });

  it("returns all rows without pagination", () => {
    const result = applyDataTableQuery(
      rows,
      createDataTableQuery({ page: 2, pageSize: 1 }),
      columns,
      { paginate: false },
    );
    expect(result).toMatchObject({ page: 1, total: 4 });
    expect(result.rows).toHaveLength(4);
  });

  it("pages and clamps a page past the end", () => {
    const result = applyDataTableQuery(
      rows,
      createDataTableQuery({ page: 9, pageSize: 3 }),
      columns,
    );
    expect(result).toMatchObject({ page: 2, total: 4 });
    expect(result.rows).toHaveLength(1);
  });

  it("clamps a page before the first one or between two", () => {
    const pageOf = (page: number) =>
      applyDataTableQuery(
        rows,
        createDataTableQuery({ page, pageSize: 2 }),
        columns,
      );

    for (const page of [-1, 0, Number.NaN]) {
      expect(pageOf(page).page).toBe(1);
      expect(pageOf(page).rows.map((row) => row.id)).toEqual([1, 2]);
    }
    expect(pageOf(1.5).page).toBe(1);
    expect(pageOf(1.5).rows.map((row) => row.id)).toEqual([1, 2]);
    expect(pageOf(2.9).rows.map((row) => row.id)).toEqual([3, 4]);
  });

  it("sorts numbers stored as strings by their value", () => {
    // Money from an API - Intl.Collator's `numeric` ignores signs and
    // decimal points
    const amounts = ["1.5", "-3", "10", "1.25", "-20", "9.75", "", "0.5"].map(
      (amount, id) => ({ amount, id }),
    );
    const sorted = (order: "asc" | "desc") =>
      applyDataTableQuery(
        amounts,
        createDataTableQuery({ order, sortBy: "amount" }),
        [{ key: "amount", label: "Amount", sortable: true }],
      ).rows.map((row) => row.amount);

    expect(sorted("asc")).toEqual([
      "-20",
      "-3",
      "0.5",
      "1.25",
      "1.5",
      "9.75",
      "10",
      "",
    ]);
    expect(sorted("desc")).toEqual([
      "10",
      "9.75",
      "1.5",
      "1.25",
      "0.5",
      "-3",
      "-20",
      "",
    ]);
  });

  it("compares texts with a shared collator", () => {
    // `localeCompare` with a locale sets up the collation on every call -
    // sorting 10 000 rows took hundreds of milliseconds
    const localeCompare = vi.spyOn(String.prototype, "localeCompare");

    expect(
      names(createDataTableQuery({ order: "desc", sortBy: "name" })),
    ).toEqual(["Zoë Weber", "Šimon Novák", "Karel Dvořák", "Anna Svobodová"]);
    expect(localeCompare).not.toHaveBeenCalled();
  });

  it("finds, filters and sorts arrays by their items", () => {
    const tagged = [
      { id: 1, tags: ["beta", "gamma"] },
      { id: 2, tags: ["alpha"] },
      { id: 3, tags: [] },
    ];
    const tagColumns: Column<(typeof tagged)[number]>[] = [
      { filter: "select", key: "tags", label: "Tags", sortable: true },
    ];
    const ids = (query: Parameters<typeof createDataTableQuery>[0]) =>
      applyDataTableQuery(
        tagged,
        createDataTableQuery(query),
        tagColumns,
      ).rows.map((row) => row.id);

    expect(ids({ search: "gam" })).toEqual([1]);
    expect(ids({ search: "beta, gamma" })).toEqual([1]);
    expect(ids({ filters: { tags: "gamma" } })).toEqual([1]);
    expect(ids({ filters: { tags: "alpha" } })).toEqual([2]);
    expect(ids({ sortBy: "tags" })).toEqual([2, 1, 3]);
  });
});

describe("findMatches", () => {
  it("finds matches ignoring case and diacritics", () => {
    expect(findMatches("Šimon a Simona", "sim")).toEqual([
      [0, 3],
      [8, 11],
    ]);
    expect(findMatches("Anything", "")).toEqual([]);
  });
});
