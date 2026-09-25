import { findActiveLink } from "../../providers/active-path";
import { foldSearchText } from "../../utils/remove-diacritics";
import type { TreeItem, TreeItemId } from "./types";

/**
 * The pure logic of `TreeView`: the visible rows, the checkbox states with
 * their propagation, filtering and typeahead. Every function walks the tree
 * once - fast enough for thousands of items.
 */

/** The checkbox state of an item - `"mixed"` when only some descendants are checked. */
export type CheckState = boolean | "mixed";

/** What `loadChildren` brought for an item so far. */
export type LoadState<T> =
  | { status: "error" }
  | { status: "loaded"; children: T[] }
  | { status: "loading" };

export type LoadStates<T> = ReadonlyMap<TreeItemId, LoadState<T>>;

/** The children of `item` - its own, or those `loadChildren` loaded. */
export function getChildren<T extends TreeItem>(
  item: T,
  loads: LoadStates<T>,
): readonly T[] | undefined {
  if (item.children) return item.children as T[];

  const load = loads.get(item.id);
  return load?.status === "loaded" ? load.children : undefined;
}

/** Whether `loadChildren` has yet to bring the children of `item`. */
export function isLazy<T extends TreeItem>(
  item: T,
  loads: LoadStates<T>,
  canLoad: boolean,
) {
  return (
    canLoad &&
    !!item.hasChildren &&
    !item.children &&
    loads.get(item.id)?.status !== "loaded"
  );
}

export interface TreeIndex<T> {
  /** Every item loaded so far, by id. */
  byId: ReadonlyMap<TreeItemId, T>;
  /** Items disabled themselves, through an ancestor or with the whole tree. */
  disabled: ReadonlySet<TreeItemId>;
  /** Ids more than one item has - only the first of them is shown. */
  duplicates: TreeItemId[];
  /** The parent of every item - `null` at the top. */
  parentOf: ReadonlyMap<TreeItemId, TreeItemId | null>;
}

/** Looks up the items loaded so far - their parents and disabled states. */
export function indexTree<T extends TreeItem>(
  items: readonly T[],
  loads: LoadStates<T>,
  allDisabled: boolean,
): TreeIndex<T> {
  const byId = new Map<TreeItemId, T>();
  const parentOf = new Map<TreeItemId, TreeItemId | null>();
  const disabled = new Set<TreeItemId>();
  const duplicates: TreeItemId[] = [];

  const visit = (
    list: readonly T[],
    parentId: TreeItemId | null,
    parentDisabled: boolean,
  ) => {
    for (const item of list) {
      // Also what stops an item nested in itself
      if (byId.has(item.id)) {
        duplicates.push(item.id);
        continue;
      }

      byId.set(item.id, item);
      parentOf.set(item.id, parentId);

      const isDisabled = allDisabled || parentDisabled || !!item.disabled;
      if (isDisabled) disabled.add(item.id);

      const children = getChildren(item, loads);
      if (children) visit(children, item.id, isDisabled);
    }
  };

  visit(items, null, false);
  return { byId, disabled, duplicates, parentOf };
}

/** The ids of the ancestors of `id`, its parent first. */
export function getAncestors(
  parentOf: ReadonlyMap<TreeItemId, TreeItemId | null>,
  id: TreeItemId,
): TreeItemId[] {
  const ancestors: TreeItemId[] = [];
  let parent = parentOf.get(id);

  while (parent !== undefined && parent !== null) {
    ancestors.push(parent);
    parent = parentOf.get(parent);
  }

  return ancestors;
}

const normalize = foldSearchText;

/**
 * The ranges of `text` matching `term`, ignoring case and diacritics -
 * "cesky" matches "Český". Returns `[start, end)` indexes into `text`.
 */
