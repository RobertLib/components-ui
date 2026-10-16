import { describe, expect, it, vi } from "vitest";
import { matchesFilter } from "./match";
import { compactFilter, convertValue, isConditionComplete } from "./operators";
import type {
  FilterCondition,
  FilterField,
  FilterGroup,
  FilterNode,
} from "./types";

interface Invoice {
  customer: string;
  dueDate: string | Date | null;
  issuedAt?: string | number | Date;
  note?: string | null;
  paid: boolean | null;
  status: string;
  tags: string[];
  total: number | string | null;
}

const fields: FilterField<Invoice>[] = [
  { key: "customer", label: "Customer", type: "text" },
  { key: "total", label: "Total", type: "number" },
  { key: "dueDate", label: "Due date", type: "date" },
  { key: "issuedAt", label: "Issued", type: "datetime" },
  {
    key: "status",
    label: "Status",
    options: [
      { label: "Paid", value: "paid" },
      { label: "Overdue", value: "overdue" },
    ],
    type: "select",
  },
  { key: "tags", label: "Tags", type: "multiSelect" },
  { key: "paid", label: "Paid", type: "boolean" },
  { key: "note", label: "Note", type: "text" },
];

const invoice: Invoice = {
  customer: "Příliš žluťoučký kůň s.r.o.",
  dueDate: "2026-10-15",
  issuedAt: "2026-10-01T14:30",
  note: null,
  paid: false,
  status: "overdue",
  tags: ["VIP", "Export"],
  total: 12_500,
};

const where = (...conditions: FilterNode[]): FilterGroup => ({
  combinator: "and",
  conditions,
});

const matches = (
  condition: FilterCondition,
  row: Invoice = invoice,
  fieldList = fields,
) => matchesFilter(row, where(condition), fieldList);

