import { ChevronRight } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import cn from "../../../utils/cn";
import logger from "../../../utils/logger";
import Spinner from "../spinner";
import { getActiveElement, getElementByIdAt } from "../overlay-stack";
import {
  attachRef,
  useFieldsetDisabled,
  useFormReset,
} from "../../../hooks/use-form-control";
import useMediaQuery from "../../../hooks/use-media-query";
import type { LinkComponent } from "../../../providers/router";
import {
  useMessages,
  usePortalContainer,
  useRouter,
} from "../../../providers/ui-context";
import {
  CHECKBOX_ATTRIBUTE,
  encodeId,
  indent,
  isFromControl,
  isRtl,
  LINK_ATTRIBUTE,
  TOGGLE_ATTRIBUTE,
} from "./dom";
import {
  getPlaceRow,
  type TreeDropPosition,
  type TreeMove,
} from "./drag-model";
import {
  filterTree,
  findCurrentItem,
  findReplacementRow,
  findTypeaheadRow,
  getAncestors,
  getCheckedIds,
  getCheckStates,
  getIndependentCheckStates,
  getRangeIds,
  getVisibleRows,
  indexTree,
  toggleCheck,
  toggleIndependentCheck,
  TYPEAHEAD_TIMEOUT,
  type CheckState,
  type TreeRow,
} from "./tree-model";
import useLazyChildren from "./use-lazy-children";
import useTreeDrag from "./use-tree-drag";
import useVirtualRange from "./use-virtual-range";
import type { TreeItem, TreeItemId, TreeItemState } from "./types";

export type { TreeDropPosition, TreeMove } from "./drag-model";
export type { TreeItem, TreeItemId, TreeItemState } from "./types";

export interface TreeViewProps<T extends TreeItem = TreeItem> extends Omit<
  React.ComponentProps<"ul">,
  "children" | "defaultChecked" | "defaultValue" | "onChange"
> {
  /**
   * Items that can be moved in a tree with `onMove` - dragged, or picked up
   * with Ctrl / ⌘ + X. By default every enabled item; a disabled one never
   * moves.
   */
  canDrag?: (item: T) => boolean;
  /**
   * Whether the moved `items` may land at `position` next to `target` -
   * e.g. only folders take children (`position === "inside"`). By default
   * everywhere but in or next to the moved items themselves, among their
   * descendants and in a disabled item, which the tree never offers.
   */
  canDrop?: (move: {
    items: T[];
    position: TreeDropPosition;
    target: T;
  }) => boolean;
  /**
   * Gives every item a checkbox - see `checkMode` for how they depend on
   * each other. A click on the checkbox or Space toggles it - in a tree that
   * selects nothing a click anywhere on the row.
   */
  checkable?: boolean;
  /**
   * The checked items of a `checkable` tree - use with `onCheckedChange`.
   * With `checkMode="cascade"` an item counts as checked when its id or the
   * id of an ancestor is here, so the id of an item whose children are not
   * loaded yet stands for all of them. Leave out for a tree that keeps its
   * own state (`defaultChecked`).
   */
  checked?: T["id"][];
  /**
   * How the checkboxes of a `checkable` tree depend on each other:
   * `cascade` - checking an item checks all its enabled descendants, an
   * item is checked when all its children are and partly checked ("mixed")
   * when some are; `independent` - each item is checked on its own (a
   * parent does not check its children nor they it), the value is exactly
   * the checked items and nothing is partly checked.
   */
  checkMode?: "cascade" | "independent";
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
   * Nothing can be selected, checked, followed or moved - the tree can
   * still be browsed, and a form does not submit its value. A disabled
   * fieldset around the tree disables it too, except in its first legend.
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
  /** Change to discard loaded children and reload expanded items; pending loads abort. */
  loadChildrenKey?: string | number;
  /** A lazy load failed. The row also offers retry. */
  onLoadError?: (error: unknown, item: T) => void;
  /**
   * Submits the checked items with the form - the selected ones in a tree
   * without checkboxes - as one value per item, like checkboxes of one
   * name. `form.reset()` brings back `defaultChecked` / `defaultSelected`.
   */
  name?: string;
  /**
   * Called with all checked items when the user checks or unchecks one -
   * with `checkMode="cascade"` parents whose children are all checked
   * included, in tree order.
   */
  onCheckedChange?: (checked: T["id"][]) => void;
  /** Called with all expanded items when the user expands or collapses one. */
  onExpandedChange?: (expanded: T["id"][]) => void;
  /**
   * An enabled item was clicked (not on its checkbox), or Enter was pressed
   * on it - also Space in a tree that neither selects nor checks.
   */
  onItemClick?: (item: T) => void;
  /**
   * Lets the user move items - and is called with each move. The mouse or a
   * pen drags an item, a finger after resting on it for a moment; Ctrl / ⌘ +
   * X picks up the focused item, the arrow keys choose the place and Enter
   * drops it. In a multiple selection a selected item moves with the other
   * selected ones. The tree does not reorder `items` itself: move them in
   * your data, keeping their ids, and the tree shows them at their new
   * place. Children `loadChildren` brought are kept by the tree - to move
   * them, put them into `items` as the `children` of their parent.
   */
  onMove?: (move: TreeMove<T["id"]>) => void;
  /** Called with all selected items when the selection changes. */
  onSelectedChange?: (selected: T["id"][]) => void;
  /** `virtualized` only: the rows rendered above and below the view. */
  overscan?: number;
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
   * `virtualized` only: the height of every row in pixels - by default 32,
   * and 40 on a touch screen (a coarse pointer), as the rows of a tree that
   * is not virtualized.
   */
  rowHeight?: number;
  /**
   * The selected items - use with `onSelectedChange`. Leave out for a tree
   * that keeps its own state (`defaultSelected`).
   */
  selected?: T["id"][];
  /**
   * `single` - a click, Enter or Space selects an item; `multiple` - they
   * toggle it, Shift selects a range and Ctrl / ⌘ + A all; `none` - nothing
   * is selected, a click toggles a parent. Defaults to `single` - to `none`
   * in a `checkable` tree, and in a navigation: a tree of links (items with
   * `href`) without `selected`, `defaultSelected`, `onSelectedChange` and
   * `name`. The links of `items` decide it - links that `loadChildren`
   * brings later leave a tree of folders selecting.
   */
  selectionMode?: "none" | "single" | "multiple";
  /**
   * Renders only the rows in view (and `overscan` more) - for trees of
   * thousands of expanded items. The tree scrolls itself, so give it a
   * height - `className="h-96"` or `max-h-96`. Its rows are all
   * `rowHeight` high, their labels on one line, and they are one flat list
   * of tree items - each with its level and position - instead of nested
   * groups.
   */
  virtualized?: boolean;
}

