import { describe, expect, it } from "vitest";
import {
  applyDataTableQuery,
  compareSortKeys,
  createDataTableQuery,
  getCollator,
  toSortKey,
} from "./query";

describe("DataTable mixed value sorting", () => {
  it.each(["asc", "desc"] as const)(
    "keeps numbers in %s order regardless of input order or text cells",
    (order) => {
      const values = [-2, "-3 pending", -10];
      const ascending = [-10, -2, "-3 pending"];
      for (let offset = 0; offset < values.length; offset++) {
        const rotated = [...values.slice(offset), ...values.slice(0, offset)];
        for (const input of [rotated, [...rotated].reverse()]) {
          const result = applyDataTableQuery(
            [...input, null].map((value, id) => ({ id, value })),
            createDataTableQuery({ order, sortBy: "value" }),
            [{ key: "value", label: "Value" }],
          );
          expect(result.rows.map((row) => row.value)).toEqual([
            ...(order === "asc" ? ascending : [...ascending].reverse()),
            null,
          ]);
        }
      }
    },
  );

  it("keeps equal numeric representations tied for subsequent sort columns next to text", () => {
    const rows = ["-3 pending", "-2.00", -2n, -10, "-2e0"].map((value, id) => ({
      id,
      value,
    }));
    const result = applyDataTableQuery(
      rows,
      createDataTableQuery({
        sort: [
          { key: "value", order: "asc" },
          { key: "id", order: "desc" },
        ],
      }),
      [
        { key: "value", label: "Value" },
        { key: "id", label: "Id" },
      ],
    );
    expect(result.rows.map((row) => row.id)).toEqual([3, 4, 2, 1, 0]);
  });

  it.each([1, -1] as const)(
    "compares mixed values transitively in direction %s",
    (direction) => {
      const keys = [
        -10,
        -2n,
        "-2.0",
        "-3 pending",
        "1.25",
        "1.5",
        "1.3 pending",
        new Date(2026, 8, 30, 10, 0, 1),
        new Date(2026, 8, 30, 10, 0, 2),
        "2026-09-30T10:00",
        "2026-09-30",
        // Moments, earlier than their texts suggest, and no moment at all
        "2026-09-30T09:00:00Z",
        "2026-09-30T10:00:00+02:00",
        "2026-09-30T99:00:00Z",
        false,
        "false",
        true,
        "true",
        ["-2.0"],
        null,
        NaN,
        "",
      ].map(toSortKey);
      const collator = getCollator("en-US");
      for (const a of keys) {
        for (const b of keys) {
          if (compareSortKeys(a, b, collator, direction) > 0) continue;
          for (const c of keys) {
            if (compareSortKeys(b, c, collator, direction) > 0) continue;
            expect(
              compareSortKeys(a, c, collator, direction),
            ).toBeLessThanOrEqual(0);
          }
        }
      }
    },
  );
});