describe("matchesFilter", () => {
  it("matches every record without conditions", () => {
    expect(matchesFilter(invoice, null, fields)).toBe(true);
    expect(matchesFilter(invoice, undefined, fields)).toBe(true);
    expect(matchesFilter(invoice, where(), fields)).toBe(true);
  });

  it("compares text ignoring case, accents and the spaces around the term", () => {
    const customer = (operator: FilterCondition["operator"], value: string) =>
      matches({ field: "customer", operator, value });

    expect(customer("contains", " ZLUTOUCKY ")).toBe(true);
    expect(customer("contains", "kun s.r.o")).toBe(true);
    expect(customer("contains", "kobyla")).toBe(false);
    expect(customer("notContains", "kobyla")).toBe(true);
    expect(customer("startsWith", "prilis")).toBe(true);
    expect(customer("startsWith", "zlutoucky")).toBe(false);
    expect(customer("endsWith", "S.R.O.")).toBe(true);
    expect(customer("equals", "příliš žluťoučký kůň S.R.O.")).toBe(true);
    expect(customer("equals", "Příliš")).toBe(false);
    expect(customer("notEquals", "Příliš")).toBe(true);
  });

  it("compares numbers - also numbers stored as text", () => {
    const total = (
      operator: FilterCondition["operator"],
      value: FilterCondition["value"],
      row = invoice,
    ) => matches({ field: "total", operator, value }, row);

    expect(total("equals", 12_500)).toBe(true);
    expect(total("notEquals", 12_500)).toBe(false);
    expect(total("greaterThan", 12_500)).toBe(false);
    expect(total("greaterThanOrEqual", 12_500)).toBe(true);
    expect(total("lessThan", 20_000)).toBe(true);
    expect(total("lessThanOrEqual", 10_000)).toBe(false);
    expect(total("between", { from: 10_000, to: 12_500 })).toBe(true);
    expect(total("between", { from: 12_501 })).toBe(false);
    expect(total("between", { to: 12_500 })).toBe(true);
    expect(total("greaterThan", 9, { ...invoice, total: "10.5" })).toBe(true);
    // Other text is no number - neither more nor less than one
    expect(total("greaterThan", 1_000, { ...invoice, total: "N/A" })).toBe(
      false,
    );
    expect(total("lessThan", 5, { ...invoice, total: "10 kg" })).toBe(false);
    expect(
      total("between", { from: 1, to: 20 }, { ...invoice, total: "9,5" }),
    ).toBe(false);
    expect(total("equals", "N/A", { ...invoice, total: "n/a" })).toBe(true);
    expect(total("notEquals", 5, { ...invoice, total: "N/A" })).toBe(true);
    // No value is in no range
    expect(total("lessThan", 100, { ...invoice, total: null })).toBe(false);
    expect(total("between", { to: 100 }, { ...invoice, total: null })).toBe(
      false,
    );
  });

  it("compares days - a Date, an ISO text and a moment of the day", () => {
    const due = (
      operator: FilterCondition["operator"],
      value: FilterCondition["value"],
      dueDate: Invoice["dueDate"] = invoice.dueDate,
    ) =>
      matches({ field: "dueDate", operator, value }, { ...invoice, dueDate });

    expect(due("on", "2026-10-15")).toBe(true);
    expect(due("on", "2026-10-15", new Date(2026, 9, 15, 23, 59))).toBe(true);
    expect(due("on", "2026-10-15", "2026-10-15T08:00")).toBe(true);
    expect(due("before", "2026-10-15")).toBe(false);
    expect(due("before", "2026-10-16")).toBe(true);
    expect(due("after", "2026-10-14")).toBe(true);
    expect(due("onOrBefore", "2026-10-15")).toBe(true);
    expect(due("onOrAfter", "2026-10-16")).toBe(false);
    expect(due("between", { from: "2026-10-01", to: "2026-10-15" })).toBe(true);
    // The last day of a range is whole
    expect(
      due(
        "between",
        { from: "2026-10-01", to: "2026-10-15" },
        new Date(2026, 9, 15, 18),
      ),
    ).toBe(true);
    expect(due("before", "2026-10-16", null)).toBe(false);
    expect(due("isEmpty", undefined, null)).toBe(true);
  });

  it("compares moments - also of another time zone in the local time", () => {
    const issued = (
      operator: FilterCondition["operator"],
      value: FilterCondition["value"],
      issuedAt: Invoice["issuedAt"] = invoice.issuedAt,
    ) =>
      matches({ field: "issuedAt", operator, value }, { ...invoice, issuedAt });

    expect(issued("before", "2026-10-01T14:31")).toBe(true);
    expect(issued("before", "2026-10-01T14:30")).toBe(false);
    expect(issued("after", "2026-10-01T14:00")).toBe(true);
    expect(issued("on", "2026-10-01")).toBe(true);
    expect(
      issued("between", { from: "2026-10-01T14:00", to: "2026-10-01T14:30" }),
    ).toBe(true);

    const moment = new Date(2026, 9, 1, 9, 15);
    expect(issued("on", "2026-10-01", moment.toISOString())).toBe(true);
    expect(issued("after", "2026-10-01T09:00", moment.getTime())).toBe(true);
    expect(issued("after", "2026-10-01T09:15", moment)).toBe(false);
  });

  it("compares moments written with a space for the `T`, as SQL does", () => {
    const issued = (
      operator: FilterCondition["operator"],
      value: FilterCondition["value"],
      issuedAt: Invoice["issuedAt"],
    ) =>
      matches({ field: "issuedAt", operator, value }, { ...invoice, issuedAt });

    expect(issued("after", "2026-10-01T14:00", "2026-10-01 16:00:00")).toBe(
      true,
    );
    expect(issued("before", "2026-10-01T14:00", "2026-10-01 16:00:00")).toBe(
      false,
    );
    expect(issued("before", "2026-10-01T14:00", "2026-10-01t13:00")).toBe(true);
    // With a time zone - in the local time
    const moment = new Date(2026, 9, 1, 9, 15);
    const zoned = moment.toISOString().replace("T", " ").toLowerCase();
    expect(issued("after", "2026-10-01T09:00", zoned)).toBe(true);
    expect(issued("after", "2026-10-01T09:15", zoned)).toBe(false);
  });

  it("compares the values of options exactly - 1 is “1”", () => {
    const status = (
      operator: FilterCondition["operator"],
      value: FilterCondition["value"],
    ) => matches({ field: "status", operator, value });

    expect(status("equals", "overdue")).toBe(true);
    expect(status("equals", "Overdue")).toBe(false);
    expect(status("notEquals", "paid")).toBe(true);
    expect(status("in", ["paid", "overdue"])).toBe(true);
    expect(status("notIn", ["paid", "overdue"])).toBe(false);
    expect(status("notIn", ["paid"])).toBe(true);

    expect(
      matches(
        { field: "status", operator: "in", value: [1, 2] },
        { ...invoice, status: "2" },
      ),
    ).toBe(true);
  });

  it("matches the lists of a record - any, all or none of the values", () => {
    const tags = (
      operator: FilterCondition["operator"],
      value: FilterCondition["value"],
      row = invoice,
    ) => matches({ field: "tags", operator, value }, row);

    expect(tags("hasAny", ["VIP", "Partner"])).toBe(true);
    expect(tags("hasAll", ["VIP", "Partner"])).toBe(false);
    expect(tags("hasAll", ["Export", "VIP"])).toBe(true);
    expect(tags("hasNone", ["Partner"])).toBe(true);
    expect(tags("hasNone", ["VIP"])).toBe(false);
    expect(tags("isEmpty", undefined)).toBe(false);
    expect(tags("isEmpty", undefined, { ...invoice, tags: [] })).toBe(true);
    expect(tags("hasNone", ["VIP"], { ...invoice, tags: [] })).toBe(true);
    // Text in a list - any of its items
    expect(
      matches(
        { field: "customer", operator: "contains", value: "export" },
        {
          ...invoice,
          customer: ["Alza", "Export s.r.o."] as unknown as string,
        },
      ),
    ).toBe(true);
  });

  it("compares booleans - no value is neither", () => {
    const paid = (value: boolean, row = invoice) =>
      matches({ field: "paid", operator: "equals", value }, row);

    expect(paid(false)).toBe(true);
    expect(paid(true)).toBe(false);
    expect(paid(true, { ...invoice, paid: true })).toBe(true);
    expect(paid(false, { ...invoice, paid: null })).toBe(false);
    expect(paid(true, { ...invoice, paid: "true" as unknown as boolean })).toBe(
      true,
    );
  });

  it("tells empty values - also blank text, NaN and an empty list", () => {
    const note = (note: unknown) =>
      matches(
        { field: "note", operator: "isEmpty" },
        { ...invoice, note: note as string },
      );

    expect(note(null)).toBe(true);
    expect(note(undefined)).toBe(true);
    expect(note("")).toBe(true);
    expect(note("   ")).toBe(true);
    expect(note(Number.NaN)).toBe(true);
    expect(note([])).toBe(true);
    expect(note("Call first")).toBe(false);
    expect(
      matches(
        { field: "note", operator: "isNotEmpty" },
        {
          ...invoice,
          note: "x",
        },
      ),
    ).toBe(true);
    // A negative operator matches no value
    expect(
      matches({ field: "note", operator: "notContains", value: "call" }),
    ).toBe(true);
  });

  it("joins the conditions of groups by AND and OR", () => {
    const filter: FilterGroup = {
      combinator: "and",
      conditions: [
        { field: "status", operator: "equals", value: "overdue" },
        {
          combinator: "or",
          conditions: [
            { field: "total", operator: "greaterThan", value: 50_000 },
            { field: "tags", operator: "hasAny", value: ["VIP"] },
          ],
        },
      ],
    };
    expect(matchesFilter(invoice, filter, fields)).toBe(true);
    expect(matchesFilter({ ...invoice, tags: [] }, filter, fields)).toBe(false);
    expect(
      matchesFilter({ ...invoice, tags: [], total: 60_000 }, filter, fields),
    ).toBe(true);
    expect(matchesFilter({ ...invoice, status: "paid" }, filter, fields)).toBe(
      false,
    );
  });

  it("leaves out conditions without a value and of unknown fields", () => {
    const filter: FilterGroup = {
      combinator: "or",
      conditions: [
        { field: "customer", operator: "contains", value: "" },
        { field: "total", operator: "between", value: {} },
        { field: "status", operator: "in", value: [] },
        { field: "removed", operator: "equals", value: "x" },
        { combinator: "and", conditions: [] },
      ],
    };
    // An OR of nothing restricts nothing
    expect(matchesFilter(invoice, filter, fields)).toBe(true);

    filter.conditions.push({
      field: "customer",
      operator: "contains",
      value: "nobody",
    });
    // A new filter object - the tests are worked out by the object
    expect(matchesFilter(invoice, { ...filter }, fields)).toBe(false);
  });

  it("reads values by `getValue` and compares by `match`", () => {
    const match = vi.fn(
      (value: unknown, condition: FilterCondition) =>
        String(value).length > Number(condition.value),
    );
    const custom: FilterField<Invoice>[] = [
      {
        getValue: (row) => row.customer.split(" ")[0],
        key: "firstWord",
        label: "First word",
        type: "text",
      },
      {
        key: "customer",
        label: "Customer",
        match,
        type: "custom",
      },
    ];

    expect(
      matchesFilter(
        invoice,
        where({ field: "firstWord", operator: "equals", value: "prilis" }),
        custom,
      ),
    ).toBe(true);
    expect(
      matchesFilter(
        invoice,
        where({ field: "customer", operator: "equals", value: 10 }),
        custom,
      ),
    ).toBe(true);
    expect(match).toHaveBeenCalledWith(
      invoice.customer,
      { field: "customer", operator: "equals", value: 10 },
      invoice,
    );
  });

  it("filters thousands of rows with one worked out test", () => {
    const rows = Array.from({ length: 5000 }, (_, index) => ({
      ...invoice,
      customer: index % 2 ? "Alza.cz a.s." : "Škoda Auto a.s.",
      total: index,
    }));
    const filter = where(
      { field: "customer", operator: "contains", value: "skoda" },
      { field: "total", operator: "lessThan", value: 100 },
    );
    expect(
      rows.filter((row) => matchesFilter(row, filter, fields)),
    ).toHaveLength(50);
  });
});