/** Rows rendered above and below the view of a virtualized tree. */
const DEFAULT_OVERSCAN = 8;

const EMPTY_IDS: ReadonlySet<TreeItemId> = new Set();

/** Whether any of the items given - not those loaded later - is a link. */
function hasLinks(items: readonly TreeItem[]): boolean {
  return items.some((item) => item.href || hasLinks(item.children ?? []));
}

const isModifiedClick = (event: React.MouseEvent) =>
  event.ctrlKey ||
  event.metaKey ||
  event.shiftKey ||
  event.altKey ||
  event.button !== 0;

/** A row of a virtualized tree - an item, or the row of its children loading. */
interface FlatRow {
  kind: "error" | "item" | "loading";
  rowIndex: number;
}

/**
 * The rows of a virtualized tree, one flat list: the items, and after an
 * item whose children are loading (or failed to) the row saying so - with
 * the place of each item in it.
 */
function getFlatRows<T>(rows: readonly TreeRow<T>[]) {
  const entries: FlatRow[] = [];
  const entryOfRow: number[] = [];

  rows.forEach((row, rowIndex) => {
    entryOfRow.push(entries.length);
    entries.push({ kind: "item", rowIndex });
    if (row.loadStatus) entries.push({ kind: row.loadStatus, rowIndex });
  });

  return { entries, entryOfRow };
}

// The index of the row of each element id key - per list of rows, built
// once the events of a drag look them up
const rowKeyIndexes = new WeakMap<object, Map<string, number>>();

function getRowKeyIndex<T>(rows: readonly TreeRow<T>[]) {
  let keyIndex = rowKeyIndexes.get(rows);
  if (!keyIndex) {
    keyIndex = new Map(
      rows.map((row, rowIndex) => [encodeId(row.id), rowIndex]),
    );
    rowKeyIndexes.set(rows, keyIndex);
  }
  return keyIndex;
}

/** The rows' handlers - stable, so that rows render only when they change. */
interface RowHandlers {
  onClick: (event: React.MouseEvent<HTMLElement>, id: TreeItemId) => void;
  onDoubleClick: (event: React.MouseEvent<HTMLElement>, id: TreeItemId) => void;
  onFocus: (event: React.FocusEvent<HTMLElement>, id: TreeItemId) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, id: TreeItemId) => void;
  onPointerDown: (
    event: React.PointerEvent<HTMLElement>,
    id: TreeItemId,
  ) => void;
  onRetry: (id: TreeItemId) => void;
  onToggle: (event: React.MouseEvent<HTMLElement>, id: TreeItemId) => void;
}

