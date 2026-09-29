import {
  getAncestors,
  getChildren,
  type LoadStates,
  type TreeIndex,
  type TreeRow,
} from "./tree-model";
import type { TreeItem, TreeItemId } from "./types";

/**
 * The pure logic of moving items in a `TreeView`: which items a drag takes,
 * the places they can be dropped at - in the order the rows show them - and
 * the place the pointer points at.
 */

/**
 * Where moved items land, next to the target item: `before` or `after` it,
 * among its siblings, or `inside` it - as its last children.
 */
export type TreeDropPosition = "before" | "after" | "inside";

/** A move of items the user dropped - the tree reports it with `onMove`. */
export interface TreeMove<Id extends TreeItemId = TreeItemId> {
  /**
   * The moved items, in tree order - without the descendants of moved
   * items, which move with them.
   */
  itemIds: Id[];
  /** Where they land, next to `targetId`. */
  position: TreeDropPosition;
  /** The item they land next to - or in. */
  targetId: Id;
}

/** A place items can be dropped at. */
export interface DropPlace {
  position: TreeDropPosition;
  targetId: TreeItemId;
}

export const samePlace = (a: DropPlace | null, b: DropPlace | null) =>
  a === b ||
  (!!a && !!b && a.targetId === b.targetId && a.position === b.position);

export interface DraggedIdsOptions<T> {
  /** Items that may be dragged - every enabled one when left out. */
  canDrag?: (item: T) => boolean;
  index: TreeIndex<T>;
  /** The selected items of a multiple selection - `null` otherwise. */
  selected: ReadonlySet<TreeItemId> | null;
}

/**
 * The items a drag of the item `id` moves: in a multiple selection all
 * selected items that can be dragged, when `id` is one of them - in tree
 * order and without those whose ancestor moves too - otherwise `id` alone.
 * Empty when `id` cannot be dragged.
 */
export function getDraggedIds<T>(
  id: TreeItemId,
  { canDrag, index, selected }: DraggedIdsOptions<T>,
): TreeItemId[] {
  const canMove = (itemId: TreeItemId) => {
    const item = index.byId.get(itemId);
    return (
      item !== undefined &&
      !index.disabled.has(itemId) &&
      (canDrag?.(item) ?? true)
    );
  };

  if (!canMove(id)) return [];
  if (!selected?.has(id)) return [id];

  // The index lists the items in tree order
  const ids = [...index.byId.keys()].filter(
    (itemId) => selected.has(itemId) && canMove(itemId),
  );
  const moved = new Set(ids);

  return ids.filter(
    (itemId) =>
      !getAncestors(index.parentOf, itemId).some((ancestor) =>
        moved.has(ancestor),
      ),
  );
}

/**
 * The parent items dropped at `place` get - `null` at the top level,
 * `undefined` for a target not in the tree.
 */
export function getDropParent(
  place: DropPlace,
  parentOf: ReadonlyMap<TreeItemId, TreeItemId | null>,
): TreeItemId | null | undefined {
  return place.position === "inside"
    ? place.targetId
    : parentOf.get(place.targetId);
}

/**
 * Whether `moved` can be dropped at `place` at all: never into, before or
 * after the moved items themselves or their descendants, and never into a
 * disabled item.
 */
export function isValidDrop<T>(
  place: DropPlace,
  moved: ReadonlySet<TreeItemId>,
  index: TreeIndex<T>,
): boolean {
  const { targetId } = place;
  if (!index.byId.has(targetId) || moved.has(targetId)) return false;
  if (getAncestors(index.parentOf, targetId).some((id) => moved.has(id))) {
    return false;
  }

  const parent = getDropParent(place, index.parentOf);
  return (
    parent === null || (parent !== undefined && !index.disabled.has(parent))
  );
}

/**
 * Whether dropping `movedIds` (in tree order) at `place` would leave the
 * tree as it is - they are there already, one after another.
 */
export function isNoopMove<T extends TreeItem>(
  place: DropPlace,
  movedIds: readonly TreeItemId[],
  {
    index,
    items,
    loads,
  }: { index: TreeIndex<T>; items: readonly T[]; loads: LoadStates<T> },
): boolean {
  const parentId = getDropParent(place, index.parentOf);
  if (parentId === undefined) return false;

  const parent = parentId === null ? undefined : index.byId.get(parentId);
  const siblings =
    parentId === null ? items : parent && getChildren(parent, loads);
  // Children not loaded yet - the moved items are none of them
  if (!siblings) return false;

  const ids = siblings.map((item) => item.id);
  if (movedIds.some((id) => !ids.includes(id))) return false;

  const at =
    place.position === "inside"
      ? ids.length
      : ids.indexOf(place.targetId) + (place.position === "after" ? 1 : 0);
  const moved = new Set(movedIds);
  const rest = ids.filter((id) => !moved.has(id));
  const insertAt = at - ids.slice(0, at).filter((id) => moved.has(id)).length;
  const result = [
    ...rest.slice(0, insertAt),
    ...movedIds,
    ...rest.slice(insertAt),
  ];

  return result.every((id, position) => id === ids[position]);
}

