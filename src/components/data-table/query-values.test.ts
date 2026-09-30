import { describe, expect, it, vi } from "vitest";
import {
  applyDataTableQuery,
  createDataTableQuery,
  getQuerySort,
  isSameFilters,
  isSameQuery,
  readQueryFromSearch,
  resetPagination,
  setFilter,
  toFilterParams,
  toggleSort,
  toOffsetParams,
  toRelayVariables,
  writeQueryToSearch,
  type DataTableQuery,
} from "./query";
import type { Column } from "./types";

interface Row {
  born: string | null;
  id: number;
  joined: Date | null;
  name: string;
  salary: number | string | null;
  status: string;
  team: string;
}

const rows: Row[] = [
  {
    born: "1990-05-01",
    id: 1,
    joined: new Date(2026, 8, 24, 10, 30),
    name: "Šimon",
    salary: 50_000,
    status: "active",
    team: "B",
  },
  {
    born: "1985-12-24",
    id: 2,
    joined: new Date(2026, 8, 20),
    name: "Anna",
    salary: null,
    status: "invited",
    team: "A",
  },
  {
    born: "1990-01-15",
    id: 3,
    joined: new Date(2026, 8, 30, 23, 59),
    name: "Zoë",
    salary: "70000.50",
    status: "active",
    team: "A",
  },
  {
    born: null,
    id: 4,
    joined: null,
    name: "Karel",
    salary: 30_000,
    status: "suspended",
    team: "B",
  },
];

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name", sortable: true },
  { filter: "multiSelect", key: "status", label: "Status" },
  { filter: "dateRange", key: "born", label: "Born", sortable: true },
  { filter: "date", key: "joined", label: "Joined" },
  { filter: "numberRange", key: "salary", label: "Salary", sortable: true },
  { filter: "select", key: "team", label: "Team", sortable: true },
];

const ids = (query: Partial<DataTableQuery>) =>
  applyDataTableQuery(rows, createDataTableQuery(query), columns).rows.map(
    (row) => row.id,
  );