/**
 * A tree of items to expand, select, check or move - categories, folders,
 * permissions or a navigation. Follows the ARIA tree view pattern: the tree
 * is one tab stop, the arrow keys move between the items and expand them,
 * Home / End jump, `*` expands all siblings and typing a letter moves to
 * the next item starting with it. Children can be loaded as an item is
 * first expanded (`loadChildren`), `filter` shows only the matching items
 * and `onMove` lets the user drag them elsewhere. Only the expanded items
 * are rendered - with `virtualized` only those in view. The attributes and
 * the `ref` go to the tree (`<ul>`). Its items have `data-selected`,
 * `data-current` (the page of a link), `data-disabled` and, with children,
 * `data-state="open"` or `"closed"` - for styling.
 */
export default function TreeView<T extends TreeItem>({
  canDrag,
  canDrop,
  checkable = false,
  checked: checkedProp,
  checkMode = "cascade",
  className,
  defaultChecked,
  defaultExpanded,
  defaultSelected,
  disabled: disabledProp = false,
  emptyMessage,
  expanded: expandedProp,
  filter,
  form,
  items,
  loadChildren,
  loadChildrenKey,
  onLoadError,
  name,
  onBlur,
  onCheckedChange,
  onExpandedChange,
  onFocus,
  onItemClick,
  onMove,
  onSelectedChange,
  overscan = DEFAULT_OVERSCAN,
  ref,
  renderActions,
  renderLabel,
  rowHeight: rowHeightProp,
  selected: selectedProp,
  selectionMode: selectionModeProp,
  style,
  virtualized = false,
  ...props
}: TreeViewProps<T>) {
  const messages = useMessages().ui;
  const { Link, pathname, search } = useRouter();
  const baseId = useId();
  const movingDescriptionId = `${baseId}-moving`;

  // Tree items are not native fields: a fieldset leaves their events alone.
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;

  const { forgetError, forgetErrors, load, loads } = useLazyChildren(
    loadChildren,
    loadChildrenKey,
    onLoadError,
  );
  const index = useMemo(
    () => indexTree(items, loads, disabled),
    [items, loads, disabled],
  );
  const navigationItems = useMemo(() => hasLinks(items), [items]);

  // A tree of links given nothing to select is a navigation: the item of
  // the current page is marked, and a click follows its link without
  // selecting it - a selected item would stay marked as a second current
  // page once the page changes elsewhere (the back button). Only by the
  // links of `items`: links that `loadChildren` brings later do not switch
  // how a tree of folders behaves while it is used.
  const isNavigation =
    selectedProp === undefined &&
    defaultSelected === undefined &&
    !onSelectedChange &&
    name === undefined &&
    navigationItems;
  const selectionMode =
    selectionModeProp ?? (checkable || isNavigation ? "none" : "single");

  // The item of the current page - its ancestors expand
  const currentId = useMemo(
    () => findCurrentItem(index.byId, pathname, search),
    [index.byId, pathname, search],
  );

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
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);

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
  // A tree that selects nothing shows no selection - also of a `selected`
  const selectedSet = useMemo(
    () => (selectionMode === "none" ? EMPTY_IDS : new Set(selectedIds)),
    [selectionMode, selectedIds],
  );

  // Checked
  const isIndependent = checkMode === "independent";
  const isCheckedControlled = checkedProp !== undefined;
  const [internalChecked, setInternalChecked] = useState<TreeItemId[]>(
    () => defaultChecked ?? [],
  );
  const checkedIds: readonly TreeItemId[] = isCheckedControlled
    ? checkedProp
    : internalChecked;
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const checkStates = useMemo(
    () =>
      !checkable
        ? null
        : isIndependent
          ? getIndependentCheckStates(items, loads, checkedSet)
          : getCheckStates(items, loads, checkedSet),
    [checkable, isIndependent, items, loads, checkedSet],
  );
  // The value as the tree shows it - in a cascade the parents of checked
  // children included, independently exactly the checked ids
  const checkedValue = useMemo(
    () =>
      checkStates && !isIndependent
        ? getCheckedIds(checkStates, checkedSet)
        : checkedIds,
    [checkStates, isIndependent, checkedSet, checkedIds],
  );

  // Filter - the user may collapse parts of the filtered tree, until the
  // filter changes
  const term = filter?.trim() ?? "";
  const filterResult = useMemo(
    () => (term ? filterTree(items, loads, term) : null),
    [items, loads, term],
  );
  const [filterCollapsed, setFilterCollapsed] = useState({
    ids: EMPTY_IDS,
    term,
  });
  const collapsedInFilter =
    filterCollapsed.term === term ? filterCollapsed.ids : EMPTY_IDS;

  const canLoad = !!loadChildren;
  const rows = useMemo(
    () =>
      getVisibleRows(items, {
        canLoad,
        expanded: expandedSet,
        filterCollapsed: collapsedInFilter,
        loads,
        shown: filterResult?.shown,
      }),
    [items, canLoad, expandedSet, collapsedInFilter, loads, filterResult],
  );
  const rowIndexById = useMemo(
    () => new Map(rows.map((row, rowIndex) => [row.id, rowIndex])),
    [rows],
  );

  // Virtualized: the rows in view of the tree, which scrolls itself
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");
  const rowHeight = rowHeightProp ?? (isCoarsePointer ? 40 : 32);
  const flatRows = useMemo(
    () => (virtualized ? getFlatRows(rows) : null),
    [virtualized, rows],
  );
  const { containerRef, range, scrollToIndex } = useVirtualRange({
    count: flatRows?.entries.length ?? 0,
    enabled: virtualized,
    overscan,
    rowHeight,
  });

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
  // A row the keys moved to that is not rendered yet (out of view of a
  // virtualized tree) - it takes the focus once it is
  const pendingFocusRef = useRef<TreeItemId | null>(null);

  const treeRefCallback = useCallback(
    (element: HTMLUListElement | null) => {
      treeRef.current = element;
      const detachRef = attachRef(ref, element);
      const detachContainer = containerRef(element);
      const detachFieldset = fieldsetRef(element);

      // The pointer left the tree - a native listener: the leave events of
      // React are made of `pointerout`, which also comes when the pointer
      // moves onto the controls of a row
      const handlePointerLeave = () => setHoveredId(null);
      element?.addEventListener("pointerleave", handlePointerLeave);

      return () => {
        element?.removeEventListener("pointerleave", handlePointerLeave);
        detachFieldset?.();
        detachContainer?.();
        treeRef.current = null;
        detachRef();
      };
    },
    [containerRef, fieldsetRef, ref],
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

  // A virtualized tree without a height grows to all its rows
  useEffect(() => {
    const tree = treeRef.current;
    if (virtualized && tree && tree.clientHeight > window.innerHeight) {
      logger.warn(
        'TreeView: a virtualized tree scrolls itself - give it a height (e.g. `className="h-96"`); without one it grows to the height of all its rows and renders every one of them.',
      );
    }
  }, [virtualized]);

  /** The element of the row of the item `id` - `null` while not rendered. */
  const getRowElement = (id: TreeItemId) => {
    const tree = treeRef.current;
    const element = tree
      ? getElementByIdAt(tree, `${baseId}-${encodeId(id)}`)
      : null;
    return element && tree?.contains(element) ? element : null;
  };

  /** The index of the row an element of the tree is the tree item of. */
  const rowIndexOfElement = (element: Element) => {
    const prefix = `${baseId}-`;
    return element.id.startsWith(prefix)
      ? getRowKeyIndex(rows).get(element.id.slice(prefix.length))
      : undefined;
  };

  /**
   * Scrolls the row at `rowIndex` into view - a virtualized one also renders
   * it. With `status`, the row under it saying its children load too.
   */
  const revealRow = (rowIndex: number, status = false) => {
    const row = rows[rowIndex];
    if (!row) return;
    if (flatRows) {
      scrollToIndex(flatRows.entryOfRow[rowIndex] + (status ? 1 : 0));
      return;
    }
    const element = getRowElement(row.id);
    // Its `<li>` holds its group too - with the status row in it
    (status ? element?.parentElement : element)?.scrollIntoView({
      block: "nearest",
    });
  };

  /**
   * Focuses the row at `rowIndex` - a row of a virtualized tree out of view
   * is scrolled to and focused once it is rendered.
   */
  const focusRow = (rowIndex: number | undefined) => {
    if (rowIndex === undefined) return;
    const row = rows[rowIndex];
    if (!row) return;

    if (virtualized) revealRow(rowIndex);
    const element = getRowElement(row.id);
    if (element) {
      element.focus({ preventScroll: virtualized });
      return;
    }

    // The tab stop is always rendered - the row is once it is the tab stop
    pendingFocusRef.current = row.id;
    setFocusedId(row.id);
  };

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

    // The focused item went away (collapsed, moved or removed from
    // outside) - the focus stays in the tree instead of dropping to the page
    const tree = treeRef.current;
    if (!hasFocus || !tree) return;

    const active = getActiveElement(tree.ownerDocument);
    if (active && active !== tree.ownerDocument.body) return;

    const row = rows[focusIndex];
    if (!row) return;
    const element = getElementByIdAt(tree, `${baseId}-${encodeId(row.id)}`);
    if (element && tree.contains(element)) {
      element.focus({ preventScroll: virtualized });
    } else {
      // Not rendered in the view of a virtualized tree - once it is
      pendingFocusRef.current = row.id;
    }
    if (virtualized && flatRows) scrollToIndex(flatRows.entryOfRow[focusIndex]);
  }, [
    baseId,
    flatRows,
    focusedId,
    hasFocus,
    index,
    rows,
    scrollToIndex,
    tabStopIndex,
    virtualized,
  ]);

  // A row the keys moved to, rendered now
  useLayoutEffect(() => {
    const pending = pendingFocusRef.current;
    const tree = treeRef.current;
    if (pending === null || !tree) return;

    const element = getElementByIdAt(tree, `${baseId}-${encodeId(pending)}`);
    if (element && tree.contains(element)) {
      pendingFocusRef.current = null;
      element.focus({ preventScroll: true });
    }
  });

  const changeExpanded = (next: TreeItemId[]) => {
    if (!isExpandedControlled) setInternalExpanded(next);
    onExpandedChange?.(next as T["id"][]);
  };

  // The hidden inputs hold the value before the change handlers, which may
  // submit the form. A controlled parent can only render it after them.
  const changeSelected = (next: TreeItemId[]) => {
    if (!isSelectedControlled) flushSync(() => setInternalSelected(next));
    onSelectedChange?.(next as T["id"][]);
  };

  const changeChecked = (next: TreeItemId[]) => {
    if (!isCheckedControlled) flushSync(() => setInternalChecked(next));
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

  /**
   * Expands the item `id` - also one without children yet, which items are
   * being moved into.
   */
  const revealChildren = (id: TreeItemId) => {
    if (filterResult) {
      if (!collapsedInFilter.has(id)) return;
      const next = new Set(collapsedInFilter);
      next.delete(id);
      setFilterCollapsed({ ids: next, term });
      return;
    }
    if (!expandedSet.has(id)) changeExpanded([...expandedIds, id]);
  };

  // Moving items - by the pointer, or chosen with the keys
  const drag = useTreeDrag<T>({
    canDrag,
    canDrop,
    canLoad: !!loadChildren,
    enabled: !!onMove && !disabled,
    expandRow: (row, expand) => setRowsExpanded([row], expand),
    index,
    items,
    loads,
    onMove,
    revealChildren,
    revealRow,
    rowIndexById,
    rowIndexOfElement,
    rows,
    selected: selectionMode === "multiple" ? selectedSet : null,
    treeRef,
  });
  const dropIndicator = drag.place
    ? getPlaceRow(drag.place, rows, rowIndexById)
    : null;

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

    const next = isIndependent
      ? toggleIndependentCheck(row.id, checkedIds, index)
      : toggleCheck(row.id, {
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

  /** Follows the link of a row, keeping the keys held during a pointer click. */
  const followLink = (
    rowElement: HTMLElement,
    event?: React.MouseEvent<HTMLElement>,
  ) => {
    const link = rowElement.querySelector<HTMLElement>(`[${LINK_ATTRIBUTE}]`);
    if (!event) {
      link?.click();
      return;
    }

    link?.dispatchEvent(
      new MouseEvent("click", {
        altKey: event.altKey,
        bubbles: true,
        button: event.button,
        cancelable: true,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      }),
    );
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
        followLink(event.currentTarget, event);
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

    // Ctrl / ⌘ + X, and the keys of a move being chosen
    if (drag.onKeyDown(event, row)) return;

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
    const rowIndex = rowElement ? rowIndexOfElement(rowElement) : undefined;
    setHoveredId(rowIndex === undefined ? null : rows[rowIndex].id);
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
    onPointerDown: drag.onPointerDown,
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
    onPointerDown: (event, id) => handlersRef.current.onPointerDown(event, id),
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
          style={style}
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
    dropIndicator,
    handlers: rowHandlers,
    hasFocus,
    hoveredId,
    Link,
    loadError: messages.treeView.loadError,
    loading: messages.common.loading,
    matches: filterResult?.matches,
    movable: !!onMove && !disabled,
    movedIds: drag.movedIds,
    movingDescriptionId,
    renderActions,
    renderLabel,
    retry: messages.treeView.retry,
    rowHeight: virtualized ? rowHeight : undefined,
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
        className={cn(
          "text-sm",
          virtualized && "overflow-y-auto",
          // The grabbing hand over the whole tree while an item is dragged
          drag.mode === "pointer" && "cursor-grabbing **:cursor-grabbing",
          className,
        )}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setHasFocus(false);
          }
          drag.onBlur(event);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setHasFocus(true);
          onFocus?.(event);
        }}
        onPointerOver={renderActions ? handlePointerOver : undefined}
        ref={treeRefCallback}
        role="tree"
        // Rows swapped for spacers as a virtualized tree scrolls - the
        // browser must not move the scroll to keep them in place
        style={virtualized ? { overflowAnchor: "none", ...style } : style}
      >
        {flatRows
          ? renderFlatRows(context, flatRows, range)
          : renderRows(context, 0, rows.length)}
      </ul>
      {onMove && (
        <>
          {/* The moves chosen with the keys and the drops, told */}
          <div className="sr-only" role="status">
            {drag.announcement}
          </div>
          {drag.movedIds.size > 0 && (
            <span hidden id={movingDescriptionId}>
              {messages.treeView.beingMoved}
            </span>
          )}
          {drag.mode === "pointer" && (
            <DragBadge attach={drag.attachBadge} text={drag.badgeText} />
          )}
        </>
      )}
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
  /** Where the dragged items would land - the row that shows it. */
  dropIndicator: ReturnType<typeof getPlaceRow>;
  handlers: RowHandlers;
  hasFocus: boolean;
  hoveredId: TreeItemId | null;
  Link: LinkComponent;
  loadError: string;
  loading: string;
  matches: ReadonlyMap<TreeItemId, [number, number][]> | undefined;
  movable: boolean;
  movedIds: ReadonlySet<TreeItemId>;
  movingDescriptionId: string;
  renderActions: TreeViewProps<T>["renderActions"];
  renderLabel: TreeViewProps<T>["renderLabel"];
  retry: string;
  /** The height of every row - of a virtualized tree. */
  rowHeight: number | undefined;
  rows: TreeRow<T>[];
  selectedSet: ReadonlySet<TreeItemId>;
  selectionMode: "none" | "single" | "multiple";
  tabStopIndex: number;
}