describe("isConditionComplete", () => {
  it("tells whether a condition has the value its operator needs", () => {
    expect(isConditionComplete({ field: "a", operator: "isEmpty" })).toBe(true);
    expect(isConditionComplete({ field: "a", operator: "equals" })).toBe(false);
    expect(
      isConditionComplete({ field: "a", operator: "equals", value: false }),
    ).toBe(true);
    expect(
      isConditionComplete({ field: "a", operator: "equals", value: 0 }),
    ).toBe(true);
    expect(
      isConditionComplete({ field: "a", operator: "contains", value: "  " }),
    ).toBe(false);
    expect(
      isConditionComplete({ field: "a", operator: "in", value: ["x"] }),
    ).toBe(true);
    expect(
      isConditionComplete({
        field: "a",
        operator: "between",
        value: { to: 5 },
      }),
    ).toBe(true);
    expect(
      isConditionComplete({
        field: "a",
        operator: "between",
        value: { from: null, to: "" },
      }),
    ).toBe(false);
  });
});

describe("convertValue", () => {
  it("carries a value over to another operator", () => {
    expect(convertValue("Acme", "contains", "equals", "text")).toBe("Acme");
    expect(convertValue("paid", "equals", "in", "select")).toEqual(["paid"]);
    expect(convertValue(["paid", "new"], "in", "equals", "select")).toBe(
      "paid",
    );
    expect(convertValue(100, "equals", "between", "number")).toEqual({
      from: 100,
    });
    expect(
      convertValue({ from: 5, to: 9 }, "between", "greaterThan", "number"),
    ).toBe(5);
    expect(convertValue("x", "equals", "isEmpty", "text")).toBeUndefined();
    expect(
      convertValue(undefined, "isEmpty", "equals", "text"),
    ).toBeUndefined();
    // A moment and the day of `on`
    expect(convertValue("2026-10-01T14:30", "before", "on", "datetime")).toBe(
      "2026-10-01",
    );
    expect(convertValue("2026-10-01", "on", "after", "datetime")).toBe(
      "2026-10-01T00:00",
    );
    expect(convertValue(true, "equals", "in", "boolean")).toBeUndefined();
  });
});

