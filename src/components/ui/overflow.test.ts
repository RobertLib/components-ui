import { describe, expect, it } from "vitest";
import { getOverflowingItems, getShownItems } from "./overflow";

const fromTheEnd = (count: number) =>
  Array.from({ length: count }, (_, index) => count - 1 - index);

describe("getOverflowingItems", () => {
  it("moves nothing while all items fit", () => {
    expect(
      getOverflowingItems({
        available: 300,
        gap: 4,
        moreWidth: 40,
        order: fromTheEnd(3),
        widths: [96, 96, 100],
      }),
    ).toEqual([]);
  });

  it("makes room for the More button and moves the items in their order", () => {
    // 4 × 100 + 3 × 4 = 412 > 300; with the button 260 of room - two items
    expect(
      getOverflowingItems({
        available: 300,
        gap: 4,
        moreWidth: 40,
        order: fromTheEnd(4),
        widths: [100, 100, 100, 100],
      }),
    ).toEqual([2, 3]);

    // Another order - the second item goes first, the first one stays
    expect(
      getOverflowingItems({
        available: 300,
        gap: 4,
        moreWidth: 40,
        order: [1, 3, 2],
        widths: [100, 100, 100, 100],
      }),
    ).toEqual([1, 3]);
  });

  it("keeps the items not in the order, even with no room", () => {
    expect(
      getOverflowingItems({
        available: 100,
        gap: 0,
        moreWidth: 40,
        order: [2, 1],
        widths: [100, 100, 100],
      }),
    ).toEqual([1, 2]);
  });

  it("shows the More button anyway when asked", () => {
    expect(
      getOverflowingItems({
        available: 300,
        forceMore: true,
        gap: 0,
        moreWidth: 40,
        order: fromTheEnd(3),
        widths: [100, 100, 100],
      }),
    ).toEqual([2]);
  });

  it("counts a separator only between two shown items", () => {
    // [A | B] - with B gone the separator is not shown either
    expect(
      getOverflowingItems({
        available: 150,
        gap: 0,
        moreWidth: 40,
        order: [2],
        separators: new Set([1]),
        widths: [100, 10, 100],
      }),
    ).toEqual([2]);
  });

  it("tolerates the rounding of the room", () => {
    expect(
      getOverflowingItems({
        available: 300,
        gap: 0,
        moreWidth: 40,
        order: fromTheEnd(3),
        widths: [100.2, 100.1, 100.1],
      }),
    ).toEqual([]);
  });
});

describe("getShownItems", () => {
  it("shows one separator between shown items - none at the ends", () => {
    const separators = new Set([0, 2, 3, 5]);
    // | A | | B |
    expect(getShownItems(6, new Set(), separators)).toEqual([
      false,
      true,
      true,
      false,
      true,
      false,
    ]);
    // With B hidden, A is alone
    expect(getShownItems(6, new Set([4]), separators)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});
