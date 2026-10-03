import { describe, expect, it } from "vitest";
import {
  applyDataTableQuery,
  createDataTableQuery,
  type DataTableFilterValue,
} from "./query";
import type { Column } from "./types";

type Amount = number | string | bigint;
const columns: Column<{ amount: Amount; id: number }>[] = [
  { filter: "numberRange", key: "amount", label: "Amount" },
];

describe("DataTable exact numeric comparisons", () => {
  it.each(["asc", "desc"] as const)(
    "sorts distinct decimal strings in %s order, including underflow",
    (order) => {
      const ascending = [
        "-0.10000000000000001",
        "-0.1",
        "-1e-400",
        "0",
        "1e-400",
        "2e-400",
        "0.1",
        "0.10000000000000001",
      ];
      const input = order === "asc" ? [...ascending].reverse() : ascending;
      const rows = input.map((amount, id) => ({ amount, id }));
      expect(
        applyDataTableQuery(
          rows,
          createDataTableQuery({ order, sortBy: "amount" }),
          columns,
        ).rows.map((row) => row.amount),
      ).toEqual(order === "asc" ? ascending : [...ascending].reverse());
    },
  );

  it.each(["asc", "desc"] as const)(
    "sorts bigint, numbers and numeric strings together in %s order",
    (order) => {
      const ascending: Amount[] = [
        -Infinity,
        -(10n ** 400n),
        "-9007199254740993.5",
        -9007199254740993n,
        -20n,
        -3n,
        -1,
        0n,
        "0.5",
        9007199254740992n,
        "9007199254740992.5",
        9007199254740993n,
        10n ** 400n,
        Infinity,
      ];
      const input = order === "asc" ? [...ascending].reverse() : ascending;
      const rows = input.map((amount, id) => ({ amount, id }));
      expect(
        applyDataTableQuery(
          rows,
          createDataTableQuery({ order, sortBy: "amount" }),
          columns,
        ).rows.map((row) => row.amount),
      ).toEqual(order === "asc" ? ascending : [...ascending].reverse());
    },
  );

  it("keeps equal numeric values tied for the next sort column", () => {
    const rows = [1n, "1.00", 1, "1e0"].map((amount, id) => ({ amount, id }));
    expect(
      applyDataTableQuery(
        rows,
        createDataTableQuery({
          sort: [
            { key: "amount", order: "asc" },
            { key: "id", order: "desc" },
          ],
        }),
        [...columns, { key: "id", label: "Id" }],
      ).rows,
    ).toEqual([...rows].reverse());
  });

  it.each<{
    values: Amount[];
    filter: DataTableFilterValue;
    expected: Amount[];
  }>([
    {
      values: ["9007199254740993", "9007199254740992"],
      filter: { to: "9007199254740992" },
      expected: ["9007199254740992"],
    },
    {
      values: ["-9007199254740993", "-9007199254740992"],
      filter: { from: "-9007199254740992" },
      expected: ["-9007199254740992"],
    },
    {
      values: ["0.10000000000000001", "0.1"],
      filter: { from: "0.10000000000000001" },
      expected: ["0.10000000000000001"],
    },
    {
      values: ["0.10000000000000001", "0.1"],
      filter: "0.1",
      expected: ["0.1"],
    },
    {
      values: [-20n, -3n, -1n, "-3.0"],
      filter: { from: "-3", to: "-1" },
      expected: [-3n, -1n, "-3.0"],
    },
    {
      values: [1n, 1, "1e0", "1.0000000000000001"],
      filter: "1",
      expected: [1n, 1, "1e0"],
    },
    {
      values: ["-1e-400", "0", "1e-400", "2e-400"],
      filter: { from: "1e-400", to: "1e-400" },
      expected: ["1e-400"],
    },
    {
      values: [10n ** 400n, Infinity, "2e400"],
      filter: { to: "1e400" },
      expected: [10n ** 400n],
    },
  ])(
    "filters $values by $filter without rounding across a bound",
    ({ values, filter, expected }) => {
      const rows = values.map((amount, id) => ({ amount, id }));
      expect(
        applyDataTableQuery(
          rows,
          createDataTableQuery({ filters: { amount: filter } }),
          columns,
        ).rows.map((row) => row.amount),
      ).toEqual(expected);
    },
  );
});