describe("compactFilter", () => {
  it("leaves out what does not filter, and the ids", () => {
    expect(
      compactFilter(
        {
          combinator: "or",
          conditions: [
            { field: "customer", id: "a", operator: "contains", value: "" },
            { field: "status", id: "b", operator: "equals", value: "paid" },
            { field: "note", id: "c", operator: "isEmpty", value: "stale" },
            { field: "removed", id: "d", operator: "equals", value: 1 },
            {
              combinator: "and",
              conditions: [{ field: "total", operator: "equals" }],
              id: "e",
            },
            {
              combinator: "and",
              conditions: [
                { field: "total", id: "f", operator: "greaterThan", value: 5 },
              ],
              id: "g",
            },
          ],
          id: "root",
        },
        fields,
      ),
    ).toEqual({
      combinator: "or",
      conditions: [
        { field: "status", operator: "equals", value: "paid" },
        { field: "note", operator: "isEmpty" },
        {
          combinator: "and",
          conditions: [{ field: "total", operator: "greaterThan", value: 5 }],
        },
      ],
    });
  });

  it("keeps conditions of any field without `fields`, and is a group for none", () => {
    expect(
      compactFilter({
        combinator: "and",
        conditions: [{ field: "removed", operator: "equals", value: 1 }],
      }),
    ).toEqual({
      combinator: "and",
      conditions: [{ field: "removed", operator: "equals", value: 1 }],
    });
    expect(compactFilter(null)).toEqual({ combinator: "and", conditions: [] });
  });

  it("leaves out the empty items of a list and the empty ends of a range", () => {
    expect(
      compactFilter(
        where(
          { field: "status", operator: "in", value: ["paid", "", " "] },
          { field: "total", operator: "between", value: { from: 0, to: null } },
          {
            field: "dueDate",
            operator: "between",
            value: { from: "", to: "2026-10-15" },
          },
        ),
        fields,
      ),
    ).toEqual(
      where(
        { field: "status", operator: "in", value: ["paid"] },
        { field: "total", operator: "between", value: { from: 0 } },
        { field: "dueDate", operator: "between", value: { to: "2026-10-15" } },
      ),
    );
  });
});
