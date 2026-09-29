import { describe, expect, it } from "vitest";
import {
  getDraggedIds,
  getDropPlaces,
  getPlaceRow,
  getPointerPlace,
  getPointerZone,
  isNoopMove,
  isValidDrop,
  type DropPlace,
} from "./drag-model";
import {
  getVisibleRows,
  indexTree,
  type LoadState,
  type LoadStates,
} from "./tree-model";
import type { TreeItem, TreeItemId } from "./types";

// A           (expanded)
//   A1
//   A2        (expanded)
//     A2a
// B
// C           (disabled, expanded)
//   C1
const items: TreeItem<string>[] = [
  {
    children: [
      { id: "a1", label: "A1" },
      { children: [{ id: "a2a", label: "A2a" }], id: "a2", label: "A2" },
    ],
    id: "a",
    label: "A",
  },
  { id: "b", label: "B" },
  {
    children: [{ id: "c1", label: "C1" }],
    disabled: true,
    id: "c",
    label: "C",
  },
];

const noLoads: LoadStates<TreeItem<string>> = new Map<
  TreeItemId,
  LoadState<TreeItem<string>>
>();
const index = indexTree(items, noLoads, false);
const rows = getVisibleRows(items, {
  canLoad: false,
  expanded: new Set(["a", "a2", "c"]),
  loads: noLoads,
});
const rowIndexById = new Map(rows.map((row, rowIndex) => [row.id, rowIndex]));

const place = (
  position: DropPlace["position"],
  targetId: string,
): DropPlace => ({ position, targetId });

describe("getDraggedIds", () => {
  it("drags the item alone, unless it is part of a multiple selection", () => {
    expect(getDraggedIds("b", { index, selected: null })).toEqual(["b"]);
    expect(getDraggedIds("b", { index, selected: new Set(["a1"]) })).toEqual([
      "b",
    ]);

    // The selected ones in tree order - A2a moves with A2
    expect(
      getDraggedIds("a2a", {
        index,
        selected: new Set(["b", "a2a", "a2", "a1"]),
      }),
    ).toEqual(["a1", "a2", "b"]);
  });

  it("drags no disabled item and none `canDrag` refuses", () => {
    expect(getDraggedIds("c1", { index, selected: null })).toEqual([]);
    expect(
      getDraggedIds("b", {
        canDrag: (item) => item.id !== "b",
        index,
        selected: null,
      }),
    ).toEqual([]);
    // Of a selection, only those that can be dragged
    expect(
      getDraggedIds("a1", {
        canDrag: (item) => item.id !== "b",
        index,
        selected: new Set(["a1", "b", "c1"]),
      }),
    ).toEqual(["a1"]);
  });
});

describe("isValidDrop", () => {
  const moved = new Set(["a2"]);

  it("refuses the moved items, their descendants and disabled parents", () => {
    expect(isValidDrop(place("inside", "a2"), moved, index)).toBe(false);
    expect(isValidDrop(place("before", "a2"), moved, index)).toBe(false);
    expect(isValidDrop(place("inside", "a2a"), moved, index)).toBe(false);
    expect(isValidDrop(place("after", "a2a"), moved, index)).toBe(false);
    // Into a disabled item, or among its children
    expect(isValidDrop(place("inside", "c"), moved, index)).toBe(false);
    expect(isValidDrop(place("before", "c1"), moved, index)).toBe(false);
    expect(isValidDrop(place("inside", "unknown"), moved, index)).toBe(false);
  });

  it("allows the other places - also next to a disabled item", () => {
    expect(isValidDrop(place("before", "a1"), moved, index)).toBe(true);
    expect(isValidDrop(place("inside", "b"), moved, index)).toBe(true);
    expect(isValidDrop(place("after", "c"), moved, index)).toBe(true);
  });
});

describe("isNoopMove", () => {
  const context = { index, items, loads: noLoads };

  it("tells the places the items are at already", () => {
    // A2 comes right after A1, as the last child of A
    expect(isNoopMove(place("after", "a1"), ["a2"], context)).toBe(true);
    expect(isNoopMove(place("inside", "a"), ["a2"], context)).toBe(true);
    expect(isNoopMove(place("before", "a1"), ["a2"], context)).toBe(false);
    // B between A and C
    expect(isNoopMove(place("before", "c"), ["b"], context)).toBe(true);
    expect(isNoopMove(place("after", "a"), ["b"], context)).toBe(true);
    expect(isNoopMove(place("after", "c"), ["b"], context)).toBe(false);
    expect(isNoopMove(place("inside", "a"), ["b"], context)).toBe(false);
  });

  it("takes several items together", () => {
    expect(isNoopMove(place("before", "c"), ["a", "b"], context)).toBe(true);
    expect(isNoopMove(place("after", "c"), ["a", "b"], context)).toBe(false);
    // Not next to each other - moving them puts them together
    expect(isNoopMove(place("before", "c"), ["a", "c1"], context)).toBe(false);
  });

  it("knows nothing is there in children not loaded yet", () => {
    const lazy: TreeItem<string>[] = [
      { hasChildren: true, id: "lazy", label: "Lazy" },
      { id: "x", label: "X" },
    ];
    const lazyIndex = indexTree(lazy, noLoads, false);
    expect(
      isNoopMove(place("inside", "lazy"), ["x"], {
        index: lazyIndex,
        items: lazy,
        loads: noLoads,
      }),
    ).toBe(false);
  });
});