/** The row of the item at `rowIndex`. */
function renderRow<T extends TreeItem>(
  context: RenderContext<T>,
  rowIndex: number,
  groupId: string | undefined,
) {
  const { dropIndicator, rows, selectionMode } = context;
  const row = rows[rowIndex];
  const domId = `${context.baseId}-${encodeId(row.id)}`;
  const isDisabled = context.disabledSet.has(row.id);
  const isSelected = context.selectedSet.has(row.id);
  const isMoving = context.movedIds.has(row.id);
  const hasIndicator =
    dropIndicator?.rowIndex === rowIndex && !dropIndicator.status;

  return (
    <MemoTreeRowView
      checkable={context.checkable}
      checked={context.checkStates?.get(row.id)}
      current={row.id === context.currentId}
      disabled={isDisabled}
      domId={domId}
      dropEdge={hasIndicator ? dropIndicator.edge : undefined}
      dropLevel={hasIndicator ? dropIndicator.level : undefined}
      expandable={row.expandable}
      expanded={row.expanded}
      groupId={groupId}
      handlers={context.handlers}
      height={context.rowHeight}
      item={row.item}
      level={row.level}
      Link={context.Link}
      loading={row.loadStatus === "loading"}
      matches={context.matches?.get(row.id)}
      movable={context.movable}
      movingDescriptionId={isMoving ? context.movingDescriptionId : undefined}
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
  );
}

