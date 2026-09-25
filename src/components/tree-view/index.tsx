import { ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cn from "../../utils/cn";
import logger from "../../utils/logger";
import Spinner from "../spinner";
import { attachRef, useFormReset } from "../../hooks/use-form-control";
import type { LinkComponent } from "../../providers/router";
import { useMessages, useRouter } from "../../providers/ui-context";
import {
  filterTree,
  findCurrentItem,
  findReplacementRow,
  findTypeaheadRow,
  getAncestors,
  getCheckedIds,
  getCheckStates,
  getRangeIds,
  getVisibleRows,
  indexTree,
  toggleCheck,
  type CheckState,
  type TreeRow,
} from "./tree-model";
import useLazyChildren from "./use-lazy-children";
import type { TreeItem, TreeItemId, TreeItemState } from "./types";

export type { TreeItem, TreeItemId, TreeItemState } from "./types";

export interface TreeViewProps<T extends TreeItem = TreeItem> extends Omit<
  React.ComponentProps<"ul">,
  "children" | "defaultChecked" | "defaultValue" | "onChange"
> {
  /**
   * Gives every item a checkbox. Checking an item checks all its enabled
   * descendants; an item is checked when all its children are, and partly
   * checked ("mixed") when some are. A click on the checkbox or Space
   * toggles it - in a tree that selects nothing a click anywhere on the row.
   */
  checkable?: boolean;
  /**
   * The checked items of a `checkable` tree - use with `onCheckedChange`.
   * An item counts as checked when its id or the id of an ancestor is here,
   * so the id of an item whose children are not loaded yet stands for all
   * of them. Leave out for a tree that keeps its own state
   * (`defaultChecked`).
   */
  checked?: T["id"][];
  /** The items checked at first in an uncontrolled `checkable` tree. */
  defaultChecked?: T["id"][];
  /**
   * The items expanded at first in an uncontrolled tree - by default the
   * ancestors of the item of the current page (see `href`).
   */
  defaultExpanded?: T["id"][];
  /** The items selected at first in an uncontrolled tree. */
  defaultSelected?: T["id"][];
  /**
   * Nothing can be selected, checked or followed - the tree can still be
   * browsed, and a form does not submit its value.
   */
  disabled?: boolean;
  /**
   * Shown instead of the tree when it has no items or none matches
   * `filter` - by default "No items" / "No matching items".
   */
  emptyMessage?: React.ReactNode;
  /**
   * The expanded items - use with `onExpandedChange`. Leave out for a tree
   * that keeps its own state (`defaultExpanded`).
   */
  expanded?: T["id"][];
  /**
   * Shows only the items whose label contains this text - ignoring case
   * and diacritics - with their ancestors, expanded, and the match
   * highlighted. Children not loaded yet are not searched. Clearing it
   * brings back the tree as it was expanded.
   */
  filter?: string;
  /** Id of the form the value belongs to, when the tree is not inside it. */
  form?: string;
  /** The items at the top level - with their `children`. */
  items: T[];
  /**
   * Loads the children of an item with `hasChildren` when it is first
   * expanded - a loading row shows meanwhile, and a failed load offers to
   * try again, as does expanding the item again once it was collapsed. The
   * children are kept; `signal` aborts when the tree unmounts.
   */
  loadChildren?: (item: T, options: { signal: AbortSignal }) => Promise<T[]>;
  /**
   * Submits the checked items with the form - the selected ones in a tree
   * without checkboxes - as one value per item, like checkboxes of one
   * name. `form.reset()` brings back `defaultChecked` / `defaultSelected`.
   */
  name?: string;
  /**
   * Called with all checked items when the user checks or unchecks one -
   * parents whose children are all checked included, in tree order.
   */
  onCheckedChange?: (checked: T["id"][]) => void;
  /** Called with all expanded items when the user expands or collapses one. */
  onExpandedChange?: (expanded: T["id"][]) => void;
  /**
   * An enabled item was clicked (not on its checkbox), or Enter was pressed
   * on it - also Space in a tree that neither selects nor checks.
   */
  onItemClick?: (item: T) => void;
  /** Called with all selected items when the selection changes. */
  onSelectedChange?: (selected: T["id"][]) => void;
  /**
   * Controls at the end of the row of the hovered or focused item, e.g.
   * buttons to edit or delete it. From the keyboard, Tab moves from the
   * focused item into them.
   */
  renderActions?: (item: T, state: TreeItemState) => React.ReactNode;
  /**
   * Content of an item instead of its label - e.g. the label with a count.
   * `state.label` is the label with the `filter` match highlighted. It
   * names the item for screen readers, so keep controls out of it (see
   * `renderActions`).
   */
  renderLabel?: (item: T, state: TreeItemState) => React.ReactNode;
  /**
   * The selected items - use with `onSelectedChange`. Leave out for a tree
   * that keeps its own state (`defaultSelected`).
   */
  selected?: T["id"][];
  /**
   * `single` - a click, Enter or Space selects an item; `multiple` - they
   * toggle it, Shift selects a range and Ctrl / ⌘ + A all; `none` - nothing
   * is selected, a click toggles a parent. Defaults to `single`, in a
   * `checkable` tree to `none`.
   */
  selectionMode?: "none" | "single" | "multiple";
}

/** Letters typed within this time of each other are one typeahead search. */
const TYPEAHEAD_TIMEOUT = 500;

const EMPTY_IDS: ReadonlySet<TreeItemId> = new Set();

// Clicks and keys on these inside a row are theirs - the controls of
// `renderLabel` and `renderActions`
const CONTROLS =
  "a[href], button, input, select, textarea, label, [contenteditable]:not([contenteditable='false']), [role='button'], [role='checkbox'], [role='link'], [role='menuitem'], [role='switch']";

// Parts of a row: the link of an item with `href`, the cell of the checkbox
// of a `checkable` tree and the chevron of an expandable item
const LINK_ATTRIBUTE = "data-tree-link";
const CHECKBOX_ATTRIBUTE = "data-tree-checkbox";
const TOGGLE_ATTRIBUTE = "data-tree-toggle";

/** Part of an element id for an item id - which may be any string. */
const encodeId = (id: TreeItemId) =>
  typeof id === "number"
    ? `n${id}`
    : `s${id.replace(/[^a-zA-Z0-9-]/g, (char) => `_${char.charCodeAt(0).toString(16)}`)}`;

/** Indentation of the rows of a level - the chevron column of each level. */
const indent = (level: number) => `${(level - 1) * 1.25 + 0.25}rem`;

/**
 * Whether a click came from a control of `renderLabel` / `renderActions`
 * inside the row - not from its own link or checkbox.
 */
const isFromControl = (event: React.SyntheticEvent<HTMLElement>) => {
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

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

const isModifiedClick = (event: React.MouseEvent) =>
  event.ctrlKey ||
  event.metaKey ||
  event.shiftKey ||
  event.altKey ||
  event.button !== 0;

/** The rows' handlers - stable, so that rows render only when they change. */
interface RowHandlers {
  onClick: (event: React.MouseEvent<HTMLElement>, id: TreeItemId) => void;
  onDoubleClick: (event: React.MouseEvent<HTMLElement>, id: TreeItemId) => void;
  onFocus: (event: React.FocusEvent<HTMLElement>, id: TreeItemId) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, id: TreeItemId) => void;
  onRetry: (id: TreeItemId) => void;
  onToggle: (event: React.MouseEvent<HTMLElement>, id: TreeItemId) => void;
}

/**
 * A tree of items to expand, select or check - categories, folders,
 * permissions or a navigation. Follows the ARIA tree view pattern: the tree
 * is one tab stop, the arrow keys move between the items and expand them,
 * Home / End jump, `*` expands all siblings and typing a letter moves to
 * the next item starting with it. Children can be loaded as an item is
 * first expanded (`loadChildren`), and `filter` shows only the matching
 * items. Only the expanded items are rendered, so large trees stay fast.
 */
export default function TreeView<T extends TreeItem>({
  checkable = false,
  checked: checkedProp,
  className,
  defaultChecked,
  defaultExpanded,
  defaultSelected,
  disabled = false,
  emptyMessage,
  expanded: expandedProp,
  filter,
  form,
  items,
  loadChildren,
  name,
  onBlur,
  onCheckedChange,
  onExpandedChange,
  onFocus,
  onItemClick,
  onSelectedChange,
  ref,
  renderActions,
  renderLabel,
  selected: selectedProp,
  selectionMode: selectionModeProp,
  ...props
}: TreeViewProps<T>) {
  const messages = useMessages();
  const { Link, pathname, search } = useRouter();
  const baseId = useId();
  const selectionMode = selectionModeProp ?? (checkable ? "none" : "single");

  const { forgetError, forgetErrors, load, loads } =
    useLazyChildren(loadChildren);
  const index = indexTree(items, loads, disabled);

  // The item of the current page - its ancestors expand
  const currentId = findCurrentItem(index.byId, pathname, search);

  // Expanded
  const isExpandedControlled = expandedProp !== undefined;
  const [internalExpanded, setInternalExpanded] = useState<TreeItemId[]>(
    () =>
      defaultExpanded ??
      (currentId === undefined ? [] : getAncestors(index.parentOf, currentId)),
  );
  const expandedIds: readonly TreeItemId[] = isExpandedControlled
    ? expandedProp
    : internalExpanded;
  const expandedSet = new Set(expandedIds);

  // The current page moved into a collapsed part of an uncontrolled tree -
  // it expands, like the groups of the Drawer
  const [revealedId, setRevealedId] = useState(currentId);
  if (currentId !== revealedId) {
    setRevealedId(currentId);
    const hidden =
      currentId === undefined || isExpandedControlled
        ? []
        : getAncestors(index.parentOf, currentId).filter(
            (id) => !expandedSet.has(id),
          );
    if (hidden.length > 0) {
      setInternalExpanded([...internalExpanded, ...hidden]);
    }
  }

  // Selected
  const isSelectedControlled = selectedProp !== undefined;
  const [internalSelected, setInternalSelected] = useState<TreeItemId[]>(
    () => defaultSelected ?? [],
  );
  const selectedIds: readonly TreeItemId[] = isSelectedControlled
    ? selectedProp
    : internalSelected;
  const selectedSet = new Set(selectedIds);

  // Checked
  const isCheckedControlled = checkedProp !== undefined;
  const [internalChecked, setInternalChecked] = useState<TreeItemId[]>(
    () => defaultChecked ?? [],
  );
  const checkedIds: readonly TreeItemId[] = isCheckedControlled
    ? checkedProp
    : internalChecked;
  const checkedSet = new Set(checkedIds);
  const checkStates = checkable
    ? getCheckStates(items, loads, checkedSet)
    : null;
  // The value as the tree shows it - parents of checked children included
  const checkedValue = checkStates
    ? getCheckedIds(checkStates, checkedSet)
    : checkedIds;

  // Filter - the user may collapse parts of the filtered tree, until the
  // filter changes
  const term = filter?.trim() ?? "";
  const filterResult = term ? filterTree(items, loads, term) : null;
  const [filterCollapsed, setFilterCollapsed] = useState({
    ids: EMPTY_IDS,
    term,
  });
  const collapsedInFilter =
    filterCollapsed.term === term ? filterCollapsed.ids : EMPTY_IDS;

  const rows = getVisibleRows(items, {
    canLoad: !!loadChildren,
    expanded: expandedSet,
    filterCollapsed: collapsedInFilter,
    loads,
    shown: filterResult?.shown,
  });
  const rowIndexById = new Map(rows.map((row, rowIndex) => [row.id, rowIndex]));

  // The expanded items whose children are yet to load
  useEffect(() => {
    for (const row of rows) {
      if (row.loadStatus === "loading") load(row.item);
    }
  }, [load, rows]);

  // A failed load shows as long as its row does: collapsed (also by a
  // parent, or while the load still ran), the item tries again when it is
  // expanded next
  useEffect(() => {
    forgetErrors(
      new Set(
        rows.flatMap((row) => (row.loadStatus === "error" ? [row.id] : [])),
      ),
    );
  }, [forgetErrors, rows]);

  // Roving tab stop: the focused item - or its nearest shown ancestor once
  // it is collapsed away - else the first selected item, the item of the
  // current page, or the first one
  const [focusedId, setFocusedId] = useState<TreeItemId | null>(null);
  let tabStopIndex = -1;
  for (
    let id: TreeItemId | null | undefined = focusedId;
    id !== null && id !== undefined && tabStopIndex === -1;
    id = index.parentOf.get(id)
  ) {
    tabStopIndex = rowIndexById.get(id) ?? -1;
  }
  if (tabStopIndex === -1) {
    tabStopIndex = rows.findIndex((row) => selectedSet.has(row.id));
  }
  if (tabStopIndex === -1 && currentId !== undefined) {
    tabStopIndex = rowIndexById.get(currentId) ?? -1;
  }
  if (tabStopIndex === -1 && rows.length > 0) tabStopIndex = 0;

  const [hoveredId, setHoveredId] = useState<TreeItemId | null>(null);
  const [hasFocus, setHasFocus] = useState(false);

  const treeRef = useRef<HTMLUListElement | null>(null);
  // Where Shift extends a range selection from
  const anchorRef = useRef<TreeItemId | null>(null);
  // The text typed for typeahead and when its last letter came
  const typeaheadRef = useRef({ text: "", time: 0 });

  const treeRefCallback = useCallback(
    (element: HTMLUListElement | null) => {
      treeRef.current = element;
      const detachRef = attachRef(ref, element);

      // The pointer left the tree - a native listener: the leave events of
      // React are made of `pointerout`, which also comes when the pointer
      // moves onto the controls of a row
      const handlePointerLeave = () => setHoveredId(null);
      element?.addEventListener("pointerleave", handlePointerLeave);

      return () => {
        element?.removeEventListener("pointerleave", handlePointerLeave);
        treeRef.current = null;
        detachRef();
      };
    },
    [ref],
  );

  // Development hints
  const duplicates = index.duplicates.join(", ");
  useEffect(() => {
    if (duplicates) {
      logger.warn(
        `TreeView: more than one item has the id ${duplicates} - ids must be unique in the whole tree.`,
      );
    }
  }, [duplicates]);

  const lockedProps = [
    isExpandedControlled && !onExpandedChange && "`expanded`",
    isSelectedControlled && !onSelectedChange && "`selected`",
    isCheckedControlled && !onCheckedChange && "`checked`",
  ]
    .filter(Boolean)
    .join(", ");
  useEffect(() => {
    if (lockedProps) {
      logger.warn(
        `TreeView: ${lockedProps} without its change handler cannot be changed by the user - use the default… prop for the initial state.`,
      );
    }
  }, [lockedProps]);

  // The rows of the last commit - where a removed item was
  const committedRowsRef = useRef(rows);

  useLayoutEffect(() => {
    const previousRows = committedRowsRef.current;
    committedRowsRef.current = rows;

    // The focused item was removed (not just collapsed away) - the item
    // that takes its place gets the tab stop, as in a list: its next
    // sibling, else the row above it
    let focusIndex = tabStopIndex;
    if (focusedId !== null && !index.byId.has(focusedId)) {
      const shownRows = new Map(
        rows.map((row, rowIndex) => [row.id, rowIndex]),
      );
      const replacement = findReplacementRow(previousRows, focusedId, (id) =>
        shownRows.has(id),
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusedId(replacement);
      focusIndex =
        (replacement === null ? undefined : shownRows.get(replacement)) ??
        tabStopIndex;
    }

    // The focused item went away (collapsed or removed from outside) - the
    // focus stays in the tree instead of dropping to the page
    const tree = treeRef.current;
    if (!hasFocus || !tree) return;

    const active = tree.ownerDocument.activeElement;
    if (active && active !== tree.ownerDocument.body) return;
    tree
      .querySelectorAll<HTMLElement>("[role='treeitem']")
      [focusIndex]?.focus();
  }, [focusedId, hasFocus, index, rows, tabStopIndex]);

  const focusRow = (rowIndex: number | undefined) => {
    if (rowIndex === undefined) return;
    treeRef.current
      ?.querySelectorAll<HTMLElement>("[role='treeitem']")
      [rowIndex]?.focus();
  };

  const changeExpanded = (next: TreeItemId[]) => {
    if (!isExpandedControlled) setInternalExpanded(next);
    onExpandedChange?.(next as T["id"][]);
  };

  const changeSelected = (next: TreeItemId[]) => {
    if (!isSelectedControlled) setInternalSelected(next);
    onSelectedChange?.(next as T["id"][]);
  };

  const changeChecked = (next: TreeItemId[]) => {
    if (!isCheckedControlled) setInternalChecked(next);
    onCheckedChange?.(next as T["id"][]);
  };

  /** Expands or collapses rows - in a filtered tree only for the filter. */
  const setRowsExpanded = (targets: TreeRow<T>[], expand: boolean) => {
    const changed = targets.filter(
      (row) => row.expandable && row.expanded !== expand,
    );
    if (changed.length === 0) return;

    const ids = changed.map((row) => row.id);

    if (filterResult) {
      const next = new Set(collapsedInFilter);
      for (const id of ids) {
        if (expand) next.delete(id);
        else next.add(id);
      }
      setFilterCollapsed({ ids: next, term });
      return;
    }

    changeExpanded(
      expand
        ? [...expandedIds, ...ids]
        : expandedIds.filter((id) => !ids.includes(id)),
    );
  };

  const selectOnly = (row: TreeRow<T>) => {
    anchorRef.current = row.id;
    if (selectedIds.length === 1 && selectedIds[0] === row.id) return;
    changeSelected([row.id]);
  };

  const toggleSelected = (row: TreeRow<T>) => {
    if (index.disabled.has(row.id)) return;
    anchorRef.current = row.id;
    changeSelected(
      selectedSet.has(row.id)
        ? selectedIds.filter((id) => id !== row.id)
        : [...selectedIds, row.id],
    );
  };

  /** Adds `ids` to the selection. */
  const selectMore = (ids: TreeItemId[]) => {
    const added = ids.filter((id) => !selectedSet.has(id));
    if (added.length > 0) changeSelected([...selectedIds, ...added]);
  };

  /** Selects the rows from the anchor (the last toggled one) to `rowIndex`. */
  const selectRange = (rowIndex: number) => {
    const anchorIndex =
      anchorRef.current === null
        ? undefined
        : rowIndexById.get(anchorRef.current);
    selectMore(
      getRangeIds(rows, anchorIndex ?? rowIndex, rowIndex, index.disabled),
    );
  };

  const toggleChecked = (row: TreeRow<T>) => {
    if (!checkStates) return;

    const next = toggleCheck(row.id, {
      checked: checkedSet,
      index,
      items,
      loads,
      states: checkStates,
    });
    if (next) changeChecked(next);
  };

  /** A click on the row, or Enter - what it does depends on the tree. */
  const activate = (
    row: TreeRow<T>,
    rowIndex: number,
    event: { shiftKey: boolean },
  ) => {
    const { item } = row;

    // A click toggles a parent in a tree that neither selects nor checks -
    // a disabled one too, as expanding changes nothing
    if (selectionMode === "none" && !checkable && !item.href) {
      setRowsExpanded([row], !row.expanded);
    }
    if (index.disabled.has(row.id)) return;

    if (selectionMode === "single") selectOnly(row);
    else if (selectionMode === "multiple") {
      if (event.shiftKey) selectRange(rowIndex);
      else toggleSelected(row);
    } else if (checkable) toggleChecked(row);

    // A link shows its children as it is followed
    if (item.href) setRowsExpanded([row], true);

    onItemClick?.(item);
  };

  /** Follows the link of a row - through a click, which the router handles. */
  const followLink = (rowElement: HTMLElement) => {
    rowElement.querySelector<HTMLElement>(`[${LINK_ATTRIBUTE}]`)?.click();
  };

  const isTypeaheadActive = (time: number) =>
    typeaheadRef.current.text !== "" &&
    time - typeaheadRef.current.time < TYPEAHEAD_TIMEOUT;

  const typeahead = (char: string, time: number, rowIndex: number) => {
    let text =
      (isTypeaheadActive(time) ? typeaheadRef.current.text : "") + char;
    let match = findTypeaheadRow(rows, rowIndex, text);

    // Nothing starts with the whole text - the letter starts a new search
    if (match === -1 && text.length > 1) {
      text = char;
      match = findTypeaheadRow(rows, rowIndex, text);
    }

    typeaheadRef.current = { text: match === -1 ? "" : text, time };
    if (match !== -1) focusRow(match);
  };

  const handleRowClick = (
    event: React.MouseEvent<HTMLElement>,
    id: TreeItemId,
  ) => {
    const rowIndex = rowIndexById.get(id);
    if (rowIndex === undefined || isFromControl(event)) return;
    const row = rows[rowIndex];

    const target = event.target instanceof Element ? event.target : null;

    // The checkbox checks the item - also in a tree whose clicks select or
    // follow links
    if (checkable && target?.closest(`[${CHECKBOX_ATTRIBUTE}]`)) {
      toggleChecked(row);
      return;
    }

    const onLink = !!target?.closest(`[${LINK_ATTRIBUTE}]`);

    if (row.item.href && !index.disabled.has(id)) {
      // A click opening the link elsewhere (a new tab) leaves the tree be
      if (onLink && isModifiedClick(event)) return;
      // Beside the link - the row follows it as a whole
      if (!onLink) {
        followLink(event.currentTarget);
        return;
      }
    }

    activate(row, rowIndex, event);
  };

  const handleRowDoubleClick = (
    event: React.MouseEvent<HTMLElement>,
    id: TreeItemId,
  ) => {
    const rowIndex = rowIndexById.get(id);
    if (rowIndex === undefined || isFromControl(event)) return;
    const row = rows[rowIndex];
    const target = event.target instanceof Element ? event.target : null;

    // Where a click selects or checks, a double click toggles the children
    // - not on the chevron or the checkbox, which take both clicks
    if (
      row.item.href ||
      target?.closest(`[${TOGGLE_ATTRIBUTE}], [${CHECKBOX_ATTRIBUTE}]`) ||
      (selectionMode === "none" && !checkable)
    ) {
      return;
    }
    setRowsExpanded([row], !row.expanded);
  };

  const handleRowFocus = (
    event: React.FocusEvent<HTMLElement>,
    id: TreeItemId,
  ) => {
    // A click on the link of a row focuses it in some browsers - the row
    // keeps the focus, so the keys keep working
    if (
      event.target instanceof Element &&
      event.target.hasAttribute(LINK_ATTRIBUTE)
    ) {
      event.currentTarget.focus();
    }
    setFocusedId(id);
  };

  const handleToggleClick = (
    event: React.MouseEvent<HTMLElement>,
    id: TreeItemId,
  ) => {
    event.stopPropagation();
    const rowIndex = rowIndexById.get(id);
    if (rowIndex === undefined) return;
    setRowsExpanded([rows[rowIndex]], !rows[rowIndex].expanded);
  };

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    id: TreeItemId,
  ) => {
    // The keys of controls inside the row are theirs, and so are those of an
    // input method composing text
    if (event.target !== event.currentTarget || event.nativeEvent.isComposing) {
      return;
    }

    const rowIndex = rowIndexById.get(id);
    if (rowIndex === undefined) return;

    const row = rows[rowIndex];
    const isDisabled = index.disabled.has(id);
    const multiple = selectionMode === "multiple";
    const mod = event.ctrlKey || event.metaKey;
    const last = rows.length - 1;

    // Left expands and Right collapses in a right-to-left page
    const key =
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      isRtl(event.currentTarget)
        ? event.key === "ArrowLeft"
          ? "ArrowRight"
          : "ArrowLeft"
        : event.key;

    switch (key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (event.altKey || mod) return;
        event.preventDefault();

        const next = event.key === "ArrowDown" ? rowIndex + 1 : rowIndex - 1;
        if (next < 0 || next > last) return;
        focusRow(next);
        // Shift + arrow extends the selection
        if (multiple && event.shiftKey) toggleSelected(rows[next]);
        return;
      }
      case "ArrowRight": {
        if (event.altKey || mod) return;
        event.preventDefault();

        if (!row.expanded) setRowsExpanded([row], true);
        else if (rows[rowIndex + 1]?.parentId === id) focusRow(rowIndex + 1);
        return;
      }
      case "ArrowLeft": {
        if (event.altKey || mod) return;
        event.preventDefault();

        if (row.expanded) setRowsExpanded([row], false);
        else if (row.parentId !== null) {
          focusRow(rowIndexById.get(row.parentId));
        }
        return;
      }
      case "Home":
      case "End": {
        event.preventDefault();

        const next = event.key === "Home" ? 0 : last;
        focusRow(next);
        // Ctrl + Shift + Home / End select up to the first / last item
        if (multiple && mod && event.shiftKey) {
          selectMore(getRangeIds(rows, rowIndex, next, index.disabled));
        }
        return;
      }
      case "Enter": {
        event.preventDefault();

        if (row.item.href && !isDisabled) followLink(event.currentTarget);
        else activate(row, rowIndex, event);
        return;
      }
      case "*": {
        event.preventDefault();

        // All siblings of the focused item expand
        setRowsExpanded(
          rows.filter((sibling) => sibling.parentId === row.parentId),
          true,
        );
        return;
      }
    }

    // Space - unless it continues a typeahead search ("New York")
    if (event.key === " " && !isTypeaheadActive(event.timeStamp)) {
      event.preventDefault();

      if (checkable) {
        toggleChecked(row);
      } else if (selectionMode === "single") {
        if (!isDisabled) selectOnly(row);
      } else if (multiple) {
        if (isDisabled) return;
        if (event.shiftKey) selectRange(rowIndex);
        else toggleSelected(row);
      } else if (row.item.href && !isDisabled) {
        followLink(event.currentTarget);
      } else {
        activate(row, rowIndex, event);
      }
      return;
    }

    // Ctrl / ⌘ + A selects all shown items - or none, when all are
    if (multiple && mod && !event.altKey && event.key.toLowerCase() === "a") {
      event.preventDefault();

      const ids = getRangeIds(rows, 0, last, index.disabled);
      if (ids.every((selectedId) => selectedSet.has(selectedId))) {
        const shown = new Set(ids);
        changeSelected(
          selectedIds.filter((selectedId) => !shown.has(selectedId)),
        );
      } else {
        selectMore(ids);
      }
      return;
    }

    // Typeahead - a printable character moves to the next item starting
    // with the typed text
    if (event.key.length === 1 && !mod && !event.altKey) {
      event.preventDefault();
      typeahead(event.key, event.timeStamp, rowIndex);
    }
  };

  // The row under the pointer shows its actions
  const handlePointerOver = (event: React.PointerEvent<HTMLUListElement>) => {
    const rowElement =
      event.target instanceof Element
        ? event.target.closest("[role='treeitem']")
        : null;
    const row = rows.find(
      (candidate) => rowElement?.id === `${baseId}-${encodeId(candidate.id)}`,
    );
    setHoveredId(row ? row.id : null);
  };

  const handleRetry = (id: TreeItemId) => {
    // The retry button goes away - the focus moves to the item first
    focusRow(rowIndexById.get(id));
    forgetError(id);
  };

  // The rows get stable handlers that call the latest ones - so a row
  // renders again only when its own state changes
  const handlers = {
    onClick: handleRowClick,
    onDoubleClick: handleRowDoubleClick,
    onFocus: handleRowFocus,
    onKeyDown: handleRowKeyDown,
    onRetry: handleRetry,
    onToggle: handleToggleClick,
  };
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const [rowHandlers] = useState<RowHandlers>(() => ({
    onClick: (event, id) => handlersRef.current.onClick(event, id),
    onDoubleClick: (event, id) => handlersRef.current.onDoubleClick(event, id),
    onFocus: (event, id) => handlersRef.current.onFocus(event, id),
    onKeyDown: (event, id) => handlersRef.current.onKeyDown(event, id),
    onRetry: (id) => handlersRef.current.onRetry(id),
    onToggle: (event, id) => handlersRef.current.onToggle(event, id),
  }));

  // Form: the value as hidden inputs, and a reset brings back the defaults
  const formResetRef = useFormReset(() => {
    if (!isCheckedControlled) setInternalChecked(defaultChecked ?? []);
    if (!isSelectedControlled) setInternalSelected(defaultSelected ?? []);
  }, form);

  const submittedIds = checkable ? checkedValue : selectedIds;
  const hiddenInputs = name ? (
    <div hidden ref={formResetRef}>
      {submittedIds.map((id) => (
        <input
          disabled={disabled}
          form={form}
          key={encodeId(id)}
          name={name}
          type="hidden"
          value={String(id)}
        />
      ))}
    </div>
  ) : null;

  // The message takes the place of the tree - with its props and `ref`
  if (rows.length === 0) {
    return (
      <>
        <ul
          {...props}
          className={cn(
            "py-2 text-sm text-neutral-500 dark:text-neutral-400",
            className,
          )}
          onBlur={onBlur}
          onFocus={onFocus}
          ref={treeRefCallback}
          role="status"
        >
          <li role="none">
            {emptyMessage ??
              (term ? messages.treeView.noMatches : messages.treeView.noItems)}
          </li>
        </ul>
        {hiddenInputs}
      </>
    );
  }

  const context: RenderContext<T> = {
    baseId,
    checkable,
    checkStates,
    currentId,
    disabledSet: index.disabled,
    handlers: rowHandlers,
    hasFocus,
    hoveredId,
    Link,
    loadError: messages.treeView.loadError,
    loading: messages.common.loading,
    matches: filterResult?.matches,
    renderActions,
    renderLabel,
    retry: messages.treeView.retry,
    rows,
    selectedSet,
    selectionMode,
    tabStopIndex,
  };

  return (
    <>
      <ul
        {...props}
        aria-multiselectable={selectionMode === "multiple" || undefined}
        className={cn("text-sm", className)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setHasFocus(false);
          }
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setHasFocus(true);
          onFocus?.(event);
        }}
        onPointerOver={renderActions ? handlePointerOver : undefined}
        ref={treeRefCallback}
        role="tree"
      >
        {renderRows(context, 0, rows.length)}
      </ul>
      {hiddenInputs}
    </>
  );
}

