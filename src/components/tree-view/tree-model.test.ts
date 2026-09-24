import { describe, expect, it } from "vitest";
import {
  filterTree,
  findCurrentItem,
  findMatches,
  findReplacementRow,
  findTypeaheadRow,
  getCheckedIds,
  getCheckStates,
  getVisibleRows,
  indexTree,
  toggleCheck,
  type LoadState,
} from "./tree-model";
import type { TreeItem, TreeItemId } from "./types";

const items: TreeItem<string>[] = [
  {
    children: [
      { id: "read", label: "Read" },
      { id: "write", label: "Write" },
      { disabled: true, id: "delete", label: "Delete" },
    ],
    id: "orders",
    label: "Orders",
  },
  {
    children: [
      { id: "invite", label: "Invite" },
      { id: "remove", label: "Remove" },
    ],
    id: "users",
    label: "Users",
  },
  { hasChildren: true, id: "reports", label: "Reports" },
];

const noLoads = new Map<TreeItemId, LoadState<TreeItem<string>>>();

describe("getVisibleRows", () => {
  it("lists the items of the expanded parents with their positions", () => {
    const rows = getVisibleRows(items, {
      canLoad: false,
      expanded: new Set(["users"]),
      loads: noLoads,
    });

    expect(
      rows.map((row) => [row.id, row.level, row.posinset, row.setsize]),
    ).toEqual([
      ["orders", 1, 1, 3],
      ["users", 1, 2, 3],
      ["invite", 2, 1, 2],
      ["remove", 2, 2, 2],
      ["reports", 1, 3, 3],
    ]);
    // `end` skips the descendants
    expect(rows[1].end).toBe(4);
    expect(rows[0].expandable).toBe(true);
    expect(rows[0].expanded).toBe(false);
  });

  it("marks an item with children to load as expandable only with a loader", () => {
    const [withLoader] = getVisibleRows(items.slice(2), {
      canLoad: true,
      expanded: new Set(["reports"]),
      loads: noLoads,
    });
    expect(withLoader.expandable).toBe(true);
    expect(withLoader.loadStatus).toBe("loading");

    const [withoutLoader] = getVisibleRows(items.slice(2), {
      canLoad: false,
      expanded: new Set(["reports"]),
      loads: noLoads,
    });
    expect(withoutLoader.expandable).toBe(false);
  });

  it("shows loaded children, and a load that found none as a leaf", () => {
    const loads = new Map<TreeItemId, LoadState<TreeItem<string>>>([
      [
        "reports",
        { children: [{ id: "sales", label: "Sales" }], status: "loaded" },
      ],
    ]);
    const rows = getVisibleRows(items.slice(2), {
      canLoad: true,
      expanded: new Set(["reports"]),
      loads,
    });
    expect(rows.map((row) => row.id)).toEqual(["reports", "sales"]);
    expect(rows[0].loadStatus).toBeUndefined();

    const empty = new Map<TreeItemId, LoadState<TreeItem<string>>>([
      ["reports", { children: [], status: "loaded" }],
    ]);
    const [leaf] = getVisibleRows(items.slice(2), {
      canLoad: true,
      expanded: new Set(["reports"]),
      loads: empty,
    });
    expect(leaf.expandable).toBe(false);
  });

  it("shows a filtered tree expanded, except what the user collapsed", () => {
    const { shown } = filterTree(items, noLoads, "rem");
    const rows = getVisibleRows(items, {
      canLoad: true,
      expanded: new Set(),
      loads: noLoads,
      shown,
    });
    expect(rows.map((row) => row.id)).toEqual(["users", "remove"]);
    expect(rows[1]).toMatchObject({ posinset: 1, setsize: 1 });

    const collapsed = getVisibleRows(items, {
      canLoad: true,
      expanded: new Set(),
      filterCollapsed: new Set(["users"]),
      loads: noLoads,
      shown,
    });
    expect(collapsed.map((row) => row.id)).toEqual(["users"]);
  });

  it("shows an item of a duplicate id once", () => {
    const rows = getVisibleRows(
      [
        { id: "a", label: "A" },
        { id: "a", label: "A again" },
      ],
      { canLoad: false, expanded: new Set(), loads: noLoads },
    );
    expect(rows.map((row) => row.item.label)).toEqual(["A"]);
  });
});