/**
 * The level of the line at the bottom of the status row of the row at
 * `rowIndex` - while dragged items would land after it.
 */
function getStatusDropLevel<T extends TreeItem>(
  { dropIndicator }: RenderContext<T>,
  rowIndex: number,
) {
  return dropIndicator?.status && dropIndicator.rowIndex === rowIndex
    ? dropIndicator.level
    : undefined;
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
  const { rows } = context;
  const nodes: React.ReactNode[] = [];

  for (let rowIndex = start; rowIndex < end; rowIndex = rows[rowIndex].end) {
    const row = rows[rowIndex];
    const key = encodeId(row.id);
    const domId = `${context.baseId}-${key}`;
    const groupId = `${domId}-group`;

    nodes.push(
      <li key={key} role="none">
        {renderRow(context, rowIndex, row.expanded ? groupId : undefined)}
        {row.expanded && (
          <ul aria-labelledby={`${domId}-label`} id={groupId} role="group">
            {renderRows(context, rowIndex + 1, row.end)}
            {row.loadStatus && (
              <li role="none">
                <StatusRow
                  dropLevel={getStatusDropLevel(context, rowIndex)}
                  kind={row.loadStatus}
                  level={row.level + 1}
                  loadError={context.loadError}
                  loading={context.loading}
                  onRetry={() => context.handlers.onRetry(row.id)}
                  retry={context.retry}
                />
              </li>
            )}
          </ul>
        )}
      </li>,
    );
  }

  return nodes;
}