export function findMatches(text: string, term: string): [number, number][] {
  const needle = normalize(term);
  const folded = normalize(text);
  if (!needle || !folded.includes(needle)) return [];

  // Folding keeps the length of most texts - where it does not, fold
  // character by character, remembering where each folded one came from
  let origin: number[] | null = null;

  if (folded.length !== text.length) {
    origin = [];
    for (let index = 0; index < text.length; index++) {
      const length = normalize(text[index]).length;
      for (let offset = 0; offset < length; offset++) origin.push(index);
    }
  }

  const matches: [number, number][] = [];
  let position = folded.indexOf(needle);

  while (position !== -1) {
    const last = position + needle.length - 1;

    if (origin) {
      // With the accents of the last letter, which fold to nothing
      let end = origin[last] + 1;
      while (end < text.length && normalize(text[end]).length === 0) end++;
      matches.push([origin[position], end]);
    } else {
      matches.push([position, last + 1]);
    }

    position = folded.indexOf(needle, position + needle.length);
  }

  return matches;
}

export interface FilterResult {
  /** The matching parts of the labels of the matching items. */
  matches: ReadonlyMap<TreeItemId, [number, number][]>;
  /** The matching items and their ancestors - what the filtered tree shows. */
  shown: ReadonlySet<TreeItemId>;
}

/**
 * The items whose label contains `term` (ignoring case and diacritics) and
 * their ancestors. Children not loaded yet are not searched.
 */
export function filterTree<T extends TreeItem>(
  items: readonly T[],
  loads: LoadStates<T>,
  term: string,
): FilterResult {
  const matches = new Map<TreeItemId, [number, number][]>();
  const shown = new Set<TreeItemId>();
  const seen = new Set<TreeItemId>();

  const visit = (list: readonly T[]): boolean => {
    let anyShown = false;

    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);

      const ranges = findMatches(item.label, term);
      if (ranges.length > 0) matches.set(item.id, ranges);

      const children = getChildren(item, loads);
      const hasShownChild = children ? visit(children) : false;

      if (ranges.length > 0 || hasShownChild) {
        shown.add(item.id);
        anyShown = true;
      }
    }

    return anyShown;
  };

  visit(items);
  return { matches, shown };
}

/** An item of the tree as it is shown - in the order of the rows. */
export interface TreeRow<T> {
  /** Index after the last visible descendant of the row. */
  end: number;
  /** Children can be shown - there are some, or some to load. */
  expandable: boolean;
  /** The children are shown (or loading). */
  expanded: boolean;
  id: TreeItemId;
  item: T;
  /** Nesting depth - 1 at the top. */
  level: number;
  /** `loadChildren` of the expanded item runs - or it failed. */
  loadStatus?: "error" | "loading";
  parentId: TreeItemId | null;
  /** Position among the shown siblings, from 1. */
  posinset: number;
  /** Number of the shown siblings. */
  setsize: number;
}

export interface VisibleRowsOptions<T> {
  /** `loadChildren` was given. */
  canLoad: boolean;
  /** The expanded items. */
  expanded: ReadonlySet<TreeItemId>;
  /**
   * With a filter: the items the user collapsed in the filtered tree - the
   * rest of it is expanded.
   */
  filterCollapsed?: ReadonlySet<TreeItemId>;
  loads: LoadStates<T>;
  /** The items a filter shows - `undefined` without a filter. */
  shown?: ReadonlySet<TreeItemId>;
}

