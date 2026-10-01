import { ChevronDown, X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import Chip, { type ChipSize } from "../chip";
import cn, { joinTokens } from "../../utils/cn";
import FormDescription from "../form-description";
import FormError from "../form-error";
import Popover from "../popover";
import TreeView from "../tree-view";
import { getActiveElement, getNextTabStop } from "../overlay-stack";
import { getTabbableElements } from "../../utils/tabbable";
import { formatPlural, toIntlLocale } from "../../i18n/format";
import {
  attachRef,
  isAriaInvalid,
  useFieldsetDisabled,
  useFormReset,
} from "../../hooks/use-form-control";
import { useLocale, useMessages } from "../../providers/ui-context";
import {
  getAncestors,
  getCheckedIds,
  getCheckStates,
  indexTree,
  toggleCheck,
  TYPEAHEAD_TIMEOUT,
  type LoadState,
} from "../tree-view/tree-model";
import type { TreeItem, TreeItemId, TreeItemState } from "../tree-view/types";
import { encodeId } from "../tree-view/dom";
import RequiredMark from "../required-mark";

// The heights, paddings and font sizes of `Input`
const dimStyles = {
  xs: "px-1 py-0 text-sm",
  sm: "px-1 py-0.5 text-sm",
  md: "px-2 py-1 text-base",
  lg: "px-3 py-2 text-lg",
};
const iconSizes = { xs: 14, sm: 14, md: 16, lg: 18 };
// Chips that fit into the line of the field
const chipSizes: Record<keyof typeof dimStyles, ChipSize> = {
  xs: "sm",
  sm: "sm",
  md: "sm",
  lg: "md",
};

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

interface BaseTreeSelectProps<T extends TreeItem> extends Omit<
  React.ComponentProps<"div">,
  "children" | "defaultValue" | "onChange" | "ref"
> {
  /**
   * `multiple` only: how the checkboxes depend on each other - `cascade`
   * checks the descendants of a checked item, and a parent whose children
   * are all checked shows as one chip; `independent` checks each item on
   * its own, the value is exactly the checked items. See `TreeView`.
   */
  checkMode?: "cascade" | "independent";
  /**
   * Classes of the outer wrapper around the label, the field and the
   * messages - not of the field itself.
   */
  className?: string;
  /**
   * Adds a button that clears the value while there is one - not in a
   * disabled or read-only field.
   */
  clearable?: boolean;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field - the sizes of `Input`. */
  dim?: "xs" | "sm" | "md" | "lg";
  /**
   * Disables the field - like a disabled native one, it is then neither
   * focusable, submitted nor validated. A disabled `<fieldset>` around it
   * disables it too.
   */
  disabled?: boolean;
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the hidden inputs (the value and `required`) belong
   * to, when the field is not inside it - like the `form` attribute of a
   * native field. A reset of that form resets the field too.
   */
  form?: string;
  /**
   * The items of the tree - at the top level, with their `children`. The
   * label of a value whose item is not loaded yet (under an item whose
   * children `loadChildren` has not brought) shows as its id.
   */
  items: T[];
  /** The label above the field - it names the field and the tree. */
  label?: React.ReactNode;
  /**
   * Loads the children of an item with `hasChildren` when it is first
   * expanded - see `TreeView`. The loaded children are kept while the
   * field is in the page, also with the popup closed.
   */
  loadChildren?: (item: T, options: { signal: AbortSignal }) => Promise<T[]>;
  /**
   * `multiple` only: the most chips shown - the others are one "+3 more"
   * chip. All of them by default.
   */
  maxChips?: number;
  /**
   * Picks several items with checkboxes - `value`, `defaultValue` and
   * `onChange` then work with arrays, and the field shows them as chips.
   */
  multiple?: boolean;
  /**
   * Submits the value in hidden inputs of this name, so the field works in
   * a plain `<form>` / `FormData` - one input per item of a `multiple`
   * field (with `checkMode="cascade"` parents whose children are all
   * checked included), and an empty one for a single field without a
   * value.
   */
  name?: string;
  /** Shown in the empty field. */
  placeholder?: string;
  /**
   * The value shows and can be focused, but not changed - no popup opens
   * and no chip can be removed. It is submitted with the form.
   */
  readOnly?: boolean;
  /**
   * The combobox - the element that takes the focus - e.g. for `focus()`;
   * React Hook Form focuses it at an error. The other attributes of a
   * `<div>` (`data-*`, `style`, event handlers) go to the wrapper, as
   * `className` does.
   */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Content of an item in the tree instead of its label - see `TreeView`.
   * The field shows the label.
   */
  renderLabel?: (item: T, state: TreeItemState) => React.ReactNode;
  /** A value must be picked before the form can be submitted. */
  required?: boolean;
  /**
   * A search field at the top of the popup, filtering the tree by the
   * labels - ignoring case and diacritics. Typing a letter on the closed
   * field opens it with the letter.
   */
  searchable?: boolean;
  /**
   * Single field: shows the labels of the ancestors of the selected item
   * before its own - "Electronics / Computers / Laptops".
   */
  showPath?: boolean;
  /**
   * Renders only the rows of the tree in view - for trees of thousands of
   * items. See `TreeView`.
   */
  virtualized?: boolean;
}

/** The value of a field without `multiple` - one item. */
interface SingleTreeSelectProps<T extends TreeItem> {
  /**
   * Initial value of an uncontrolled field - `null` for none; an array with
   * `multiple`.
   */
  defaultValue?: T["id"] | null;
  multiple?: false;
  /**
   * Called with the id of the picked item and the item: `(value, item)`,
   * both `null` once the value is cleared - or `(values, items)` with
   * `multiple`, where `items[i]` belongs to `values[i]`. An item is `null`
   * for an id not in the tree.
   */
  onChange?: (value: T["id"] | null, item: T | null) => void;
  /**
   * Value of a controlled field - `null` for none; an array with
   * `multiple`.
   */
  value?: T["id"] | null;
}

/** The value of a field with `multiple` - the checked items. */
interface MultipleTreeSelectProps<T extends TreeItem> {
  /** Initial values of an uncontrolled field. */
  defaultValue?: T["id"][];
  multiple: true;
  /**
   * Called with the ids of the checked items and the items - `items[i]`
   * belongs to `values[i]`, `null` for an id not in the tree.
   */
  onChange?: (values: T["id"][], items: (T | null)[]) => void;
  /** Values of a controlled field. */
  value?: T["id"][];
}

export type TreeSelectProps<T extends TreeItem = TreeItem> =
  BaseTreeSelectProps<T> &
    (SingleTreeSelectProps<T> | MultipleTreeSelectProps<T>);

const toValues = (
  value: TreeItemId[] | TreeItemId | null | undefined,
): TreeItemId[] =>
  value === null || value === undefined
    ? []
    : Array.isArray(value)
      ? value
      : [value];

/**
 * `list` with the children `loadChildren` brought given to their parents -
 * the tree of the popup, which comes and goes, finds them there instead of
 * loading them again. The items themselves where nothing changes.
 */
function withLoadedChildren<T extends TreeItem>(
  list: readonly T[],
  loaded: ReadonlyMap<TreeItemId, T[]>,
  seen: Set<TreeItemId>,
): T[] {
  let changed = false;

  const result = list.map((item) => {
    // Also what stops an item nested in itself
    if (seen.has(item.id)) return item;
    seen.add(item.id);

    const own = item.children as T[] | undefined;
    const children = own ?? loaded.get(item.id);
    if (!children) return item;

    const next = withLoadedChildren(children, loaded, seen);
    if (next === own) return item;
    changed = true;
    return { ...item, children: next };
  });

  return changed ? result : (list as T[]);
}

/** Scrolls `container` so that `element` in it shows - the page stays. */
function scrollIntoContainer(element: Element, container: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const top = rect.top - container.getBoundingClientRect().top;
  if (top < 0 || top + rect.height > container.clientHeight) {
    container.scrollTop += top - (container.clientHeight - rect.height) / 2;
  }
}

/**
 * A select of an item of a tree - categories, departments, folders: a
 * field that opens a `TreeView` in a popup, with a search field. Single,
 * or with `multiple` several items with checkboxes, shown as chips. It
 * works in a native form like the other fields (`name`, `required`, the
 * reset). The keyboard follows the ARIA combobox pattern: ↓, Enter or
 * Space open the popup and move into it, Escape closes it and Tab moves on.
 */
export default function TreeSelect<T extends TreeItem>({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-required": ariaRequired,
  checkMode = "cascade",
  className,
  clearable = true,
  defaultValue,
  description,
  dim = "md",
  disabled: disabledProp = false,
  error,
  form,
  id,
  items,
  label,
  loadChildren,
  maxChips,
  multiple = false,
  name,
  onBlur,
  onChange,
  onFocus,
  placeholder,
  readOnly = false,
  ref,
  renderLabel,
  required = false,
  searchable = true,
  showPath = false,
  value,
  virtualized = false,
  ...props
}: TreeSelectProps<T>) {
  const locale = useLocale();
  const messages = useMessages();

  // The combobox is no native field - a disabled fieldset around it leaves
  // it alone unless told
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;
  const canChange = !disabled && !readOnly;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Kept while the popup is closed - it opens as it was left
  const [expanded, setExpanded] = useState<TreeItemId[]>([]);
  // The children `loadChildren` brought - the tree of the popup unmounts
  const [loaded, setLoaded] = useState<ReadonlyMap<TreeItemId, T[]>>(
    () => new Map(),
  );

  // A field that turns disabled or read-only closes its popup
  if (open && !canChange) setOpen(false);

  // What the user picked in an uncontrolled field. Until then, and again
  // after a reset, it shows `defaultValue` - also one that arrived late.
  const [pickedValues, setPickedValues] = useState<TreeItemId[]>();
  const isControlled = value !== undefined;
  const values = isControlled
    ? toValues(value)
    : (pickedValues ?? toValues(defaultValue));
  const valueSet = new Set(values);
  // The props are a union by `multiple` - `commit` passes what the mode takes
  const reportChange = onChange as
    ((value: unknown, item: unknown) => void) | undefined;

  // Every item known - also those loaded - and the tree of the popup
  const loads = new Map<TreeItemId, LoadState<T>>(
    [...loaded].map(([itemId, children]) => [
      itemId,
      { children, status: "loaded" },
    ]),
  );
  const index = indexTree(items, loads, false);
  const treeItems = withLoadedChildren(items, loaded, new Set());

  const loadAndKeep = loadChildren
    ? (item: T, options: { signal: AbortSignal }) =>
        loadChildren(index.byId.get(item.id) ?? item, options).then(
          (children) => {
            const list = Array.isArray(children) ? children : [];
            // A loader may finish after the popup closed and aborted it.
            // Its result must not replace children from a later opening.
            if (!options.signal.aborted) {
              setLoaded((previous) => new Map(previous).set(item.id, list));
            }
            return list;
          },
        )
    : undefined;

  const labelOf = (itemId: TreeItemId) =>
    index.byId.get(itemId)?.label ?? String(itemId);

  // A multiple cascade: the value as the tree has it (fully checked
  // parents included, in tree order), and as chips the topmost fully
  // checked items - a checked parent stands for its children
  const isCascade = multiple && checkMode === "cascade";
  const checkStates = isCascade ? getCheckStates(items, loads, valueSet) : null;
  const normalizedValues = checkStates
    ? getCheckedIds(checkStates, valueSet)
    : values;
  const chipIds = !multiple
    ? []
    : checkStates
      ? normalizedValues.filter((itemId) => {
          const parentId = index.parentOf.get(itemId);
          return (
            parentId === undefined ||
            parentId === null ||
            checkStates.get(parentId) !== true
          );
        })
      : values;
  const shownChips =
    maxChips === undefined ? chipIds : chipIds.slice(0, Math.max(0, maxChips));
  const hiddenChipCount = chipIds.length - shownChips.length;
  const moreText =
    hiddenChipCount > 0
      ? formatPlural(locale.code, messages.treeSelect.more, hiddenChipCount)
      : "";

  const generatedId = useId();
  const comboboxId = id ?? generatedId;
  const labelId = `${comboboxId}-label`;
  const treeId = `${generatedId}-tree`;
  const errorId = error ? `${comboboxId}-error` : undefined;
  const descriptionId = description ? `${comboboxId}-description` : undefined;

  const rootRef = useRef<HTMLDivElement | null>(null);
  // The field the chips, the combobox and the buttons are in
  const fieldRef = useRef<HTMLDivElement>(null);
  const comboboxRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Where the focus goes as the popup opens
  const focusOnOpenRef = useRef<"search" | "tree" | null>(null);
  // The pointer the field was last pressed with - a finger opens the popup
  // without the on-screen keyboard of the search field
  const pointerTypeRef = useRef("mouse");
  // When a letter was last typed in the tree - for its typeahead search
  const typedAtRef = useRef(-Infinity);

  // `form.reset()` brings back the `defaultValue` of an uncontrolled field
  const formResetRef = useFormReset(() => {
    setSearch("");
    if (!isControlled) setPickedValues(undefined);
  }, form);

  const comboboxCallbackRef = useCallback(
    (element: HTMLDivElement | null) => {
      comboboxRef.current = element;
      const detachReset = formResetRef(element);
      const detachFieldset = fieldsetRef(element);
      const detachRef = attachRef(ref, element);

      return () => {
        comboboxRef.current = null;
        detachRef();
        detachReset?.();
        detachFieldset?.();
      };
    },
    [fieldsetRef, formResetRef, ref],
  );

  const commit = (next: TreeItemId[]) => {
    if (!isControlled) setPickedValues(next);

    const picked = next.map((itemId) => index.byId.get(itemId) ?? null);
    if (multiple) reportChange?.(next, picked);
    else reportChange?.(next[0] ?? null, picked[0] ?? null);
  };

  /** Puts the focus into the open popup - on the search field or the tree. */
  const focusPopup = (target: "search" | "tree") => {
    const panel = panelRef.current;
    const element =
      target === "search" && searchRef.current
        ? searchRef.current
        : panel?.querySelector<HTMLElement>("[role='treeitem'][tabindex='0']");
    element?.focus({ preventScroll: true });
  };

  const openPopup = (focus: "search" | "tree" | null) => {
    if (!canChange) return;
    if (open) {
      if (focus) focusPopup(focus);
      return;
    }

    // The tree opens on the selection - its ancestors expand
    const shown = multiple ? chipIds : values;
    const hidden = [
      ...new Set(
        shown.flatMap((itemId) => getAncestors(index.parentOf, itemId)),
      ),
    ].filter((ancestor) => !expanded.includes(ancestor));
    if (hidden.length > 0) setExpanded([...expanded, ...hidden]);

    focusOnOpenRef.current = focus;
    setOpen(true);
  };

  const closePopup = () => {
    setOpen(false);
    setSearch("");
    // Back to the field from the popup - not when the focus has moved on
    const panel = panelRef.current;
    if (
      panel?.contains(
        getActiveElement(panel.getRootNode() as Document | ShadowRoot),
      )
    ) {
      comboboxRef.current?.focus();
    }
  };

  // The panel as it mounts: the focus goes into it, and the selected item
  // shows in the tree. One function for good - called again, it would
  // scroll the tree back to the selection.
  const [attachPanel] = useState(() => (element: HTMLDivElement | null) => {
    panelRef.current = element;
    if (!element) return;

    const tree = element.querySelector<HTMLElement>("[role='tree']");
    const tabStop = element.querySelector<HTMLElement>(
      "[role='treeitem'][tabindex='0']",
    );
    if (tree && tabStop) scrollIntoContainer(tabStop, tree);

    const target = focusOnOpenRef.current;
    focusOnOpenRef.current = null;
    if (target === "search") searchRef.current?.focus({ preventScroll: true });
    else if (target === "tree") tabStop?.focus({ preventScroll: true });
  });

  const pick = (itemId: TreeItemId | undefined) => {
    if (itemId === undefined) return;
    if (values.length !== 1 || values[0] !== itemId) commit([itemId]);
    closePopup();
  };

  const removeChip = (itemId: TreeItemId) => {
    if (!isCascade || !checkStates || !index.byId.has(itemId)) {
      commit(values.filter((checked) => checked !== itemId));
      return;
    }
    // As unchecking it in the tree does - its enabled descendants too
    const next = toggleCheck(itemId, {
      checked: valueSet,
      index,
      items,
      loads,
      states: checkStates,
    });
    if (next !== null) commit(next);
  };

  // Something to clear - the disabled items keep their state
  const showClear =
    clearable &&
    canChange &&
    values.some((itemId) => !index.disabled.has(itemId));

  const clear = (button: HTMLElement) => {
    // The button goes away with the value - the focus on it moves to the
    // combobox
    if (
      button === getActiveElement(button.getRootNode() as Document | ShadowRoot)
    ) {
      comboboxRef.current?.focus();
    }
    commit(
      multiple
        ? normalizedValues.filter((itemId) => index.disabled.has(itemId))
        : [],
    );
  };

  const handleComboboxKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!canChange || event.nativeEvent.isComposing) return;
    const { key } = event;

    if (key === "ArrowUp" && event.altKey) {
      if (open) {
        event.preventDefault();
        closePopup();
      }
      return;
    }

    if (
      key === "ArrowDown" ||
      key === "ArrowUp" ||
      key === "Enter" ||
      key === " "
    ) {
      event.preventDefault();
      openPopup(searchable ? "search" : "tree");
      return;
    }

    if (key === "Escape" && open) {
      event.preventDefault();
      closePopup();
      return;
    }

    // The last chip goes, as in the other fields of several values
    if ((key === "Backspace" || key === "Delete") && multiple && !open) {
      const last = chipIds.findLast((itemId) => !index.disabled.has(itemId));
      if (last !== undefined) {
        event.preventDefault();
        removeChip(last);
      }
      return;
    }

    // A letter searches - the popup opens with it
    if (
      searchable &&
      key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      setSearch(key);
      openPopup("search");
    }
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown" || event.key === "Enter") {
      // Into the tree - Enter submits no form from here
      event.preventDefault();
      focusPopup("tree");
      return;
    }

    // The first Escape empties the search, the next closes the popup
    if (event.key === "Escape" && search) {
      event.preventDefault();
      setSearch("");
    }
  };

  // The keys of the tree's items - after the tree has handled them
  const handleTreeKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const target = event.target as Element;
    if (target.getAttribute("role") !== "treeitem") return;

    // Up from the first item goes back to the search field
    if (
      event.key === "ArrowUp" &&
      !event.altKey &&
      searchable &&
      target.getAttribute("aria-level") === "1" &&
      target.getAttribute("aria-posinset") === "1"
    ) {
      searchRef.current?.focus();
      return;
    }
    if (event.nativeEvent.isComposing) return;

    // A Space typed soon after a letter goes on with the typeahead search
    // of the tree ("New York") - as the tree has it, it picks nothing
    const typing = event.timeStamp - typedAtRef.current < TYPEAHEAD_TIMEOUT;
    if (event.key === " " && !typing) {
      // Space on the item picked already closes too - the tree reports
      // nothing then: its selection stays, and Space is no click in a tree
      // that selects
      if (
        !multiple &&
        target.getAttribute("aria-selected") === "true" &&
        !target.hasAttribute("aria-disabled")
      ) {
        closePopup();
      }
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      typedAtRef.current = event.timeStamp;
    }
  };

  // Tab moves between the field and the popup as if the popup followed the
  // field in the page - it is a portal at the end of it - and out of the
  // popup closes it
  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || event.defaultPrevented) return;

    const focused = event.target as Node;
    const tabbables = getTabbableElements(event.currentTarget);
    const hasTabbable = (position: number) =>
      tabbables.some(
        (element) => focused.compareDocumentPosition(element) & position,
      );

    if (event.shiftKey) {
      if (hasTabbable(Node.DOCUMENT_POSITION_PRECEDING)) return;
      event.preventDefault();
      comboboxRef.current?.focus();
    } else {
      if (hasTabbable(Node.DOCUMENT_POSITION_FOLLOWING)) return;
      event.preventDefault();
      const next = fieldRef.current
        ? getNextTabStop(fieldRef.current, panelRef.current)
        : undefined;
      (next ?? comboboxRef.current)?.focus();
    }
    setOpen(false);
    setSearch("");
  };

  // The field is one field for the caller: the focus moving between its
  // chips, the combobox and the popup (a portal) is neither a focus nor a
  // blur of it
  const isInField = (node: EventTarget | null) =>
    node instanceof Node &&
    (!!rootRef.current?.contains(node) || !!panelRef.current?.contains(node));

  // What the field shows - and the combobox says
  const selectedText =
    !multiple && values.length > 0
      ? showPath
        ? [...getAncestors(index.parentOf, values[0]).reverse(), values[0]]
            .map(labelOf)
            .join(messages.treeSelect.pathSeparator)
        : labelOf(values[0])
      : null;
  const listFormat =
    typeof Intl.ListFormat === "function"
      ? new Intl.ListFormat(toIntlLocale(locale.code), { type: "conjunction" })
      : null;
  const chipLabels = [
    ...shownChips.map(labelOf),
    ...(moreText ? [moreText] : []),
  ];
  const chipSummary =
    chipLabels.length === 0
      ? ""
      : listFormat
        ? listFormat.format(chipLabels)
        : chipLabels.join(", ");

  // A single field without a value submits an empty one, so that clearing
  // it reaches backends that keep fields missing from the request as they
  // are; a multiple one submits none
  const submittedValues = multiple
    ? normalizedValues
    : values.length > 0
      ? values
      : [""];

  const chipSize = chipSizes[dim];

  return (
    <div
      {...props}
      className={cn("relative", className)}
      onBlur={(event) => {
        if (!isInField(event.relatedTarget)) onBlur?.(event);
      }}
      onFocus={(event) => {
        if (!isInField(event.relatedTarget)) onFocus?.(event);
      }}
      ref={rootRef}
    >
      {label && (
        // A combobox is no input a `<label>` focuses by itself
        <label
          className="mb-1.5 block text-sm font-medium"
          id={labelId}
          onClick={() => comboboxRef.current?.focus()}
        >
          {label}
          {messages.form.labelSuffix}{" "}
          {/* The star is for the eye - `required` tells assistive technology */}
          {required && <RequiredMark />}
        </label>
      )}

      {/* The value, and the input the browser validates `required` with.
          Disabled, like a disabled native field, they are neither submitted
          nor validated - read-only, the value is submitted, not validated */}
      {name &&
        submittedValues.map((submitted) => (
          <input
            disabled={disabled}
            form={form}
            key={encodeId(submitted)}
            name={name}
            readOnly
            type="hidden"
            value={String(submitted)}
          />
        ))}
      {required && !readOnly && (
        <input
          disabled={disabled}
          form={form}
          // Neither focusable nor seen by assistive technology - until the
          // browser reports it invalid (a submit, `reportValidity()`), then
          // it can take the focus the browser gives it, with the message
          inert
          onChange={() => {}}
          // The user belongs in the visible field (the message still shows)
          onFocus={() => comboboxRef.current?.focus()}
          onInvalid={(event) => {
            const input = event.currentTarget;
            input.removeAttribute("inert");
            setTimeout(() => input.setAttribute("inert", ""));
          }}
          required
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value={values.length > 0 ? "valid" : ""}
        />
      )}

      <Popover
        className="w-full"
        contentClassName="flex max-h-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden"
        // The combobox is inside - the wrapper is no button around it
        interactiveTrigger
        onOpenChange={(isOpen) => {
          if (!isOpen) closePopup();
          // A press of a finger opens it without the on-screen keyboard
          else
            openPopup(
              searchable && pointerTypeRef.current !== "touch"
                ? "search"
                : null,
            );
        }}
        open={open && canChange}
        // The tree inside has its role - the combobox says it opens one
        popupRole="none"
        position="bottom"
        trigger={
          <div
            className={cn(
              "flex w-full items-center gap-1 rounded-md border border-neutral-300 bg-surface transition-colors focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700 dark:bg-surface-dark",
              dimStyles[dim],
              multiple && "flex-wrap",
              // Forced colors (Windows High Contrast) draw every border in
              // one color - an outline makes the border of an invalid field
              // thicker
              error &&
                "border-danger-500! focus-within:ring-danger-500! forced-colors:outline-1",
              canChange ? "cursor-pointer" : "cursor-default",
              disabled && "cursor-not-allowed opacity-50",
            )}
            data-readonly={readOnly ? "" : undefined}
            // The field acts as the combobox: a click focuses it, a press
            // on the padding keeps the focus where it is
            onClick={() => comboboxRef.current?.focus()}
            onMouseDown={(event) => {
              if (!(event.target as Element).closest("button")) {
                event.preventDefault();
              }
            }}
            onPointerDown={(event) => {
              pointerTypeRef.current = event.pointerType;
            }}
            ref={fieldRef}
          >
            {shownChips.map((itemId) => (
              <Chip
                key={encodeId(itemId)}
                onRemove={
                  canChange && !index.disabled.has(itemId)
                    ? () => removeChip(itemId)
                    : undefined
                }
                size={chipSize}
              >
                {labelOf(itemId)}
              </Chip>
            ))}
            {moreText && <Chip size={chipSize}>{moreText}</Chip>}

            <div
              aria-controls={open && canChange ? treeId : undefined}
              aria-describedby={joinTokens(
                errorId,
                descriptionId,
                ariaDescribedBy,
              )}
              aria-disabled={disabled || undefined}
              aria-expanded={open && canChange}
              aria-haspopup="tree"
              aria-invalid={error ? "true" : ariaInvalid}
              aria-label={label ? undefined : ariaLabel}
              aria-labelledby={ariaLabelledBy ?? (label ? labelId : undefined)}
              aria-readonly={readOnly || undefined}
              aria-required={required ? "true" : ariaRequired}
              className="min-h-lh min-w-8 flex-1 truncate select-none focus:outline-hidden"
              data-disabled={disabled ? "" : undefined}
              data-invalid={
                error || isAriaInvalid(ariaInvalid) ? "" : undefined
              }
              data-readonly={readOnly ? "" : undefined}
              data-state={open && canChange ? "open" : "closed"}
              id={comboboxId}
              onKeyDown={handleComboboxKeyDown}
              ref={comboboxCallbackRef}
              role="combobox"
              // Not focusable while disabled, like a native field
              tabIndex={disabled ? undefined : 0}
            >
              {selectedText ??
                (chipSummary ? (
                  // The chips beside it, for screen readers
                  <span className="sr-only">{chipSummary}</span>
                ) : (
                  // The color of an input's placeholder
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {placeholder}
                  </span>
                ))}
            </div>

            {showClear && (
              <button
                aria-label={messages.treeSelect.clear}
                className="-my-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-500 hover:text-neutral-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:text-neutral-300"
                onClick={(event) => {
                  // Not a toggle of the popup
                  event.stopPropagation();
                  clear(event.currentTarget);
                }}
                // A press keeps the focus where it is
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                <X aria-hidden="true" size={iconSizes[dim]} />
              </button>
            )}
            {!readOnly && (
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "shrink-0 text-neutral-500 transition-transform duration-200 motion-reduce:transition-none dark:text-neutral-400",
                  open && "rotate-180",
                )}
                size={iconSizes[dim]}
              />
            )}
          </div>
        }
        triggerType="click"
        width="100%"
      >
        <div
          className="flex min-h-0 flex-1 flex-col"
          onKeyDown={handlePanelKeyDown}
          ref={attachPanel}
        >
          {searchable && (
            <div className="shrink-0 border-b border-neutral-200 p-1.5 dark:border-neutral-800">
              <input
                aria-controls={treeId}
                aria-label={messages.treeSelect.search}
                autoComplete="off"
                className="form-control px-2 py-1 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                onFocus={(event) => {
                  // The letter typed on the field - the caret after it
                  const input = event.currentTarget;
                  input.setSelectionRange(
                    input.value.length,
                    input.value.length,
                  );
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={messages.treeSelect.searchPlaceholder}
                ref={searchRef}
                type="search"
                value={search}
              />
            </div>
          )}
          <TreeView
            aria-label={label ? undefined : ariaLabel}
            aria-labelledby={label ? labelId : ariaLabelledBy}
            checkable={multiple}
            checked={multiple ? values : undefined}
            checkMode={checkMode}
            className="min-h-0 flex-1 overflow-y-auto p-1"
            expanded={expanded}
            filter={search}
            id={treeId}
            items={treeItems}
            loadChildren={loadAndKeep}
            onCheckedChange={multiple ? commit : undefined}
            onExpandedChange={setExpanded}
            // Also a click on the item picked already closes the popup
            onItemClick={multiple ? undefined : closePopup}
            onKeyDown={handleTreeKeyDown}
            onSelectedChange={
              multiple ? undefined : (selected) => pick(selected[0])
            }
            renderLabel={
              renderLabel &&
              ((item, state) =>
                renderLabel(index.byId.get(item.id) ?? item, state))
            }
            selected={multiple ? undefined : values}
            selectionMode={multiple ? "none" : "single"}
            virtualized={virtualized}
          />
        </div>
      </Popover>

      <FormDescription className="mt-1.5" id={descriptionId}>
        {description}
      </FormDescription>
      {error && (
        <FormError className="mt-1.5" id={errorId}>
          {error}
        </FormError>
      )}
    </div>
  );
}