/**
 * The rows of a virtualized tree in `range` as one flat list - with the
 * tab stop out of it, and spacers holding the room of the rows left out.
 */
function renderFlatRows<T extends TreeItem>(
  context: RenderContext<T>,
  { entries, entryOfRow }: ReturnType<typeof getFlatRows>,
  range: { end: number; start: number },
): React.ReactNode[] {
  const rowHeight = context.rowHeight ?? 32;
  const kept =
    context.tabStopIndex >= 0 ? entryOfRow[context.tabStopIndex] : -1;

  const shown: number[] = [];
  if (kept !== -1 && kept < range.start) shown.push(kept);
  for (let entry = range.start; entry < range.end; entry++) shown.push(entry);
  if (kept !== -1 && kept >= range.end) shown.push(kept);

  const nodes: React.ReactNode[] = [];
  const spacer = (from: number, to: number) => (
    <li
      aria-hidden="true"
      key={`gap-${from}`}
      role="none"
      style={{ height: (to - from) * rowHeight }}
    />
  );

  let next = 0;
  for (const entryIndex of shown) {
    if (entryIndex > next) nodes.push(spacer(next, entryIndex));

    const { kind, rowIndex } = entries[entryIndex];
    const row = context.rows[rowIndex];
    const key = encodeId(row.id);

    nodes.push(
      kind === "item" ? (
        <li key={key} role="none">
          {renderRow(context, rowIndex, undefined)}
        </li>
      ) : (
        <li key={`${key}-status`} role="none">
          <StatusRow
            dropLevel={getStatusDropLevel(context, rowIndex)}
            height={rowHeight}
            kind={kind}
            level={row.level + 1}
            loadError={context.loadError}
            loading={context.loading}
            onRetry={() => context.handlers.onRetry(row.id)}
            retry={context.retry}
          />
        </li>
      ),
    );
    next = entryIndex + 1;
  }
  if (next < entries.length) nodes.push(spacer(next, entries.length));

  return nodes;
}

