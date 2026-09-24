import { isValidElement } from "react";

/**
 * A command or a link of a menu - with `checked` a checkbox, with `items`
 * the parent of a submenu.
 */
export interface DropdownItem {
  /**
   * Makes the item a checkbox (`menuitemcheckbox`), checked or not. Picking
   * it calls `onCheckedChange` with the other state.
   */
  checked?: boolean;
  /** A destructive action, e.g. "Delete" - shown in the danger color. */
  danger?: boolean;
  /** A second line under the label, e.g. what the action does. */
  description?: React.ReactNode;
  /**
   * Shown and reachable with the arrow keys - screen readers announce it as
   * unavailable - but it cannot be picked.
   */
  disabled?: boolean;
  /** Renders the item as a link. */
  href?: string;
  /** An icon before the label, e.g. `<Pencil size={16} />`. */
  icon?: React.ReactNode;
  /**
   * Entries of a submenu, opened next to the item on hover, click or tap,
   * ArrowRight, Enter or Space. Such an item is no command of its own -
   * its `href`, `onClick` and `checked` are not used.
   */
  items?: DropdownEntry[];
  /**
   * Keeps the menu open when the item is picked by a click or Enter - e.g.
   * to toggle several checkboxes in a row. Space toggles a checkbox or
   * radio item without closing the menu anyway.
   */
  keepOpen?: boolean;
  /** Text of the item. */
  label: string;
  /** Called with the new state when a checkbox item is picked. */
  onCheckedChange?: (checked: boolean) => void;
  /** Called when the item is picked. */
  onClick?: () => void;
  /**
   * A keyboard shortcut of the same action, e.g. `"mod+d"` - shown at the
   * end of the item in the notation of the platform and announced
   * (`aria-keyshortcuts`). Display only: the menu does not listen for it,
   * the app handles it (`matchesShortcut`).
   */
  shortcut?: string;
}

/** A line between entries of a menu. */
export interface DropdownSeparator {
  type: "separator";
}

/** Related items under a heading - a `group` named by the heading. */
export interface DropdownGroup {
  /** The items - `DropdownItem`s or custom content. */
  items: (DropdownItem | React.ReactNode)[];
  /** Heading above the items - also the accessible name of the group. */
  label?: string;
  type: "group";
}

/** An option of a `DropdownRadioGroup`. */
export interface DropdownRadioOption extends Pick<
  DropdownItem,
  "description" | "disabled" | "icon" | "label" | "shortcut"
> {
  /** Passed to `onChange` - the option is checked while it equals `value`. */
  value: string;
}

/**
 * Options of which one is chosen, e.g. the sort order of a list -
 * `menuitemradio` items in a group.
 */
export interface DropdownRadioGroup {
  /**
   * Keeps the menu open when an option is picked by a click or Enter.
   * Space checks an option without closing the menu anyway.
   */
  keepOpen?: boolean;
  /** Heading above the options - also the accessible name of their group. */
  label?: string;
  /** Called with the `value` of the picked option. */
  onChange?: (value: string) => void;
  /** The options. */
  options: DropdownRadioOption[];
  type: "radio";
  /** The `value` of the checked option. */
  value?: string;
}

/**
 * An entry of a menu: an item, items or radio options under a heading, a
 * separator, or any element for custom content. `null`, `false` and `""`
 * entries are skipped, so `cond && item` works.
 */
export type DropdownEntry =
  | DropdownItem
  | DropdownGroup
  | DropdownRadioGroup
  | DropdownSeparator
  | React.ReactNode;

/** One line of a menu the arrow keys can stop at. */
export type MenuRow =
  | { item: DropdownItem; kind: "item" }
  | { group: DropdownRadioGroup; kind: "option"; option: DropdownRadioOption }
  | { kind: "custom"; node: React.ReactNode };

