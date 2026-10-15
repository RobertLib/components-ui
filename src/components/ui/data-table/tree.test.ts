import { describe, expect, it } from "vitest";
import {
  buildTree,
  getBranchRows,
  getLeafRows,
  getShownNodes,
  getTreeCheckStates,
  paginateTree,
  selectAncestors,
  type TreeNode,
} from "./tree";

interface Item {
  children?: Item[] | null;
  id: number | string;
  name: string;
}

const item = (id: number | string, name: string, children?: Item[] | null) =>
  ({ children, id, name }) as Item;

// Assets (1) - Cash (11), Bank (12) - Checking (121)
// Liabilities (2) - Loans (21)
// Equity (3)
const tree: Item[] = [
  item(1, "Assets", [
    item(11, "Cash", []),
    item(12, "Bank", [item(121, "Checking")]),
  ]),
  item(2, "Liabilities", [item(21, "Loans")]),
  item(3, "Equity"),
];

const source = {
  getChildren: (row: Item) =>
    row.children === null ? null : (row.children ?? []),
  getRowId: (row: Item) => row.id,
};

const names = (nodes: TreeNode<Item>[]) =>
  nodes.map((node) => `${"  ".repeat(node.level - 1)}${node.row.name}`);

const allRows = (rows: Item[]): Item[] =>
  rows.flatMap((row) => [row, ...allRows(row.children ?? [])]);

const byName = (name: string) =>
  allRows(tree).find((row) => row.name === name) as Item;

describe("buildTree", () => {
  it("lists the rows depth first with their places", () => {
    const { nodes, rootStarts } = buildTree(tree, source);

    expect(names(nodes)).toEqual([
      "Assets",
      "  Cash",
      "  Bank",
      "    Checking",
      "Liabilities",
      "  Loans",
      "Equity",
    ]);
    expect(rootStarts).toEqual([0, 4, 6, 7]);
    const bank = nodes[2];
    expect(bank).toMatchObject({
      childCount: 1,
      level: 2,
      parentKey: nodes[0].key,
      position: 1,
      setSize: 2,
      unloaded: false,
    });
    expect(nodes[1].childCount).toBe(0);
  });

  it("marks rows whose sub rows are still to load", () => {
    const { nodes } = buildTree([item(1, "Lazy", null)], source);

    expect(nodes[0]).toMatchObject({ childCount: 0, unloaded: true });
  });

  it("sorts the siblings of each parent by their rank", () => {
    const order = ["Equity", "Liabilities", "Loans", "Bank", "Checking"];
    const rank = new Map(
      allRows(tree).map((row) => [
        row,
        order.includes(row.name) ? order.indexOf(row.name) : 10,
      ]),
    );

    expect(names(buildTree(tree, { ...source, rank }).nodes)).toEqual([
      "Equity",
      "Liabilities",
      "  Loans",
      "Assets",
      "  Bank",
      "    Checking",
      "  Cash",
    ]);
  });

  it("keeps the ancestors and the descendants of the matching rows", () => {
    const { nodes } = buildTree(tree, {
      ...source,
      matches: new Set([byName("Bank"), byName("Loans")]),
    });

    expect(names(nodes)).toEqual([
      "Assets",
      "  Bank",
      "    Checking",
      "Liabilities",
      "  Loans",
    ]);
    // Shown for the matches below them - not for themselves
    expect(nodes.map((node) => node.matchAncestor)).toEqual([
      true,
      false,
      false,
      true,
      false,
    ]);
    // Places among the siblings shown
    expect(nodes[1]).toMatchObject({ position: 0, setSize: 1 });
    expect(nodes[0].childCount).toBe(1);
  });

  it("keeps the first of rows with one id, also a row in its own branch", () => {
    const loop = item(1, "Loop");
    loop.children = [loop, item(2, "Child", [item(1, "Again")])];

    const { duplicates, nodes } = buildTree([loop, item(2, "Twin")], source);

    expect(names(nodes)).toEqual(["Loop", "Twin"]);
    expect(duplicates.sort()).toEqual(['["number","1"]', '["number","2"]']);
  });

  it("tells number and string ids apart", () => {
    const { duplicates, nodes } = buildTree(
      [item(1, "Number"), item("1", "Text")],
      source,
    );

    expect(nodes).toHaveLength(2);
    expect(duplicates).toEqual([]);
  });
});