describe("indexTree", () => {
  it("finds parents, inherited disabled states and duplicate ids", () => {
    const index = indexTree(
      [
        {
          children: [{ id: "child", label: "Child" }],
          disabled: true,
          id: "parent",
          label: "Parent",
        },
        { id: "parent", label: "Again" },
      ],
      noLoads,
      false,
    );

    expect(index.parentOf.get("child")).toBe("parent");
    expect(index.parentOf.get("parent")).toBeNull();
    expect([...index.disabled]).toEqual(["parent", "child"]);
    expect(index.duplicates).toEqual(["parent"]);
  });

  it("does not loop on an item nested in itself", () => {
    const item: TreeItem<string> = { children: [], id: "loop", label: "Loop" };
    item.children?.push(item);

    expect(indexTree([item], noLoads, false).duplicates).toEqual(["loop"]);
    expect(getCheckStates([item], noLoads, new Set()).get("loop")).toBe(false);
  });
});

describe("check states", () => {
  const states = (checked: TreeItemId[]) =>
    getCheckStates(items, noLoads, new Set(checked));

  it("checks a parent whose children are all checked, mixed when some are", () => {
    const result = states(["read", "write", "delete", "invite"]);

    expect(result.get("orders")).toBe(true);
    expect(result.get("users")).toBe("mixed");
    expect(result.get("reports")).toBe(false);
  });

  it("checks the descendants of a checked id", () => {
    const result = states(["users"]);

    expect(result.get("invite")).toBe(true);
    expect(result.get("remove")).toBe(true);
    expect(getCheckedIds(result, ["users"])).toEqual([
      "users",
      "invite",
      "remove",
    ]);
  });

  it("keeps the ids of items that are not loaded", () => {
    expect(getCheckedIds(states(["sales"]), ["sales"])).toEqual(["sales"]);
  });

  it("toggles the enabled descendants and leaves disabled ones be", () => {
    const index = indexTree(items, noLoads, false);
    const toggle = (id: string, checked: TreeItemId[]) =>
      toggleCheck(id, {
        checked: new Set(checked),
        index,
        items,
        loads: noLoads,
        states: states(checked),
      });

    // Delete is disabled - Orders stays mixed
    const checked = toggle("orders", []);
    expect(checked).toEqual(["read", "write"]);
    expect(states(checked ?? []).get("orders")).toBe("mixed");

    // All enabled ones are checked - the next toggle unchecks them
    expect(toggle("orders", ["read", "write"])).toEqual([]);

    // Unchecking a child of a checked parent keeps its siblings
    expect(toggle("invite", ["users"])).toEqual(["remove"]);

    // A disabled item does not toggle
    expect(toggle("delete", [])).toBeNull();

    // An item whose children are not loaded stands for all of them
    expect(toggle("reports", ["sales"])).toEqual(["reports", "sales"]);
  });
});

describe("findMatches", () => {
  it("finds every match, ignoring case and diacritics", () => {
    expect(findMatches("Česká pošta, česko", "cesk")).toEqual([
      [0, 4],
      [13, 17],
    ]);
    expect(findMatches("Orders", "x")).toEqual([]);
    expect(findMatches("Orders", "")).toEqual([]);
  });

  it("maps matches back into a text folding changes the length of", () => {
    // Decomposed letters fold to fewer characters - the accent of the last
    // matching letter belongs to the match
    const text = "Pr\u030ci\u0301lis\u030c";
    expect(findMatches(text, "lis")).toEqual([[5, 9]]);
    expect(findMatches(text, "ri")).toEqual([[1, 5]]);
  });
});

