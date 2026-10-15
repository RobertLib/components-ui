import { getRowKey } from "./row-key";
import type { RowId } from "./types";

/**
 * The key of the column of the CSV export of tree data with the level of
 * each row - apart from the keys of the columns.
 */
export const LEVEL_COLUMN_KEY = "\u0000level";

/**
 * A row of tree data (`getSubRows` / `loadSubRows` of `DataTable`) with its
 * place in the tree.
 */
export interface TreeNode<T> {
  /** Number of sub rows the tree shows under the row - after filtering. */
  childCount: number;
  /** Id of the row. */
  id: RowId;
  /** `getRowKey` of the id. */
  key: string;
  /** Depth of the row - `1` at the top level. */
  level: number;
  /**
   * Filtering: a row deeper in its branch matches - the row is shown
   * expanded, so the match can be seen in its place.
   */
  matchAncestor: boolean;
  /** Key of the parent row - `null` at the top level. */
  parentKey: string | null;
  /** 0-based place among the sibling rows shown. */
  position: number;
  /** The row. */
  row: T;
  /** Number of sibling rows shown - the row included. */
  setSize: number;
  /** The sub rows are still to be loaded (`loadSubRows`) - none is known. */
  unloaded: boolean;
}

/** How the rows of a tree are found. */
export interface TreeSource<T> {
  /**
   * The known sub rows of a row - `[]` for none, `null` for sub rows still
   * to be loaded.
   */
  getChildren: (row: T) => readonly T[] | null;
  getRowId: (row: T) => RowId;
}

export interface TreeOptions<T> extends TreeSource<T> {
  /**
   * Client-side filtering: the rows matching the filters and the search. A
   * matching row is shown with its ancestors and its descendants; the other
   * rows are left out. Without it every row is shown.
   */
  matches?: ReadonlySet<T> | null;
  /** Client-side sorting: the place of each row - siblings follow it. */
  rank?: ReadonlyMap<T, number> | null;
}

/** The rows of a tree, depth first - each row followed by its sub rows. */
export interface TreeData<T> {
  /**
   * Keys of rows met more than once - ids that are not unique across the
   * levels, or a row that is its own descendant. The first one is kept.
   */
  duplicates: string[];
  /** The rows with their places, depth first. */
  nodes: TreeNode<T>[];
  /** The index in `nodes` of each top-level row - and `nodes.length` last. */
  rootStarts: number[];
}

/**
 * The rows of the top-level rows `roots` and all their known sub rows,
 * depth first - siblings in the order of `rank`, and with `matches` only
 * the matching rows with their ancestors (which are `matchAncestor`) and
 * their descendants.
 */