describe("paginateTree", () => {
  it("pages the top-level rows with their branches", () => {
    const data = buildTree(tree, source);

    expect(names(paginateTree(data, 1, 2).nodes)).toEqual([
      "Assets",
      "  Cash",
      "  Bank",
      "    Checking",
      "Liabilities",
      "  Loans",
    ]);
    const last = paginateTree(data, 9, 2);
    expect(last.page).toBe(2);
    expect(names(last.nodes)).toEqual(["Equity"]);
    expect(paginateTree(buildTree([], source), 3, 2)).toEqual({
      nodes: [],
      page: 1,
    });
  });
});

describe("getShownNodes", () => {
  it("leaves out the branches of collapsed rows", () => {
    const { nodes } = buildTree(tree, source);
    const expanded = new Set(["Assets", "Bank"]);

    expect(
      names(getShownNodes(nodes, (node) => expanded.has(node.row.name))),
    ).toEqual([
      "Assets",
      "  Cash",
      "  Bank",
      "    Checking",
      "Liabilities",
      "Equity",
    ]);
    // A collapsed parent hides its expanded descendants
    expanded.delete("Assets");
    expect(
      names(getShownNodes(nodes, (node) => expanded.has(node.row.name))),
    ).toEqual(["Assets", "Liabilities", "Equity"]);
  });
});

describe("getLeafRows", () => {
  it("takes the rows without sub rows and those still to load", () => {
    const { nodes } = buildTree(
      [...tree, item(4, "Lazy", null), item(5, "Empty", [])],
      source,
    );

    expect(getLeafRows(nodes).map((row) => row.name)).toEqual([
      "Cash",
      "Checking",
      "Loans",
      "Equity",
      "Lazy",
      "Empty",
    ]);
  });
});

describe("getBranchRows", () => {
  it("takes the rows with all their descendants", () => {
    const { nodes } = buildTree(tree, source);
    const keys = new Set(
      nodes
        .filter((node) => ["Bank", "Liabilities"].includes(node.row.name))
        .map((node) => node.key),
    );

    expect(getBranchRows(nodes, keys).map((row) => row.name)).toEqual([
      "Bank",
      "Checking",
      "Liabilities",
      "Loans",
    ]);
  });
});

describe("cascading selection", () => {
  const { nodes } = buildTree(tree, source);
  const keyOf = (name: string) =>
    (nodes.find((node) => node.row.name === name) as TreeNode<Item>).key;
  const all = () => true;

  it("checks a row with its whole branch and mixes it with some", () => {
    const states = getTreeCheckStates(nodes, new Set([1, 11, 12, 121]), all);

    expect([...states.checked].sort()).toEqual([1, 11, 12, 121]);
    expect([...states.mixed]).toEqual([]);

    const partly = getTreeCheckStates(nodes, new Set([1, 11, 21]), all);
    expect([...partly.checked].sort()).toEqual([11, 21]);
    // Selected itself, but not all of its branch - and a parent of some
    expect([...partly.mixed].sort()).toEqual([1, 2]);
  });

  it("leaves rows that cannot be selected out", () => {
    const canSelect = (row: Item) => row.name !== "Checking";
    const states = getTreeCheckStates(nodes, new Set([1, 11, 12]), canSelect);

    expect([...states.checked].sort()).toEqual([1, 11, 12]);
    expect(states.mixed.size).toBe(0);
  });

  it("selects the parents of rows whose siblings are all selected", () => {
    expect(
      selectAncestors([11, 12, 121], nodes, new Set([keyOf("Checking")]), all),
    ).toEqual([11, 12, 121, 1]);
    // One sub row less - the parent and its parent leave the selection
    expect(
      selectAncestors([1, 11, 12], nodes, new Set([keyOf("Checking")]), all),
    ).toEqual([11]);
  });

  it("counts a parent that cannot be selected by its branch", () => {
    const canSelect = (row: Item) => row.name !== "Bank";

    expect(
      selectAncestors(
        [11, 121],
        nodes,
        new Set([keyOf("Checking")]),
        canSelect,
      ),
    ).toEqual([11, 121, 1]);
  });
});