/** What the rows are rendered from. */
interface RenderContext<T extends TreeItem> {
  baseId: string;
  checkable: boolean;
  checkStates: ReadonlyMap<TreeItemId, CheckState> | null;
  currentId: TreeItemId | undefined;
  disabledSet: ReadonlySet<TreeItemId>;
  handlers: RowHandlers;
  hasFocus: boolean;
  hoveredId: TreeItemId | null;
  Link: LinkComponent;
  loadError: string;
  loading: string;
  matches: ReadonlyMap<TreeItemId, [number, number][]> | undefined;
  renderActions: TreeViewProps<T>["renderActions"];
  renderLabel: TreeViewProps<T>["renderLabel"];
  retry: string;
  rows: TreeRow<T>[];
  selectedSet: ReadonlySet<TreeItemId>;
  selectionMode: "none" | "single" | "multiple";
  tabStopIndex: number;
}

/**
 * The rows from `start` to `end` as nested lists - the children of a row in
 * a group next to it, which its row owns (`aria-owns`), so the focus ring
 * and the name of an item stay on its own row.
 */
function renderRows<T extends TreeItem>(
  context: RenderContext<T>,
  start: number,
  end: number,
): React.ReactNode[] {
  const { rows, selectionMode } = context;
  const nodes: React.ReactNode[] = [];

  for (let rowIndex = start; rowIndex < end; rowIndex = rows[rowIndex].end) {
    const row = rows[rowIndex];
    const key = encodeId(row.id);
    const domId = `${context.baseId}-${key}`;
    const groupId = `${domId}-group`;
    const isDisabled = context.disabledSet.has(row.id);
    const isSelected = context.selectedSet.has(row.id);

    nodes.push(
      <li key={key} role="none">
        <TreeRowView
          checkable={context.checkable}
          checked={context.checkStates?.get(row.id)}
          current={row.id === context.currentId}
          disabled={isDisabled}
          domId={domId}
          expandable={row.expandable}
          expanded={row.expanded}
          groupId={row.expanded ? groupId : undefined}
          handlers={context.handlers}
          item={row.item}
          level={row.level}
          Link={context.Link}
          loading={row.loadStatus === "loading"}
          matches={context.matches?.get(row.id)}
          posinset={row.posinset}
          renderActions={context.renderActions}
          renderLabel={context.renderLabel}
          // A single-select tree marks only the selected item; a multiple
          // one every item that can be selected
          selectable={
            selectionMode === "multiple"
              ? isSelected || !isDisabled
              : selectionMode === "single" && isSelected
          }
          selected={isSelected}
          setsize={row.setsize}
          showActions={
            !!context.renderActions &&
            (context.hoveredId === row.id ||
              (context.hasFocus && context.tabStopIndex === rowIndex))
          }
          tabStop={context.tabStopIndex === rowIndex}
        />
        {row.expanded && (
          <ul aria-labelledby={`${domId}-label`} id={groupId} role="group">
            {renderRows(context, rowIndex + 1, row.end)}
            {row.loadStatus === "loading" && (
              <li role="none">
                <div
                  className="flex min-h-8 items-center gap-1.5 py-1 pe-2 text-neutral-500 dark:text-neutral-400"
                  role="status"
                  style={{ paddingInlineStart: indent(row.level + 1) }}
                >
                  {/* A picture - the text beside it says the same */}
                  <Spinner
                    aria-hidden="true"
                    className="size-5"
                    label=""
                    role="none"
                    size="sm"
                  />
                  {context.loading}
                </div>
              </li>
            )}
            {row.loadStatus === "error" && (
              <li role="none">
                <div
                  className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 py-1 pe-2"
                  style={{ paddingInlineStart: indent(row.level + 1) }}
                >
                  <span
                    className="text-danger-700 dark:text-danger-400"
                    role="alert"
                  >
                    {context.loadError}
                  </span>
                  <button
                    className="cui-link font-medium text-primary-600 hover:underline dark:text-primary-400"
                    onClick={() => context.handlers.onRetry(row.id)}
                    type="button"
                  >
                    {context.retry}
                  </button>
                </div>
              </li>
            )}
          </ul>
        )}
      </li>,
    );
  }

  return nodes;
}