export function buildTree<T>(
  roots: readonly T[],
  { getChildren, getRowId, matches, rank }: TreeOptions<T>,
): TreeData<T> {
  const nodes: TreeNode<T>[] = [];
  const rootStarts: number[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  // Whether a row or one deeper in its branch matches - by key, worked out
  // once; a row met again on its own path (a cycle) does not
  const branchMatches = new Map<string, boolean>();
  const visiting = new Set<string>();
  const hasMatch = (row: T): boolean => {
    if (!matches) return true;
    const key = getRowKey(getRowId(row));
    const known = branchMatches.get(key);
    if (known !== undefined) return known;
    if (visiting.has(key)) return false;

    visiting.add(key);
    const result =
      matches.has(row) ||
      (getChildren(row) ?? []).some((child) => hasMatch(child));
    visiting.delete(key);
    branchMatches.set(key, result);
    return result;
  };

  const sortRows = (rows: readonly T[]) =>
    rank
      ? [...rows].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
      : rows;

  /** Adds the rows of a level and their branches - returns how many. */
  const addLevel = (
    rows: readonly T[],
    level: number,
    parentKey: string | null,
    shownByAncestor: boolean,
  ) => {
    const shown: { key: string; row: T }[] = [];
    for (const row of sortRows(rows)) {
      const key = getRowKey(getRowId(row));
      if (seen.has(key)) {
        duplicates.add(key);
      } else if (shownByAncestor || hasMatch(row)) {
        // Taken before the branches below - a row cannot be its own
        // descendant
        seen.add(key);
        shown.push({ key, row });
      }
    }

    shown.forEach(({ key, row }, position) => {
      if (level === 1) rootStarts.push(nodes.length);
      const children = getChildren(row);
      const node: TreeNode<T> = {
        childCount: 0,
        id: getRowId(row),
        key,
        level,
        matchAncestor:
          !!matches && !!children?.some((child) => hasMatch(child)),
        parentKey,
        position,
        row,
        setSize: shown.length,
        unloaded: children === null,
      };
      nodes.push(node);
      if (children) {
        node.childCount = addLevel(
          children,
          level + 1,
          key,
          shownByAncestor || (!!matches && matches.has(row)),
        );
      }
    });

    return shown.length;
  };

  addLevel(roots, 1, null, false);
  rootStarts.push(nodes.length);

  return { duplicates: [...duplicates], nodes, rootStarts };
}

/**
 * The rows of a page of the top-level rows - each with its branch - and the
 * page they are on (see `paginateRows`).
 */
export function paginateTree<T>(
  tree: TreeData<T>,
  page: number,
  pageSize: number,
) {
  const rootCount = tree.rootStarts.length - 1;
  const lastPage = Math.max(1, Math.ceil(rootCount / pageSize));
  const wanted = Number.isFinite(page) ? Math.floor(page) : 1;
  const shown = Math.min(Math.max(1, wanted), lastPage);
  const first = Math.min((shown - 1) * pageSize, rootCount);
  const last = Math.min(first + pageSize, rootCount);

  return {
    nodes: tree.nodes.slice(tree.rootStarts[first], tree.rootStarts[last]),
    page: shown,
  };
}

/**
 * The rows shown of `nodes` (depth first) - the sub rows of a row only when
 * it is expanded and shown itself.
 */
export function getShownNodes<T>(
  nodes: readonly TreeNode<T>[],
  isExpanded: (node: TreeNode<T>) => boolean,
) {
  const shown: TreeNode<T>[] = [];
  // The level whose branch is collapsed - deeper rows are left out
  let collapsedLevel = Infinity;

  for (const node of nodes) {
    if (node.level > collapsedLevel) continue;
    collapsedLevel = Infinity;
    shown.push(node);
    if (!isExpanded(node)) collapsedLevel = node.level;
  }

  return shown;
}

/**
 * The rows at the bottom of a tree - without sub rows, or whose sub rows
 * are still to be loaded. A summary of them counts nothing twice when the
 * rows above hold the totals of their branches.
 */
export const getLeafRows = <T>(nodes: readonly TreeNode<T>[]) =>
  nodes.flatMap((node) => (node.childCount === 0 ? [node.row] : []));

/** The rows below each row of `nodes`, by its index there. */
function getBranchEnd<T>(nodes: readonly TreeNode<T>[], index: number) {
  const { level } = nodes[index];
  let end = index + 1;
  while (end < nodes.length && nodes[end].level > level) end++;
  return end;
}

/** The descendants of the rows of `keys` in `nodes` - the rows themselves too. */
export function getBranchRows<T>(
  nodes: readonly TreeNode<T>[],
  keys: ReadonlySet<string>,
) {
  const rows: T[] = [];
  for (let index = 0; index < nodes.length; index++) {
    if (!keys.has(nodes[index].key)) continue;
    const end = getBranchEnd(nodes, index);
    for (let branch = index; branch < end; branch++) {
      rows.push(nodes[branch].row);
    }
    index = end - 1;
  }
  return rows;
}

/** What the checkbox of a row shows when selecting a row takes its branch. */
export interface TreeCheckStates {
  /** Rows selected with every selectable row of their branch. */
  checked: Set<RowId>;
  /** Rows with only some of their branch selected - shown as mixed. */
  mixed: Set<RowId>;
}

/**
 * The checkboxes of the rows of `nodes` (whole branches, depth first) when
 * selecting a row takes its branch (`cascadeSelection`): checked when the
 * row and all selectable rows of its branch are selected, mixed when only
 * some of them are.
 */
export function getTreeCheckStates<T>(
  nodes: readonly TreeNode<T>[],
  selected: ReadonlySet<RowId>,
  canSelect: (row: T) => boolean,
): TreeCheckStates {
  const checked = new Set<RowId>();
  const mixed = new Set<RowId>();
  // Whether all and whether some selectable rows of a branch are selected -
  // collected from the end, so sub rows come before their parent
  const branches = new Map<string, { all: boolean; some: boolean }>();

  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index];
    const isSelectable = canSelect(node.row);
    const isSelected = isSelectable && selected.has(node.id);
    const below = branches.get(node.key) ?? { all: true, some: false };
    const all = (!isSelectable || isSelected) && below.all;
    const some = isSelected || below.some;

    if (isSelected && all) checked.add(node.id);
    else if (some) mixed.add(node.id);

    if (node.parentKey !== null) {
      const parent = branches.get(node.parentKey) ?? { all: true, some: false };
      branches.set(node.parentKey, {
        all: parent.all && all,
        some: parent.some || some,
      });
    }
  }

  return { checked, mixed };
}

/**
 * The selection after rows were checked or unchecked with their branches
 * (`cascadeSelection`): their ancestors are selected when every selectable
 * row under them is, and leave the selection when one does not.
 */
export function selectAncestors<T>(
  ids: RowId[],
  nodes: readonly TreeNode<T>[],
  changedKeys: ReadonlySet<string>,
  canSelect: (row: T) => boolean,
) {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const selected = new Set(ids);

  // The ancestors of the changed rows, the deepest first
  const ancestors = new Map<string, TreeNode<T>>();
  for (const key of changedKeys) {
    let parentKey = byKey.get(key)?.parentKey ?? null;
    while (parentKey !== null && !ancestors.has(parentKey)) {
      const parent = byKey.get(parentKey);
      if (!parent) break;
      ancestors.set(parentKey, parent);
      parentKey = parent.parentKey;
    }
  }
  const children = new Map<string, TreeNode<T>[]>();
  for (const node of nodes) {
    if (node.parentKey !== null) {
      const list = children.get(node.parentKey) ?? [];
      list.push(node);
      children.set(node.parentKey, list);
    }
  }

  // A parent counts as selected through its own selectable descendants
  const isBranchSelected = (node: TreeNode<T>): boolean =>
    canSelect(node.row)
      ? selected.has(node.id)
      : (children.get(node.key) ?? []).every(isBranchSelected);

  for (const ancestor of [...ancestors.values()].sort(
    (a, b) => b.level - a.level,
  )) {
    const subRows = children.get(ancestor.key) ?? [];
    if (!canSelect(ancestor.row) || subRows.length === 0) continue;
    if (subRows.every(isBranchSelected)) selected.add(ancestor.id);
    else selected.delete(ancestor.id);
  }

  // In the order they were selected - those added last
  const kept = ids.filter((id) => selected.has(id));
  const keptIds = new Set(kept);
  return [...kept, ...[...selected].filter((id) => !keptIds.has(id))];
}