/** The rows of the tree: every item whose ancestors are all expanded. */
export function getVisibleRows<T extends TreeItem>(
  items: readonly T[],
  { canLoad, expanded, filterCollapsed, loads, shown }: VisibleRowsOptions<T>,
): TreeRow<T>[] {
  const rows: TreeRow<T>[] = [];
  // Also what stops an item nested in itself
  const seen = new Set<TreeItemId>();
  const isShown = (item: T) =>
    (!shown || shown.has(item.id)) && !seen.has(item.id);

  const visit = (
    list: readonly T[],
    level: number,
    parentId: TreeItemId | null,
  ) => {
    const siblings: T[] = [];
    for (const item of list) {
      if (!isShown(item)) continue;
      seen.add(item.id);
      siblings.push(item);
    }

    siblings.forEach((item, index) => {
      // A filtered tree searches only the loaded items - it loads nothing
      const lazy = !shown && isLazy(item, loads, canLoad);
      const children = getChildren(item, loads)?.filter(isShown);
      const expandable = lazy || (children?.length ?? 0) > 0;
      const isExpanded =
        expandable &&
        (shown ? !filterCollapsed?.has(item.id) : expanded.has(item.id));

      const row: TreeRow<T> = {
        end: 0,
        expandable,
        expanded: isExpanded,
        id: item.id,
        item,
        level,
        loadStatus:
          isExpanded && lazy
            ? loads.get(item.id)?.status === "error"
              ? "error"
              : "loading"
            : undefined,
        parentId,
        posinset: index + 1,
        setsize: siblings.length,
      };

      rows.push(row);
      if (isExpanded && children) visit(children, level + 1, item.id);
      row.end = rows.length;
    });
  };

  visit(items, 1, null);
  return rows;
}

/**
 * The row that takes the place of the removed item `id` in the rows it was
 * shown in: its next sibling still shown - else the nearest row above it
 * (the sibling before it or the last shown descendant of that one, else its
 * parent), else the nearest row below. `null` when `id` was not shown.
 */
export function findReplacementRow<T>(
  previousRows: readonly TreeRow<T>[],
  id: TreeItemId,
  isShown: (id: TreeItemId) => boolean,
): TreeItemId | null {
  const removedIndex = previousRows.findIndex((row) => row.id === id);
  if (removedIndex === -1) return null;

  const removed = previousRows[removedIndex];

  // The next siblings - their descendants skipped
  for (
    let index = removed.end;
    index < previousRows.length && previousRows[index].level === removed.level;
    index = previousRows[index].end
  ) {
    if (isShown(previousRows[index].id)) return previousRows[index].id;
  }

  for (let index = removedIndex - 1; index >= 0; index--) {
    if (isShown(previousRows[index].id)) return previousRows[index].id;
  }

  for (let index = removed.end; index < previousRows.length; index++) {
    if (isShown(previousRows[index].id)) return previousRows[index].id;
  }

  return null;
}

/**
 * The checkbox state of every loaded item: checked when its id or the id of
 * an ancestor is in `checked` - an item with children when all of them are,
 * "mixed" when some are.
 */
export function getCheckStates<T extends TreeItem>(
  items: readonly T[],
  loads: LoadStates<T>,
  checked: ReadonlySet<TreeItemId>,
): Map<TreeItemId, CheckState> {
  const states = new Map<TreeItemId, CheckState>();

  const visit = (item: T, inherited: boolean): CheckState => {
    const known = states.get(item.id);
    if (known !== undefined) return known;

    const own = inherited || checked.has(item.id);
    // Set before the children - it keeps the map in tree order and stops an
    // item nested in itself
    states.set(item.id, own);

    const children = getChildren(item, loads);
    if (!children || children.length === 0) return own;

    let all = true;
    let some = false;

    for (const child of children) {
      const state = visit(child, own);
      if (state !== true) all = false;
      if (state !== false) some = true;
    }

    const state: CheckState = all ? true : some ? "mixed" : false;
    states.set(item.id, state);
    return state;
  };

  for (const item of items) visit(item, false);
  return states;
}

/**
 * The ids of the checked items in tree order, parents included - followed
 * by the ids of `checked` that are not in the tree (not loaded yet).
 */
export function getCheckedIds(
  states: ReadonlyMap<TreeItemId, CheckState>,
  checked: Iterable<TreeItemId>,
): TreeItemId[] {
  const ids: TreeItemId[] = [];

  for (const [id, state] of states) {
    if (state === true) ids.push(id);
  }
  for (const id of checked) {
    if (!states.has(id)) ids.push(id);
  }

  return ids;
}