interface TreeRowViewProps<T extends TreeItem> {
  checkable: boolean;
  checked?: CheckState;
  /** The item of the current page. */
  current: boolean;
  disabled: boolean;
  domId: string;
  expandable: boolean;
  expanded: boolean;
  /** Id of the group of the children, while it is shown. */
  groupId?: string;
  handlers: RowHandlers;
  item: T;
  level: number;
  Link: LinkComponent;
  /** The children are loading. */
  loading: boolean;
  matches?: [number, number][];
  posinset: number;
  renderActions?: TreeViewProps<T>["renderActions"];
  renderLabel?: TreeViewProps<T>["renderLabel"];
  /** Has `aria-selected`. */
  selectable: boolean;
  selected: boolean;
  setsize: number;
  showActions: boolean;
  /** The one item Tab stops at. */
  tabStop: boolean;
}

/**
 * The row of an item - the tree item itself. A component of its own with
 * stable props, so that the compiler memoizes every row: moving the focus
 * renders the two rows it moves between, not the whole tree.
 */
function TreeRowView<T extends TreeItem>({
  checkable,
  checked,
  current,
  disabled,
  domId,
  expandable,
  expanded,
  groupId,
  handlers,
  item,
  level,
  Link,
  loading,
  matches,
  posinset,
  renderActions,
  renderLabel,
  selectable,
  selected,
  setsize,
  showActions,
  tabStop,
}: TreeRowViewProps<T>) {
  const labelId = `${domId}-label`;
  const label = <HighlightedText matches={matches} text={item.label} />;
  const state: TreeItemState = {
    checked,
    disabled,
    expanded,
    label,
    level,
    selected,
  };

  const content = (
    <>
      {item.icon && (
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center text-neutral-500 dark:text-neutral-400"
        >
          {item.icon}
        </span>
      )}
      <span className="min-w-0 break-words" id={labelId}>
        {renderLabel ? renderLabel(item, state) : label}
      </span>
    </>
  );
  const contentClassName = cn(
    "flex min-w-0 flex-1 items-center gap-2 self-stretch",
    disabled && "text-neutral-400 dark:text-neutral-500",
  );

  return (
    <div
      aria-busy={loading || undefined}
      aria-checked={checked}
      aria-current={current ? "page" : undefined}
      aria-disabled={disabled || undefined}
      aria-expanded={expandable ? expanded : undefined}
      aria-labelledby={labelId}
      aria-level={level}
      aria-owns={groupId}
      aria-posinset={posinset}
      aria-selected={selectable ? selected : undefined}
      aria-setsize={setsize}
      className={cn(
        "flex min-h-8 items-center gap-1.5 rounded-md py-1 pe-2 outline-none select-none pointer-coarse:min-h-10",
        "focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset",
        disabled ? "cursor-default" : "cursor-pointer",
        selected || current
          ? "bg-primary-50 text-primary-800 dark:bg-primary-950/60 dark:text-primary-200"
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        current && "font-medium",
      )}
      id={domId}
      onClick={(event) => handlers.onClick(event, item.id)}
      onDoubleClick={(event) => handlers.onDoubleClick(event, item.id)}
      onFocus={(event) => handlers.onFocus(event, item.id)}
      onKeyDown={(event) => handlers.onKeyDown(event, item.id)}
      role="treeitem"
      style={{ paddingInlineStart: indent(level) }}
      tabIndex={tabStop ? 0 : -1}
    >
      {/* The pointer's toggle - the keyboard uses the arrow keys */}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded text-neutral-500 dark:text-neutral-400",
          expandable &&
            "cursor-pointer hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200",
        )}
        data-tree-toggle={expandable ? "" : undefined}
        onClick={
          expandable ? (event) => handlers.onToggle(event, item.id) : undefined
        }
      >
        {expandable && (
          <ChevronRight
            className={cn(
              "transition-transform duration-150 motion-reduce:transition-none",
              // Pointing at the text - to the left in a right-to-left page
              expanded ? "rotate-90" : "rtl:-scale-x-100",
            )}
            size={16}
          />
        )}
      </span>

      {/* A picture of the state - the item itself is the checkbox for
          assistive technology (`aria-checked`). A click on the cell around
          it checks the item - the row handles it - also in a tree whose
          clicks select. */}
      {checkable && (
        <span
          className="-mx-1.5 flex size-6 shrink-0 items-center justify-center"
          data-tree-checkbox=""
        >
          <input
            aria-hidden="true"
            checked={checked === true}
            className="pointer-events-none accent-primary-500 disabled:opacity-50"
            disabled={disabled}
            inert
            readOnly
            ref={(input) => {
              if (!input) return;
              // It is a checkbox in the form of the page, which sets it back
              // to its default on a reset - kept at what it shows (React sets
              // the default only as it mounts)
              input.checked = checked === true;
              input.defaultChecked = checked === true;
              input.indeterminate = checked === "mixed";
            }}
            tabIndex={-1}
            type="checkbox"
          />
        </span>
      )}

      {item.href && !disabled ? (
        <Link
          className={contentClassName}
          data-tree-link=""
          href={item.href}
          tabIndex={-1}
        >
          {content}
        </Link>
      ) : (
        <span className={contentClassName}>{content}</span>
      )}

      {showActions && renderActions && (
        <span className="-my-1 flex shrink-0 items-center gap-1">
          {renderActions(item, state)}
        </span>
      )}
    </div>
  );
}

interface HighlightedTextProps {
  /** `[start, end)` ranges of `text` to highlight. */
  matches?: [number, number][];
  text: string;
}

/** `text` with the `matches` of a filter marked - as React nodes, never as HTML. */
function HighlightedText({ matches, text }: HighlightedTextProps) {
  if (!matches || matches.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach(([start, end], matchIndex) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        className="rounded-sm bg-warning-200 text-inherit dark:bg-warning-500/40"
        key={matchIndex}
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });

  if (cursor < text.length) parts.push(text.slice(cursor));

  return parts;
}
