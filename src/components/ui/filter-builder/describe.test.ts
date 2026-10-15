import { describe, expect, it } from "vitest";
import { cs } from "../../../i18n/ui/cs";
import { describeFilter } from "./describe";
import type { FilterField, FilterGroup } from "./types";

const fields: FilterField[] = [
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
  {
    key: "tags",
    label: "Tags",
    options: [
      { label: "VIP", value: 1 },
      { label: "Partner", value: 2 },
    ],
    type: "multiSelect",
  },
  { key: "paid", label: "Paid", type: "boolean" },
  {
    formatValue: (value) => `#${String(value)}`,
    key: "owner",
    label: "Owner",
    type: "select",
  },
];

const filter: FilterGroup = {
  combinator: "and",
  conditions: [
    { field: "status", operator: "equals", value: "paid" },
    {
      combinator: "or",
      conditions: [
        { field: "total", operator: "greaterThanOrEqual", value: 10_000 },
        { field: "customer", operator: "contains", value: "Acme" },
      ],
    },
  ],
};

describe("describeFilter", () => {
  it("writes a filter as a sentence - a nested group in parentheses", () => {
    expect(describeFilter(filter, fields)).toBe(
      "Status is Paid and (Total at least 10,000 or Customer contains “Acme”)",
    );
  });

  it("writes it in the language of the locale", () => {
    const czech: FilterField[] = fields.map((field) => ({
      ...field,
      label: { customer: "Odběratel", status: "Stav", total: "Částka" }[
        field.key
      ]!,
    }));
    expect(describeFilter(filter, czech, cs)).toBe(
      // Czech groups thousands by a no-break space
      "Stav je Paid a (Částka alespoň 10\u00a0000 nebo Odběratel obsahuje „Acme“)",
    );
  });

  it("writes days and moments by the formats of the locale", () => {
    const dates: FilterGroup = {
      combinator: "and",
      conditions: [
        { field: "dueDate", operator: "before", value: "2026-10-15" },
        { field: "issuedAt", operator: "after", value: "2026-10-01T14:30" },
        { field: "issuedAt", operator: "on", value: "2026-10-02" },
      ],
    };
    expect(describeFilter(dates, fields)).toBe(
      "Due date before 10/15/2026 and Issued after 10/01/2026 2:30 PM and Issued on 10/02/2026",
    );
    expect(describeFilter(dates, fields, cs)).toBe(
      "Due date před 15.10.2026 a Issued po 01.10.2026 14:30 a Issued dne 02.10.2026",
    );
  });

  it("writes ranges, lists, booleans and empty values", () => {
    const describe = (condition: FilterGroup["conditions"][number]) =>
      describeFilter({ combinator: "and", conditions: [condition] }, fields);

    expect(
      describe({
        field: "total",
        operator: "between",
        value: { from: 100, to: 2500.5 },
      }),
    ).toBe("Total between 100 and 2,500.5");
    expect(
      describe({ field: "total", operator: "between", value: { from: 100 } }),
    ).toBe("Total at least 100");
    expect(
      describe({
        field: "dueDate",
        operator: "between",
        value: { to: "2026-12-31" },
      }),
    ).toBe("Due date on or before 12/31/2026");
    expect(
      describe({ field: "tags", operator: "hasAny", value: [1, 2, 3] }),
    ).toBe("Tags has any of VIP, Partner, 3");
    expect(describe({ field: "paid", operator: "equals", value: false })).toBe(
      "Paid is No",
    );
    expect(describe({ field: "customer", operator: "isEmpty" })).toBe(
      "Customer is empty",
    );
    expect(describe({ field: "owner", operator: "in", value: [7, 9] })).toBe(
      "Owner is any of #7, #9",
    );
    expect(
      describeFilter(
        {
          combinator: "and",
          conditions: [{ field: "paid", operator: "equals", value: true }],
        },
        fields,
        cs,
      ),
    ).toBe("Paid je Ano");
  });

  it("leaves out what does not filter - nothing for no conditions", () => {
    expect(describeFilter(null, fields)).toBe("");
    expect(describeFilter({ combinator: "and", conditions: [] }, fields)).toBe(
      "",
    );
    expect(
      describeFilter(
        {
          combinator: "or",
          conditions: [
            { field: "customer", operator: "contains", value: "" },
            { field: "removed", operator: "equals", value: 1 },
            {
              combinator: "and",
              conditions: [{ field: "total", operator: "lessThan", value: 5 }],
            },
          ],
        },
        fields,
      ),
    ).toBe("Total less than 5");
  });
});