export interface ToggleCheckOptions<T> {
  /** The checked ids as they are. */
  checked: ReadonlySet<TreeItemId>;
  index: TreeIndex<T>;
  items: readonly T[];
  loads: LoadStates<T>;
  /** `getCheckStates` of `checked`. */
  states: ReadonlyMap<TreeItemId, CheckState>;
}

/**
 * The checked ids after the user toggled the item `id`: it and all its
 * enabled descendants turn checked - or unchecked, when all of them are
 * checked already (so a parent with a disabled unchecked child, which stays
 * "mixed", can be unchecked again). Disabled items keep their state. `null`
 * when nothing can change.
 */
export function toggleCheck<T extends TreeItem>(
  id: TreeItemId,
  { checked, index, items, loads, states }: ToggleCheckOptions<T>,
): TreeItemId[] | null {
  const item = index.byId.get(id);
  if (!item || index.disabled.has(id)) return null;

  // The items the toggle changes - leaves, and items with children not
  // loaded yet, which stand for all of them
  const targets: TreeItemId[] = [];
  const collect = (node: T) => {
    if (index.disabled.has(node.id)) return;

    const children = getChildren(node, loads);
    if (children && children.length > 0) children.forEach(collect);
    else targets.push(node.id);
  };
  collect(item);

  if (targets.length === 0) return null;

  const check = !targets.every((target) => states.get(target) === true);

  // The checked leaves of the whole tree - the states of the parents follow
  // from them
  const leaves = new Set<TreeItemId>();
  const seen = new Set<TreeItemId>();
  const walk = (list: readonly T[]) => {
    for (const node of list) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);

      const children = getChildren(node, loads);
      if (children && children.length > 0) walk(children);
      else if (states.get(node.id) === true) leaves.add(node.id);
    }
  };
  walk(items);

  // Ids of items not loaded yet stay as they are
  for (const checkedId of checked) {
    if (!states.has(checkedId)) leaves.add(checkedId);
  }

  for (const target of targets) {
    if (check) leaves.add(target);
    else leaves.delete(target);
  }

  return getCheckedIds(getCheckStates(items, loads, leaves), leaves);
}

/** The ids of the enabled rows from `from` to `to` (either way), both included. */
export function getRangeIds<T>(
  rows: readonly TreeRow<T>[],
  from: number,
  to: number,
  disabled: ReadonlySet<TreeItemId>,
): TreeItemId[] {
  const start = Math.min(from, to);
  const end = Math.max(from, to);

  return rows
    .slice(start, end + 1)
    .filter((row) => !disabled.has(row.id))
    .map((row) => row.id);
}

/**
 * The index of the row whose label starts with `text` - searched from the
 * row after `from` (from `from` itself when the text grows, so it stays on
 * an item that still matches) and around the end. A repeated letter
 * ("aaa") cycles through the rows starting with it. -1 when none matches.
 */
export function findTypeaheadRow<T extends TreeItem>(
  rows: readonly TreeRow<T>[],
  from: number,
  text: string,
): number {
  const search = normalize(text);
  if (!search || rows.length === 0) return -1;

  const find = (prefix: string, start: number) => {
    for (let offset = 0; offset < rows.length; offset++) {
      const index = (start + offset) % rows.length;
      if (normalize(rows[index].item.label).startsWith(prefix)) return index;
    }
    return -1;
  };

  const match = find(search, search.length > 1 ? Math.max(from, 0) : from + 1);
  if (match !== -1) return match;

  const repeated = [...search].every((char) => char === search[0]);
  return repeated && search.length > 1 ? find(search[0], from + 1) : -1;
}

/**
 * The id of the item of the current page - of the items whose `href` is the
 * current path or one above it, the most specific: `/users/new` over
 * `/users` on `/users/new`, and of links to one path the one whose query
 * the page has (`findActiveLink`).
 */
export function findCurrentItem<T extends TreeItem>(
  byId: ReadonlyMap<TreeItemId, T>,
  pathname: string,
  search = "",
): TreeItemId | undefined {
  return findActiveLink(byId.values(), (item) => item.href, pathname, search)
    ?.id;
}