interface DragBadgeProps {
  /** The ref callback that places it beside the pointer. */
  attach: (element: HTMLElement | null) => void;
  text: string;
}

/**
 * What is being dragged, beside the pointer - in the page, by the
 * coordinates of the pointer in the viewport (no container clips it). Only
 * while the pointer drags, in the browser.
 */
function DragBadge({ attach, text }: DragBadgeProps) {
  const getPortalContainer = usePortalContainer();

  return createPortal(
    <div
      aria-hidden="true"
      // At the top left of the viewport, moved to the pointer by its
      // coordinates - physical ones in any writing direction
      className="pointer-events-none fixed top-0 left-0 z-50 max-w-60 truncate rounded-md bg-primary-600 px-2 py-1 text-xs font-medium text-white shadow-lg dark:shadow-black/40"
      ref={attach}
    >
      {text}
    </div>,
    getPortalContainer(),
  );
}

interface DropLineProps {
  edge: "bottom" | "top";
  /** The level it is indented to. */
  level: number;
}

/** The line where dragged items would land - at the level they would land at. */
function DropLine({ edge, level }: DropLineProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-e-0 z-10 h-0.5 rounded-full bg-primary-500 dark:bg-primary-400 forced-colors:bg-[Highlight]",
        "before:absolute before:-inset-s-1 before:-top-0.75 before:size-2 before:rounded-full before:border-2 before:border-primary-500 before:bg-surface dark:before:border-primary-400 dark:before:bg-surface-dark forced-colors:before:border-[Highlight]",
        edge === "top" ? "-top-px" : "-bottom-px",
      )}
      style={{ insetInlineStart: indent(level) }}
    />
  );
}

interface StatusRowProps {
  /**
   * The level of the line at its bottom, where dragged items would land -
   * after the item whose children it stands for.
   */
  dropLevel?: number;
  /** Fixed height, in pixels - in a virtualized tree. */
  height?: number;
  kind: "error" | "loading";
  /** The level of the children it stands for. */
  level: number;
  loadError: string;
  loading: string;
  onRetry: () => void;
  retry: string;
}

/** The row in place of children that are loading, or failed to load. */
function StatusRow({
  dropLevel,
  height,
  kind,
  level,
  loadError,
  loading,
  onRetry,
  retry,
}: StatusRowProps) {
  const style = { height, paddingInlineStart: indent(level) };
  const dropEdge = dropLevel === undefined ? undefined : "bottom";
  const dropLine = dropLevel !== undefined && (
    <DropLine edge="bottom" level={dropLevel} />
  );

  if (kind === "loading") {
    return (
      <div
        className={cn(
          "relative flex items-center gap-1.5 py-1 pe-2 text-neutral-500 dark:text-neutral-400",
          height === undefined && "min-h-8",
        )}
        data-drop-edge={dropEdge}
        role="status"
        style={style}
      >
        {/* A picture - the text beside it says the same */}
        <Spinner
          aria-hidden="true"
          className="size-5"
          label=""
          role="none"
          size="sm"
        />
        <span className="truncate">{loading}</span>
        {dropLine}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-x-2 gap-y-1 py-1 pe-2",
        // Clipped across only - the line below it shows
        height === undefined ? "min-h-8 flex-wrap" : "overflow-x-clip",
      )}
      data-drop-edge={dropEdge}
      style={style}
    >
      <span
        className={cn(
          "text-danger-700 dark:text-danger-400",
          height !== undefined && "truncate",
        )}
        role="alert"
      >
        {loadError}
      </span>
      <button
        className="cui-link shrink-0 font-medium text-primary-600 hover:underline dark:text-primary-400"
        onClick={onRetry}
        type="button"
      >
        {retry}
      </button>
      {dropLine}
    </div>
  );
}