/**
 * Every place to drop at, in the order the rows show them: before each
 * row, inside it, and where a group ends, after its last item - and after
 * the ancestors that end there too, the deepest first.
 */
export function getDropPlaces<T>(rows: readonly TreeRow<T>[]): DropPlace[] {
  const places: DropPlace[] = [];
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));

  rows.forEach((row, rowIndex) => {
    places.push({ position: "before", targetId: row.id });
    places.push({ position: "inside", targetId: row.id });

    // The groups this row ends - the next row is not deeper
    const nextLevel = rows[rowIndex + 1]?.level ?? 0;
    let id: TreeItemId | null | undefined = row.id;
    for (let level = row.level; level > nextLevel && id != null; level--) {
      places.push({ position: "after", targetId: id });
      id = parentOf.get(id);
    }
  });

  return places;
}

/**
 * The row an indicator of `place` is drawn on and where: a line at the top
 * of the target (before), at the bottom of its last shown descendant
 * (after) - indented to the level of the target - or the target row itself
 * (inside). `null` when the target is not shown.
 */
export function getPlaceRow<T>(
  place: DropPlace,
  rows: readonly TreeRow<T>[],
  rowIndexById: ReadonlyMap<TreeItemId, number>,
): {
  edge: "bottom" | "inside" | "top";
  level: number;
  rowIndex: number;
} | null {
  const targetIndex = rowIndexById.get(place.targetId);
  if (targetIndex === undefined) return null;

  const target = rows[targetIndex];
  if (place.position === "before") {
    return { edge: "top", level: target.level, rowIndex: targetIndex };
  }
  if (place.position === "inside") {
    return { edge: "inside", level: target.level, rowIndex: targetIndex };
  }
  return { edge: "bottom", level: target.level, rowIndex: target.end - 1 };
}

/** Which part of a row the pointer is over - its upper, middle or lower part. */
export type PointerZone = "after" | "before" | "inside";

/** The zone of a row at `ratio` of its height from the top. */
export const getPointerZone = (ratio: number): PointerZone =>
  ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";

/**
 * The place the pointer over the row `rowIndex` points at: before
 * the row in its upper quarter, after it in the lower one, inside it in
 * between - only before or after it where it takes no children, and
 * inside it where the other places are refused. The lower part of an
 * expanded row is before its first child; of the last row of a group it
 * is after that row, after an ancestor that ends there too or before the
 * next row - the one whose level is nearest `level`, the level the pointer
 * is at across the row. `null` where nothing can be dropped, and where the
 * items are already.
 */
export function getPointerPlace<T>(
  rows: readonly TreeRow<T>[],
  rowIndexById: ReadonlyMap<TreeItemId, number>,
  {
    isAllowed,
    isNoop,
    level,
    ratio,
    rowIndex,
  }: {
    /** Whether items can be dropped at a place. */
    isAllowed: (place: DropPlace) => boolean;
    /** Whether the items are at a place already. */
    isNoop?: (place: DropPlace) => boolean;
    /** The level the pointer is at across the row. */
    level: number;
    /** How far down the row the pointer is - 0 at the top, 1 at the bottom. */
    ratio: number;
    rowIndex: number;
  },
): DropPlace | null {
  const row = rows[rowIndex];
  if (!row) return null;

  const inside: DropPlace = { position: "inside", targetId: row.id };
  const before: DropPlace = { position: "before", targetId: row.id };

  // The places the lower part points at, the best first
  const lower = (): DropPlace[] => {
    const next = rows[rowIndex + 1];
    if (next && next.parentId === row.id) {
      return [{ position: "before", targetId: next.id }];
    }

    // This row and the ancestors that end with it, by their level - and
    // the next row, at its own level
    const chain: { level: number; place: DropPlace }[] = [];
    const nextLevel = next?.level ?? 0;
    let current: TreeRow<T> | undefined = row;
    while (current && current.level > nextLevel) {
      chain.push({
        level: current.level,
        place: { position: "after", targetId: current.id },
      });
      const parentIndex: number | undefined =
        current.parentId === null
          ? undefined
          : rowIndexById.get(current.parentId);
      current = parentIndex === undefined ? undefined : rows[parentIndex];
    }
    if (next) {
      chain.push({
        level: next.level,
        place: { position: "before", targetId: next.id },
      });
    }
    if (chain.length === 0) {
      chain.push({
        level: row.level,
        place: { position: "after", targetId: row.id },
      });
    }

    return chain
      .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))
      .map(({ place }) => place);
  };

  const zone = getPointerZone(ratio);
  const candidates =
    zone === "before"
      ? [before, inside]
      : zone === "after"
        ? [...lower(), inside]
        : [inside, ...(ratio < 0.5 ? [before] : lower())];

  for (const [position, candidate] of candidates.entries()) {
    if (isAllowed(candidate)) return candidate;
    // Pointing where the items are - not at another place instead
    if (position === 0 && isNoop?.(candidate)) return null;
  }
  return null;
}