describe("findTypeaheadRow", () => {
  const rows = getVisibleRows(
    [
      { id: 1, label: "Cameras" },
      { id: 2, label: "Cars" },
      { id: 3, label: "Čajovny" },
      { id: 4, label: "Books" },
    ],
    { canLoad: false, expanded: new Set(), loads: new Map() },
  );

  it("moves to the next row starting with the letter, around the end", () => {
    expect(findTypeaheadRow(rows, 0, "c")).toBe(1);
    expect(findTypeaheadRow(rows, 1, "c")).toBe(2);
    expect(findTypeaheadRow(rows, 2, "c")).toBe(0);
    expect(findTypeaheadRow(rows, 0, "x")).toBe(-1);
  });

  it("stays on a row that still matches the longer text", () => {
    expect(findTypeaheadRow(rows, 0, "ca")).toBe(0);
    expect(findTypeaheadRow(rows, 0, "car")).toBe(1);
  });

  it("cycles through the rows of a repeated letter", () => {
    expect(findTypeaheadRow(rows, 1, "cc")).toBe(2);
  });
});

describe("findReplacementRow", () => {
  const rows = getVisibleRows(
    [
      { id: "a", label: "A" },
      {
        children: [
          { id: "b1", label: "B1" },
          { children: [{ id: "b2x", label: "B2x" }], id: "b2", label: "B2" },
          { id: "b3", label: "B3" },
        ],
        id: "b",
        label: "B",
      },
      { id: "c", label: "C" },
    ],
    { canLoad: false, expanded: new Set(["b", "b2"]), loads: noLoads },
  );
  const shownWithout =
    (...removed: string[]) =>
    (id: TreeItemId) =>
      !removed.includes(String(id));

  it("takes the next sibling, skipping descendants", () => {
    expect(findReplacementRow(rows, "b2", shownWithout("b2", "b2x"))).toBe(
      "b3",
    );
    expect(findReplacementRow(rows, "a", shownWithout("a"))).toBe("b");
  });

  it("takes the row above without a next sibling", () => {
    // The sibling before it
    expect(findReplacementRow(rows, "b3", shownWithout("b3"))).toBe("b2x");
    // The last shown descendant of the sibling before it
    expect(findReplacementRow(rows, "c", shownWithout("c"))).toBe("b3");
    // The parent of an only child
    expect(findReplacementRow(rows, "b2x", shownWithout("b2x"))).toBe("b2");
  });

  it("takes the row below when nothing above is left", () => {
    expect(
      findReplacementRow(
        rows,
        "b3",
        shownWithout("a", "b", "b1", "b2", "b2x", "b3"),
      ),
    ).toBe("c");
    // Not shown before
    expect(findReplacementRow(rows, "x", () => true)).toBeNull();
  });
});

describe("findCurrentItem", () => {
  it("picks the most specific item matching the path", () => {
    const { byId } = indexTree(
      [
        { href: "/users", id: "all", label: "Users" },
        { href: "/users/new", id: "new", label: "New user" },
        { href: "/orders", id: "orders", label: "Orders" },
      ],
      new Map(),
      false,
    );

    expect(findCurrentItem(byId, "/users/new")).toBe("new");
    expect(findCurrentItem(byId, "/users/42")).toBe("all");
    expect(findCurrentItem(byId, "/settings")).toBeUndefined();
  });

  it("picks the item whose query the page has, of items of one path", () => {
    const { byId } = indexTree(
      [
        { href: "/tasks?filter=all", id: "all", label: "All tasks" },
        { href: "/tasks?filter=mine", id: "mine", label: "My tasks" },
      ],
      new Map(),
      false,
    );

    expect(findCurrentItem(byId, "/tasks", "?filter=mine")).toBe("mine");
    expect(findCurrentItem(byId, "/tasks", "?filter=all")).toBe("all");
    // Without the query - the first of them
    expect(findCurrentItem(byId, "/tasks")).toBe("all");
  });
});