interface TreeRowViewProps<T extends TreeItem> {
  checkable: boolean;
  checked?: CheckState;
  /** The item of the current page. */
  current: boolean;
  disabled: boolean;
  domId: string;
  /**
   * Where dragged items would land, shown on this row: a line at its top
   * or bottom edge, or the row itself (they go inside).
   */
  dropEdge?: "bottom" | "inside" | "top";
  /** The level the line of `dropEdge` is indented to. */
  dropLevel?: number;
  expandable: boolean;
  expanded: boolean;
  /** Id of the group of the children, while it is shown. */
  groupId?: string;
  handlers: RowHandlers;
  /** Fixed height, in pixels - a row of a virtualized tree, on one line. */
  height?: number;
  item: T;
  level: number;
  Link: LinkComponent;
  /** The children are loading. */
  loading: boolean;
  matches?: [number, number][];
  /** A press may drag the item - the tree has `onMove`. */
  movable: boolean;
  /** Id of the text telling that the item is being moved - while it is. */
  movingDescriptionId?: string;
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
 * stable props: moving the focus renders only the rows it moves between,
 * also without the React Compiler.
 */
function TreeRowView<T extends TreeItem>({
  checkable,
  checked,
  current,
  disabled,
  domId,
  dropEdge,
  dropLevel,
  expandable,
  expanded,
  groupId,
  handlers,
  height,
  item,
  level,
  Link,
  loading,
  matches,
  movable,
  movingDescriptionId,
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
  const isFixed = height !== undefined;

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
      <span
        className={cn("min-w-0", isFixed ? "truncate" : "wrap-break-word")}
        id={labelId}
      >
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
      aria-describedby={movingDescriptionId}
      aria-disabled={disabled || undefined}
      aria-expanded={expandable ? expanded : undefined}
      aria-labelledby={labelId}
      aria-level={level}
      aria-owns={groupId}
      aria-posinset={posinset}
      aria-selected={selectable ? selected : undefined}
      aria-setsize={setsize}
      className={cn(
        "relative flex items-center gap-1.5 rounded-md py-1 pe-2 select-none",
        !isFixed && "min-h-8 pointer-coarse:min-h-10",
        // Forced colors drop the ring - the outline shows the focus then
        "focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-hidden focus-visible:ring-inset",
        disabled ? "cursor-default" : "cursor-pointer",
        selected || current
          ? [
              "bg-primary-50 text-primary-800 dark:bg-primary-950/60 dark:text-primary-200",
              // A background of a system color is kept in forced colors -
              // with its text color on everything in the row
              "forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:**:text-[HighlightText]",
            ]
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        current && "font-medium",
        // Resting a finger on it picks it up - not the menu of the browser
        movable && "[-webkit-touch-callout:none]",
        movingDescriptionId &&
          "opacity-50 transition-opacity motion-reduce:transition-none",
        dropEdge === "inside" &&
          "bg-primary-50 ring-2 ring-primary-500 ring-inset dark:bg-primary-950/60 dark:ring-primary-400 forced-colors:outline-2 forced-colors:-outline-offset-2 forced-colors:outline-[Highlight]",
      )}
      data-current={current ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      // Where dragged items would land, shown on this row - for styling
      data-drop-edge={dropEdge}
      data-selected={selectable && selected ? "" : undefined}
      data-state={expandable ? (expanded ? "open" : "closed") : undefined}
      id={domId}
      onClick={(event) => handlers.onClick(event, item.id)}
      onDoubleClick={(event) => handlers.onDoubleClick(event, item.id)}
      // The press drags the item, not its link or icon as the browser would
      onDragStart={movable ? (event) => event.preventDefault() : undefined}
      onFocus={(event) => handlers.onFocus(event, item.id)}
      onKeyDown={(event) => handlers.onKeyDown(event, item.id)}
      onPointerDown={
        movable ? (event) => handlers.onPointerDown(event, item.id) : undefined
      }
      role="treeitem"
      style={{ height, paddingInlineStart: indent(level) }}
      tabIndex={tabStop ? 0 : -1}
    >
      {/* The line where dragged items would land - at the level they would
          land at */}
      {(dropEdge === "top" || dropEdge === "bottom") && (
        <DropLine edge={dropEdge} level={dropLevel ?? level} />
      )}

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

// Preserve the item's generic type across React.memo's component wrapper.
const MemoTreeRowView = /* @__PURE__ */ memo(TreeRowView) as typeof TreeRowView;

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
