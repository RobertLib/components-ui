import type { TreeItemId } from "./types";

// Clicks and keys on these inside a row are theirs - the controls of
// `renderLabel` and `renderActions`
const CONTROLS =
  "a[href], button, input, select, textarea, label, [contenteditable]:not([contenteditable='false']), [role='button'], [role='checkbox'], [role='link'], [role='menuitem'], [role='switch']";

// Parts of a row: the link of an item with `href`, the cell of the checkbox
// of a `checkable` tree and the chevron of an expandable item
export const LINK_ATTRIBUTE = "data-tree-link";
export const CHECKBOX_ATTRIBUTE = "data-tree-checkbox";
export const TOGGLE_ATTRIBUTE = "data-tree-toggle";

/** Indentation of the rows, in rem: the chevron column of the first level and each further one. */
const INDENT_START = 0.25;
const INDENT_STEP = 1.25;

/** Indentation of the rows of a level - the chevron column of each level. */
export const indent = (level: number) =>
  `${(level - 1) * INDENT_STEP + INDENT_START}rem`;

/** The level whose chevron column is `offset` rem from the start of a row. */
export const levelAt = (offset: number) =>
  Math.floor((offset - INDENT_START) / INDENT_STEP) + 1;

/** Part of an element id for an item id - which may be any string. */
export const encodeId = (id: TreeItemId) =>
  typeof id === "number"
    ? `n${id}`
    : `s${id.replace(/[^a-zA-Z0-9-]/g, (char) => `_${char.charCodeAt(0).toString(16)}`)}`;

/**
 * Whether an event came from a control of `renderLabel` / `renderActions`
 * inside the row - not from its own link or checkbox.
 */
export const isFromControl = (event: React.SyntheticEvent<HTMLElement>) => {
  const control =
    event.target instanceof Element ? event.target.closest(CONTROLS) : null;
  return (
    !!control &&
    control !== event.currentTarget &&
    event.currentTarget.contains(control) &&
    !control.hasAttribute(LINK_ATTRIBUTE) &&
    !control.closest(`[${CHECKBOX_ATTRIBUTE}]`)
  );
};

export const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";
