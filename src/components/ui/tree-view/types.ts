/** Id of a tree item - a string or a number, e.g. the id of a record. */
export type TreeItemId = string | number;

/** An item of a `TreeView` - extend it with fields of your own. */
export interface TreeItem<Id extends TreeItemId = TreeItemId> {
  /**
   * Nested items - the item can be expanded. For items loaded when they are
   * first expanded, leave it out and set `hasChildren`.
   */
  children?: TreeItem<Id>[];
  /**
   * The item cannot be selected, checked or followed - it can still be
   * focused and expanded. Its descendants are disabled too.
   */
  disabled?: boolean;
  /**
   * The item has children that `loadChildren` of the tree loads when it is
   * first expanded - leave `children` out then.
   */
  hasChildren?: boolean;
  /**
   * Makes the item a link to this URL (rendered with the router's `Link`).
   * The item of the current page is marked - `aria-current="page"`.
   */
  href?: string;
  /** Shown before the label, e.g. a folder icon. */
  icon?: React.ReactNode;
  /**
   * Unique in the whole tree - `expanded`, `selected` and `checked` hold
   * these ids.
   */
  id: Id;
  /** Text of the item - also what typeahead and `filter` search. */
  label: string;
}

/** The state of an item - passed to `renderLabel` and `renderActions`. */
export interface TreeItemState {
  /**
   * The checkbox of a `checkable` tree - `"mixed"` when only some of the
   * descendants are checked; `undefined` in other trees.
   */
  checked?: boolean | "mixed";
  /** The item, or an ancestor of it, is disabled. */
  disabled: boolean;
  /** The children of the item are shown. */
  expanded: boolean;
  /**
   * The label with the part matching `filter` highlighted - render it
   * instead of `item.label` to keep the highlight.
   */
  label: React.ReactNode;
  /** Nesting depth - 1 at the top. */
  level: number;
  /** The item is selected. */
  selected: boolean;
}