describe("filter values", () => {
  it("matches any value of a list", () => {
    expect(ids({ filters: { status: ["active", "suspended"] } })).toEqual([
      1, 3, 4,
    ]);
    // A select filter given a list, and a text filter - any of them
    expect(ids({ filters: { team: ["A"] } })).toEqual([2, 3]);
    expect(ids({ filters: { name: ["an", "ar"] } })).toEqual([2, 4]);
  });

  it("matches numbers in a range, also numbers stored as texts", () => {
    expect(ids({ filters: { salary: { from: "40000" } } })).toEqual([1, 3]);
    expect(ids({ filters: { salary: { to: "50000" } } })).toEqual([1, 4]);
    expect(
      ids({ filters: { salary: { from: "30000", to: "70000.5" } } }),
    ).toEqual([1, 3, 4]);
    // An empty value lies in no range
    expect(ids({ filters: { salary: { from: "-1" } } })).not.toContain(2);
  });

  it("matches days in a range - the last day as a whole", () => {
    expect(
      ids({ filters: { born: { from: "1990-01-01", to: "1990-05-01" } } }),
    ).toEqual([1, 3]);
    expect(
      ids({ filters: { joined: { from: "2026-09-24", to: "2026-09-30" } } }),
    ).toEqual([1, 3]);
    expect(ids({ filters: { joined: { to: "2026-09-24" } } })).toEqual([1, 2]);
  });

  it("keeps a single day of a date filter", () => {
    expect(ids({ filters: { joined: "2026-09-30" } })).toEqual([3]);
  });

  it.each(["date", "datetime", "dateRange"] as const)(
    "matches %s filters against each date in a cell",
    (filter) => {
      const earlier = new Date(2026, 8, 24, 23, 30);
      const later = new Date(2026, 8, 30, 0, 30);
      const rows = [
        { id: 1, dates: ["2026-09-24", "2026-09-30"] },
        { id: 2, dates: [earlier, later] },
        { id: 3, dates: [earlier.toISOString(), later.toISOString()] },
        { id: 4, dates: ["2026-09-24"] },
        { id: 5, dates: [] },
      ];
      const columns = [{ filter, key: "dates", label: "Dates" }];
      const matching = (value: string) =>
        applyDataTableQuery(
          rows,
          createDataTableQuery({ filters: { dates: value } }),
          columns,
        ).rows.map((row) => row.id);

      expect(matching("2026-09-30")).toEqual([1, 2, 3]);
      expect(matching("2026-09-30T00:30")).toEqual([2, 3]);
      expect(matching("2026-10-01")).toEqual([]);
    },
  );

  it("matches time filters against each time in a cell", () => {
    const earlier = new Date(2026, 8, 24, 8);
    const later = new Date(2026, 8, 30, 10, 30);
    const rows = [
      { id: 1, times: ["08:00", "10:30"] },
      { id: 2, times: [earlier, later] },
      { id: 3, times: [earlier.toISOString(), later.toISOString()] },
      { id: 4, times: ["2026-09-24T08:00", "2026-09-30T10:30"] },
      { id: 5, times: ["08:00"] },
      { id: 6, times: [] },
    ];
    const result = applyDataTableQuery(
      rows,
      createDataTableQuery({ filters: { times: "10:30" } }),
      [{ filter: "time", key: "times", label: "Times" }],
    );

    expect(result.rows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });

  it("matches a single numeric filter against each amount in a cell", () => {
    const rows = [
      { id: 1, amounts: [1, "2.00"] },
      { id: 2, amounts: [1n, "9007199254740993"] },
      { id: 3, amounts: [1] },
      { id: 4, amounts: [] },
    ];
    const columns: Column<(typeof rows)[number]>[] = [
      { filter: "numberRange", key: "amounts", label: "Amounts" },
    ];
    const matching = (value: string) =>
      applyDataTableQuery(
        rows,
        createDataTableQuery({ filters: { amounts: value } }),
        columns,
      ).rows.map((row) => row.id);

    expect(matching("2")).toEqual([1]);
    expect(matching("9007199254740993")).toEqual([2]);
    expect(matching("9007199254740992")).toEqual([]);
  });

  it("gives filterFn the text and the value", () => {
    const filterFn = vi.fn(() => true);
    applyDataTableQuery(
      rows,
      createDataTableQuery({ filters: { status: ["active"], name: "a" } }),
      [
        { filter: "custom", filterFn, key: "status", label: "Status" },
        { filter: "custom", filterFn, key: "name", label: "Name" },
      ],
    );

    expect(filterFn).toHaveBeenCalledWith(rows[0], "", ["active"]);
    expect(filterFn).toHaveBeenCalledWith(rows[0], "a", "a");
  });

  it("sets lists and ranges, and removes empty ones", () => {
    let query = setFilter(createDataTableQuery({ page: 3 }), "status", [
      "active",
      "",
      "active",
      "invited",
    ]);
    expect(query.filters).toEqual({ status: ["active", "invited"] });
    expect(query.page).toBe(1);

    query = setFilter(query, "salary", { from: "", to: "5" });
    expect(query.filters.salary).toEqual({ to: "5" });

    // Unchanged - the same query
    expect(setFilter(query, "status", ["active", "invited"])).toBe(query);
    expect(setFilter(query, "salary", { to: "5" })).toBe(query);

    query = setFilter(setFilter(query, "status", []), "salary", {});
    expect(query.filters).toEqual({});
  });

  it("compares lists and ranges by value", () => {
    expect(
      isSameFilters(
        { a: ["x", "y"], b: { from: "1", to: "2" } },
        { b: { to: "2", from: "1" }, a: ["x", "y"] },
      ),
    ).toBe(true);
    expect(isSameFilters({ a: ["x", "y"] }, { a: ["y", "x"] })).toBe(false);
    expect(isSameFilters({ a: [] }, {})).toBe(true);
    expect(isSameFilters({ a: "x" }, { a: ["x"] })).toBe(false);
  });

  it("round-trips lists and ranges through the URL", () => {
    const query = createDataTableQuery({
      filters: {
        name: "an",
        salary: { from: "1000", to: "5000" },
        status: ["active", "invited"],
      },
    });
    const search = writeQueryToSearch("", query);

    expect(readQueryFromSearch(search)).toEqual(query);
    // A range written in any order of its bounds makes the same URL
    expect(
      writeQueryToSearch(
        "",
        createDataTableQuery({
          filters: {
            name: "an",
            salary: { to: "5000", from: "1000" },
            status: ["active", "invited"],
          },
        }),
      ),
    ).toBe(search);
  });

  it("reads the text filters of older URLs", () => {
    const search = `?filters=${encodeURIComponent('{"team":"A"}')}`;
    expect(readQueryFromSearch(search).filters).toEqual({ team: "A" });
  });

  it("makes REST parameters of the filters", () => {
    const filters = {
      salary: { from: "1000" },
      status: ["active", "invited"],
      team: "A",
    };

    expect(toFilterParams(filters)).toEqual([
      ["salary[from]", "1000"],
      ["status", "active"],
      ["status", "invited"],
      ["team", "A"],
    ]);
    expect(
      new URLSearchParams(
        toFilterParams(filters, { prefix: "filter" }),
      ).toString(),
    ).toBe(
      "filter%5Bsalary%5D%5Bfrom%5D=1000&filter%5Bstatus%5D=active&filter%5Bstatus%5D=invited&filter%5Bteam%5D=A",
    );
    expect(toFilterParams({ a: "", b: [], c: {} })).toEqual([]);
  });
});

describe("sorting by several columns", () => {
  it("adds, turns and drops columns with multi", () => {
    let query = toggleSort(createDataTableQuery({ page: 2 }), "team");
    query = toggleSort(query, "name", { multi: true });
    expect(query.sort).toEqual([
      { key: "team", order: "asc" },
      { key: "name", order: "asc" },
    ]);
    expect(query).toMatchObject({ order: "asc", page: 1, sortBy: "team" });

    query = toggleSort(query, "name", { multi: true });
    expect(query.sort[1]).toEqual({ key: "name", order: "desc" });

    query = toggleSort(query, "team", { multi: true });
    query = toggleSort(query, "team", { multi: true });
    // The first column dropped - the next one leads
    expect(query.sort).toEqual([{ key: "name", order: "desc" }]);
    expect(query).toMatchObject({ order: "desc", sortBy: "name" });
  });

  it("sorts by the clicked column alone without multi", () => {
    let query = createDataTableQuery({
      sort: [
        { key: "team", order: "asc" },
        { key: "name", order: "desc" },
      ],
    });

    // A column further down starts ascending, the first one goes on
    query = toggleSort(query, "name");
    expect(query.sort).toEqual([{ key: "name", order: "asc" }]);
    query = toggleSort(query, "salary", { multi: true });
    query = toggleSort(query, "name");
    expect(query.sort).toEqual([{ key: "name", order: "desc" }]);
    query = toggleSort(query, "salary");
    expect(query.sort).toEqual([{ key: "salary", order: "asc" }]);
  });

  it("keeps sort and sortBy / order in step", () => {
    expect(
      createDataTableQuery({ sort: [{ key: "a", order: "desc" }] }),
    ).toMatchObject({ order: "desc", sortBy: "a" });
    expect(createDataTableQuery({ order: "desc", sortBy: "a" }).sort).toEqual([
      { key: "a", order: "desc" },
    ]);

    const query = createDataTableQuery({
      sort: [
        { key: "a", order: "asc" },
        { key: "b", order: "asc" },
      ],
    });
    // Code knowing only `sortBy` - the column it names alone
    expect(getQuerySort({ ...query, sortBy: "c" })).toEqual([
      { key: "c", order: "asc" },
    ]);
    expect(getQuerySort({ ...query, order: "desc" })).toEqual([
      { key: "a", order: "desc" },
    ]);
    expect(resetPagination(query, { sortBy: null }).sort).toEqual([]);
    expect(
      resetPagination(query, { sort: [{ key: "b", order: "desc" }] }),
    ).toMatchObject({ order: "desc", sortBy: "b" });
    // A query of older code without `sort`
    expect(
      getQuerySort({ order: "asc", sortBy: "a" } as DataTableQuery),
    ).toEqual([{ key: "a", order: "asc" }]);
  });

  it("compares the whole sorting", () => {
    const query = toggleSort(createDataTableQuery(), "a");
    expect(isSameQuery(query, toggleSort(query, "b", { multi: true }))).toBe(
      false,
    );
    expect(isSameQuery(query, createDataTableQuery({ sortBy: "a" }))).toBe(
      true,
    );
  });

  it("sorts stably by each column in turn, empty values last", () => {
    expect(
      ids({
        sort: [
          { key: "team", order: "asc" },
          { key: "salary", order: "desc" },
        ],
      }),
    ).toEqual([3, 2, 1, 4]);
    expect(
      ids({
        sort: [
          { key: "born", order: "desc" },
          { key: "name", order: "asc" },
        ],
      }),
    ).toEqual([1, 3, 2, 4]);
    // Rows equal in every column keep their order
    expect(ids({ sort: [{ key: "team", order: "desc" }] })).toEqual([
      1, 4, 2, 3,
    ]);
    // A key of no column is left out
    expect(
      ids({
        sort: [
          { key: "nothing", order: "asc" },
          { key: "name", order: "asc" },
        ],
      }),
    ).toEqual([2, 4, 1, 3]);
  });

  it("writes one column as before and several in `sort`", () => {
    const single = createDataTableQuery({ order: "desc", sortBy: "name" });
    expect(writeQueryToSearch("", single)).toBe("?sortBy=name&order=desc");

    const multi = toggleSort(
      toggleSort(single, "team", { multi: true }),
      "team",
      { multi: true },
    );
    const search = writeQueryToSearch("", multi);
    expect(search).toBe("?sort=-name%2C-team");
    expect(readQueryFromSearch(search)).toEqual(multi);

    // Back to one column - `sort` goes, `sortBy` comes back
    expect(writeQueryToSearch(search, single)).toBe("?sortBy=name&order=desc");
  });

  it("brings back any column key from the URL", () => {
    const query = createDataTableQuery({
      sort: [
        { key: "-a,b%", order: "asc" },
        { key: "c", order: "desc" },
      ],
    });
    expect(readQueryFromSearch(writeQueryToSearch("", query)).sort).toEqual(
      query.sort,
    );
    // Garbage falls back to `sortBy`, each column counts once
    expect(readQueryFromSearch("?sort=%25zz,&sortBy=x").sort).toEqual([
      { key: "x", order: "asc" },
    ]);
    expect(readQueryFromSearch("?sort=a,-a,b").sort).toEqual([
      { key: "a", order: "asc" },
      { key: "b", order: "asc" },
    ]);
  });

  it("keeps a default sorting by several columns apart", () => {
    const defaults = {
      sort: [
        { key: "a", order: "asc" as const },
        { key: "b", order: "asc" as const },
      ],
    };

    expect(
      writeQueryToSearch("", createDataTableQuery(defaults), { defaults }),
    ).toBe("");
    expect(readQueryFromSearch("", { defaults }).sort).toEqual(defaults.sort);

    // The first column alone differs from the default
    const first = createDataTableQuery({ sortBy: "a" });
    const search = writeQueryToSearch("", first, { defaults });
    expect(readQueryFromSearch(search, { defaults }).sort).toEqual([
      { key: "a", order: "asc" },
    ]);

    // Turned off
    const none = writeQueryToSearch("", createDataTableQuery(), { defaults });
    expect(readQueryFromSearch(none, { defaults }).sort).toEqual([]);
  });

  it("passes the sorting to the request helpers", () => {
    const query = toggleSort(toggleSort(createDataTableQuery(), "a"), "b", {
      multi: true,
    });
    const sort = [
      { key: "a", order: "asc" },
      { key: "b", order: "asc" },
    ];

    expect(toOffsetParams(query)).toMatchObject({
      order: "asc",
      sort,
      sortBy: "a",
    });
    expect(toRelayVariables(query)).toMatchObject({
      order: "asc",
      sort,
      sortBy: "a",
    });
    expect(toOffsetParams(createDataTableQuery()).sort).toEqual([]);
    expect(toRelayVariables(createDataTableQuery()).sort).toBeUndefined();
  });
});
