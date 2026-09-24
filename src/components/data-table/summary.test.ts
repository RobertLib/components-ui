import { describe, expect, it } from "vitest";
import { computeSummary, formatSummaryValue } from "./summary";
import { cs } from "../../i18n/cs";
import { en } from "../../i18n/en";
import type { Column } from "./types";

interface Order {
  amount: number | string | null;
  id: number;
  shipped: Date | null;
}

const orders: Order[] = [
  { amount: 10, id: 1, shipped: new Date(2026, 8, 24) },
  { amount: "2.5", id: 2, shipped: new Date(2026, 0, 5) },
  { amount: null, id: 3, shipped: null },
  { amount: "n/a", id: 4, shipped: new Date(2026, 11, 31) },
];

const amount: Column<Order> = { key: "amount", label: "Amount" };
const shipped: Column<Order> = { key: "shipped", label: "Shipped" };

describe("computeSummary", () => {
  it("adds up, averages and compares the numbers - also numbers stored as text", () => {
    expect(computeSummary("sum", amount, orders)).toBe(12.5);
    expect(computeSummary("avg", amount, orders)).toBe(6.25);
    expect(computeSummary("min", amount, orders)).toBe(2.5);
    expect(computeSummary("max", amount, orders)).toBe(10);
  });

  it("counts the rows", () => {
    expect(computeSummary("count", amount, orders)).toBe(4);
  });

  it("takes the earliest and the latest date of a column without numbers", () => {
    expect(computeSummary("min", shipped, orders)).toEqual(
      new Date(2026, 0, 5),
    );
    expect(computeSummary("max", shipped, orders)).toEqual(
      new Date(2026, 11, 31),
    );
  });

  it("has a sum of nothing, and no average of it", () => {
    expect(computeSummary("sum", amount, [])).toBe(0);
    expect(computeSummary("avg", amount, [])).toBeNull();
    expect(computeSummary("max", shipped, [])).toBeNull();
  });

  it("reads the values with getValue", () => {
    const column: Column<Order> = {
      getValue: (order) => order.id * 2,
      key: "double",
      label: "Double",
    };

    expect(computeSummary("sum", column, orders)).toBe(20);
  });

  it("returns what a function makes of the rows", () => {
    expect(
      computeSummary((rows) => `${rows.length} orders`, amount, orders),
    ).toBe("4 orders");
  });
});

describe("formatSummaryValue", () => {
  const spaced = (value: React.ReactNode) => String(value).replace(/\s/g, " ");

  it("writes numbers as the language does - averages with two decimals", () => {
    expect(formatSummaryValue(1234567.891, en)).toBe("1,234,567.891");
    expect(spaced(formatSummaryValue(1234567.891, cs))).toBe("1 234 567,891");
    expect(formatSummaryValue(2 / 3, en, true)).toBe("0.67");
  });

  it("writes dates by the date format of the language", () => {
    expect(formatSummaryValue(new Date(2026, 8, 24), cs)).toBe("24.09.2026");
  });

  it("shows nothing for no value and elements as they are", () => {
    expect(formatSummaryValue(null, en)).toBeNull();
    expect(formatSummaryValue(Number.NaN, en)).toBeNull();
    expect(formatSummaryValue("5 teams", en)).toBe("5 teams");
  });
});