describe("getDropPlaces", () => {
  it("lists before and inside each row, and after where groups end", () => {
    const names = getDropPlaces(rows).map(
      ({ position, targetId }) => `${position} ${targetId}`,
    );
    expect(names).toEqual([
      "before a",
      "inside a",
      "before a1",
      "inside a1",
      "before a2",
      "inside a2",
      "before a2a",
      "inside a2a",
      // A2a ends A2, which ends A
      "after a2a",
      "after a2",
      "before b",
      "inside b",
      "before c",
      "inside c",
      "before c1",
      "inside c1",
      // The last row ends every level
      "after c1",
      "after c",
    ]);
  });
});

describe("getPlaceRow", () => {
  it("draws before at the top of the target, after below its last descendant", () => {
    expect(getPlaceRow(place("before", "a2"), rows, rowIndexById)).toEqual({
      edge: "top",
      level: 2,
      rowIndex: 2,
    });
    // A2 shows A2a below it - the line goes below that, at the level of A2
    expect(getPlaceRow(place("after", "a2"), rows, rowIndexById)).toEqual({
      edge: "bottom",
      level: 2,
      rowIndex: 3,
    });
    expect(getPlaceRow(place("inside", "b"), rows, rowIndexById)).toEqual({
      edge: "inside",
      level: 1,
      rowIndex: 4,
    });
    expect(getPlaceRow(place("inside", "gone"), rows, rowIndexById)).toBe(null);
  });
});

describe("getPointerPlace", () => {
  const all = () => true;
  const at = (
    id: string,
    ratio: number,
    level = 1,
    isAllowed: (candidate: DropPlace) => boolean = all,
  ) =>
    getPointerPlace(rows, rowIndexById, {
      isAllowed,
      level,
      ratio,
      rowIndex: rowIndexById.get(id) ?? -1,
    });

  it("splits a row in quarters: before, inside, after", () => {
    expect(getPointerZone(0.1)).toBe("before");
    expect(getPointerZone(0.5)).toBe("inside");
    expect(getPointerZone(0.9)).toBe("after");

    expect(at("b", 0.1)).toEqual(place("before", "b"));
    expect(at("b", 0.5)).toEqual(place("inside", "b"));
    // Below a row with a sibling after it - before that one
    expect(at("a1", 0.9, 2)).toEqual(place("before", "a2"));
  });

  it("points before the first child below an expanded row", () => {
    expect(at("a", 0.9)).toEqual(place("before", "a1"));
  });

  it("chooses the level after the last row of a group by the pointer", () => {
    // A2a ends A2 and A - at level 3 after A2a, at level 2 after A2, at
    // the top level before B, which follows
    expect(at("a2a", 0.9, 4)).toEqual(place("after", "a2a"));
    expect(at("a2a", 0.9, 3)).toEqual(place("after", "a2a"));
    expect(at("a2a", 0.9, 2)).toEqual(place("after", "a2"));
    expect(at("a2a", 0.9, 1)).toEqual(place("before", "b"));
    // The last row of the tree - out to the top level
    expect(at("c1", 0.9, 1)).toEqual(place("after", "c"));
  });

  it("points at nothing where the items are already", () => {
    const isNoop = (candidate: DropPlace) =>
      candidate.position === "before" && candidate.targetId === "b";
    const notThere = (candidate: DropPlace) => !isNoop(candidate);
    const rowIndex = rowIndexById.get("b") ?? -1;

    // Not inside B instead
    expect(
      getPointerPlace(rows, rowIndexById, {
        isAllowed: notThere,
        isNoop,
        level: 1,
        ratio: 0.1,
        rowIndex,
      }),
    ).toBe(null);
    // Refused for another reason - inside B then
    expect(
      getPointerPlace(rows, rowIndexById, {
        isAllowed: notThere,
        level: 1,
        ratio: 0.1,
        rowIndex,
      }),
    ).toEqual(place("inside", "b"));
  });

  it("falls back to the allowed places", () => {
    const noInside = (candidate: DropPlace) => candidate.position !== "inside";
    expect(at("b", 0.4, 1, noInside)).toEqual(place("before", "b"));
    expect(at("b", 0.6, 1, noInside)).toEqual(place("before", "c"));

    const onlyInside = (candidate: DropPlace) =>
      candidate.position === "inside";
    expect(at("b", 0.1, 1, onlyInside)).toEqual(place("inside", "b"));
    expect(at("b", 0.9, 1, onlyInside)).toEqual(place("inside", "b"));

    expect(at("b", 0.5, 1, () => false)).toBe(null);
  });
});