/** What a menu renders, in order - `index` points into `rows`. */
export type MenuNode =
  | { index: number; kind: "row" }
  | { kind: "separator" }
  | { indexes: number[]; kind: "group"; label?: string };

export interface MenuModel {
  /** Some row is a checkbox or a radio - all rows keep room for the check. */
  hasCheck: boolean;
  /** Some row has an icon - all rows keep room for it, so labels align. */
  hasIcon: boolean;
  nodes: MenuNode[];
  /** The rows - items, radio options and custom content - in order. */
  rows: MenuRow[];
}

/** An object entry - not an element, text or a skipped value. */
const isEntryObject = (entry: unknown): entry is Record<string, unknown> =>
  typeof entry === "object" && entry !== null && !isValidElement(entry);

const isSeparator = (entry: unknown): entry is DropdownSeparator =>
  isEntryObject(entry) && entry.type === "separator";

const isGroup = (entry: unknown): entry is DropdownGroup =>
  isEntryObject(entry) && entry.type === "group" && Array.isArray(entry.items);

const isRadioGroup = (entry: unknown): entry is DropdownRadioGroup =>
  isEntryObject(entry) &&
  entry.type === "radio" &&
  Array.isArray(entry.options);

/** Whether an entry is a `DropdownItem` - not a group, separator or element. */
export const isDropdownItem = (entry: unknown): entry is DropdownItem =>
  isEntryObject(entry) &&
  "label" in entry &&
  !isSeparator(entry) &&
  !isGroup(entry) &&
  !isRadioGroup(entry);

/** `cond && item` and friends - rendered as nothing, so left out. */
export const isSkippedEntry = (entry: unknown) =>
  entry === null ||
  entry === undefined ||
  typeof entry === "boolean" ||
  entry === "";

const toRow = (entry: DropdownItem | React.ReactNode): MenuRow =>
  isDropdownItem(entry)
    ? { item: entry, kind: "item" }
    : { kind: "custom", node: entry as React.ReactNode };

/** The rows of a menu and how they are grouped. */
export function buildMenuModel(entries: DropdownEntry[]): MenuModel {
  const rows: MenuRow[] = [];
  const nodes: MenuNode[] = [];

  const addRow = (row: MenuRow) => rows.push(row) - 1;

  for (const entry of entries) {
    if (isSkippedEntry(entry)) continue;

    if (isSeparator(entry)) {
      nodes.push({ kind: "separator" });
    } else if (isGroup(entry)) {
      const indexes = entry.items
        .filter((item) => !isSkippedEntry(item))
        .map((item) => addRow(toRow(item)));
      nodes.push({ indexes, kind: "group", label: entry.label });
    } else if (isRadioGroup(entry)) {
      const indexes = entry.options.map((option) =>
        addRow({ group: entry, kind: "option", option }),
      );
      nodes.push({ indexes, kind: "group", label: entry.label });
    } else {
      nodes.push({ index: addRow(toRow(entry)), kind: "row" });
    }
  }

  return {
    hasCheck: rows.some(
      (row) =>
        row.kind === "option" ||
        (row.kind === "item" && row.item.checked !== undefined),
    ),
    hasIcon: rows.some(
      (row) =>
        (row.kind === "item" && !!row.item.icon) ||
        (row.kind === "option" && !!row.option.icon),
    ),
    nodes,
    rows,
  };
}

/** The label of a row the typed letters are matched against. */
export const rowLabel = (row: MenuRow | undefined) =>
  row?.kind === "item"
    ? row.item.label
    : row?.kind === "option"
      ? row.option.label
      : null;

export const isRowDisabled = (row: MenuRow | undefined) =>
  row?.kind === "item"
    ? !!row.item.disabled
    : row?.kind === "option"
      ? !!row.option.disabled
      : false;

/** The submenu entries of a row - `undefined` for a row without one. */
export const rowSubmenu = (row: MenuRow | undefined) =>
  row?.kind === "item" ? row.item.items : undefined;
