import { ChevronDown, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Chip from "../chip";
import cn, { joinTokens } from "../../utils/cn";
import debounce from "../../utils/debounce";
import FormDescription from "../form-description";
import FormError from "../form-error";
import HighlightedText from "../data-table/highlight";
import logger from "../../utils/logger";
import Popover from "../popover";
import { getActiveElement, getElementByIdAt } from "../overlay-stack";
import { foldSearchText } from "../../utils/remove-diacritics";
import usePointerMoved from "../../hooks/use-pointer-moved";
import Spinner from "../spinner";
import useDebouncedValue from "../../hooks/use-debounced-value";
import { formatMessage, formatPlural } from "../../i18n/format";
import {
  attachRef,
  isAriaInvalid,
  useFieldsetDisabled,
  useFormReset,
} from "../../hooks/use-form-control";
import {
  normalizeLoadOptionsResult,
  type LoadOptionsParams,
  type LoadOptionsResult,
} from "./load-options";
import { useLocale, useMessages } from "../../providers/ui-context";
import { defaultFilterOptions } from "./filter-options";
import useVirtualList, { type VirtualListRow } from "./use-virtual-list";
import RequiredMark from "../required-mark";

export type {
  LoadOptionsPage,
  LoadOptionsParams,
  LoadOptionsResult,
  RelayConnection,
} from "./load-options";

const DEFAULT_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE = 300;
// The state of the list is announced once it has not changed for this long
// (ms) - after typing pauses, not at every key
const ANNOUNCE_DELAY = 500;
// Letters typed into a select within this time (ms) are one search
const TYPE_AHEAD_TIMEOUT = 500;
// Keys that move the highlight or pick - they end a search of typed letters
const NAVIGATION_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Enter",
  "Escape",
  "Home",
  "PageDown",
  "PageUp",
  "Tab",
]);
// Options PageUp / PageDown move by in a list without a height (jsdom)
const DEFAULT_PAGE_STEP = 10;
// The values of the rows the field adds itself - "Add “…”" and "Select
// all". No value of the options: the control character keeps them apart.
const ADD_VALUE = "\u0000add";
const SELECT_ALL_VALUE = "\u0000all";

export type AutocompleteValue = string | number;

export interface AutocompleteOption<T = AutocompleteValue> {
  /** Text shown in the list and in the field. */
  label: string;
  /** Reported by `onChange` and submitted with the form. */
  value: T;
  /**
   * The item the option was created from - a loaded one, or a static one
   * read by the default fields or option getters. `onChange` reports it.
   */
  data?: unknown;
  /** Shown in the list, but cannot be picked. */
  disabled?: boolean;
  /**
   * The heading the option is listed under - the options of a group are
   * listed together, the groups in the order their first options come in.
   * Options without one come first, under no heading.
   */
  group?: string;
}

/**
 * Fields the default label, value and group are read from, unless
 * `getOptionLabel` / `getOptionValue` / `getOptionGroup` are given: the
 * label from `label`, `name` or `title`, the value from `value` or `id`,
 * the group from `group`.
 */
export interface AutocompleteItem {
  /** Shown in the list, but cannot be picked. */
  disabled?: boolean;
  /** The heading the item is listed under - see `AutocompleteOption`. */
  group?: string;
  /** The value, unless the item has a `value`. */
  id?: AutocompleteValue;
  /** The label. */
  label?: string;
  /** The label, unless the item has a `label`. */
  name?: string;
  /** The label, unless the item has a `label` or `name`. */
  title?: string;
  /** The value. */
  value?: AutocompleteValue;
}

interface BaseAutocompleteProps<
  TItem extends object = AutocompleteItem,
> extends Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange" | "children" | "ref"
> {
  /**
   * Behaves like a select: no typing (a letter highlights the next option
   * starting with it), a click opens the whole list on the selected option.
   * Combine with `hasEmpty` to allow clearing the selection.
   */
  asSelect?: boolean;
  /**
   * Classes of the outer wrapper around the label, the field and the error
   * message - not of the field itself.
   */
  className?: string;
  /** Multiple mode: close the list after each pick. */
  closeOnSelect?: boolean;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field - the heights, paddings and text of `Input`. */
  dim?: "xs" | "sm" | "md" | "lg";
  /**
   * Disables the field - like a disabled native one, it is then neither
   * submitted nor validated. A disabled `<fieldset>` around it disables it
   * too.
   */
  disabled?: boolean;
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /**
   * Picks the options the typed term shows - called with the options and
   * the term (without the spaces around it, empty before anything is
   * typed), returns the ones to list in the order to list them. Replaces
   * the default match of static options: the label containing the term,
   * ignoring case and diacritics (`defaultFilterOptions`). With
   * `loadOptions` it filters the loaded options further - they are not
   * filtered by default, the API has done it. Not called in a select.
   */
  filterOptions?: (
    options: AutocompleteOption[],
    search: string,
  ) => AutocompleteOption[];
  /**
   * Id of the `<form>` the hidden inputs (the value and `required`) belong
   * to, when the field is not inside it - like the `form` attribute of a
   * native field. A reset of that form resets the field too.
   */
  form?: string;
  /**
   * Group of an item - a loaded one, or a static one in `options` - which
   * the option is listed under; nothing for none. See `AutocompleteItem`
   * for the default.
   */
  getOptionGroup?: (item: TItem) => string | null | undefined;
  /**
   * Label of an item - a loaded one, or a static one in `options`. See
   * `AutocompleteItem` for the default.
   */
  getOptionLabel?: (item: TItem) => string;
  /**
   * Value of an item - a loaded one, or a static one in `options`. See
   * `AutocompleteItem` for the default.
   */
  getOptionValue?: (item: TItem) => AutocompleteValue;
  /** `asSelect` only: adds an empty first option that clears the selection. */
  hasEmpty?: boolean;
  /**
   * Puts the part of each label that matches the typed term in bold -
   * where the label contains the term, ignoring case and diacritics. A
   * `renderOption` gets the term as `search` to do it itself.
   */
  highlightMatches?: boolean;
  /** Content of the `<label>` above the field - text, or text with markup. */
  label?: React.ReactNode;
  /**
   * The combobox - the input of a typing field, the element with the role
   * in a select (`asSelect`) - e.g. for `focus()`; React Hook Form focuses
   * it at an error. The other attributes of a `<div>` (`data-*`, `style`,
   * event handlers) go to the wrapper, as `className` does.
   */
  ref?: React.Ref<HTMLElement>;
  /**
   * Static mode: called when the list is scrolled to its end - load more and
   * pass the longer `options`. Set `hasMore` to `false` once there is
   * nothing more to load.
   */
  loadMore?: () => Promise<void>;
  /**
   * Multiple mode: the most options that can be selected. Once reached, the
   * list says so and offers only the selected options.
   */
  maxSelections?: number;
  /**
   * Multiple mode: the most chips the field shows while the focus is
   * elsewhere - the other values are summed up as "+N more". The focus in
   * the field shows them all, to be removed.
   */
  maxVisibleChips?: number;
  /**
   * Several values - `value`, `defaultValue` and `onChange` then work with
   * arrays.
   */
  multiple?: boolean;
  /**
   * Submits the value(s) in hidden inputs of this name, so the field works
   * in a plain `<form>` / `FormData`.
   */
  name?: string;
  /**
   * Lets the user add an option the list does not have: while the typed
   * term matches no option exactly (ignoring case and diacritics), the list
   * ends with "Add “term”". Picking it calls `onCreate` with the term, which
   * returns the new item - read like the others, by `getOptionLabel` /
   * `getOptionValue` - or `{ label, value }` for static options of that
   * shape; it may return a promise. The new option is selected (added in
   * multiple mode) and announced. An error thrown or rejected is shown in
   * the list - its `message`, or a text of the locale. Resetting the form,
   * or making another selection in single mode, ignores any pending
   * creation and clears its status.
   */
  onCreate?: (
    search: string,
  ) =>
    | NoInfer<TItem>
    | AutocompleteOption
    | Promise<NoInfer<TItem> | AutocompleteOption>;
  /** Shown in the empty field. */
  placeholder?: string;
  /**
   * The value is shown, focusable and submitted with the form, but cannot
   * be changed: the list does not open, and there is no clear button, no ×
   * on the chips. `aria-readonly` and `data-readonly` are on the combobox.
   * Like a read-only native field, it is not checked by `required`.
   */
  readOnly?: boolean;
  /**
   * Custom rendering of an option in the list. `search` is the typed term,
   * e.g. to highlight it.
   */
  renderOption?: (
    option: AutocompleteOption,
    state: { active: boolean; search: string; selected: boolean },
  ) => React.ReactNode;
  /** A value must be picked before the form can be submitted. */
  required?: boolean;
  /**
   * Uncontrolled mode: apply every change of `defaultValue`, not only the
   * first one (e.g. when the form is reset with new data).
   */
  syncWithDefaultValue?: boolean;
  /**
   * Renders only the options in view of the list (and a few around them),
   * for lists of thousands of options. Options of any height are measured
   * as they are rendered; the highlight, the keys and the scrolling work as
   * with all of them rendered.
   */
  virtualized?: boolean;
}

/** The value of a field without `multiple` - one value. */
interface SingleSelectionProps<TItem extends object> {
  /**
   * Single typing field: the typed text becomes the value when no option is
   * picked - as the focus leaves the field or on Enter (which then submits
   * the form, as in a text input). A text that is the label of an option
   * (ignoring case and diacritics) picks that option. `onChange` gets the
   * text (without the spaces around it) and the item `null`. The form gets
   * that value already while it is typed - the text, or the value of the
   * option it names. Escape closes the list and leaves the text; erasing it
   * clears the value.
   */
  allowCustomValue?: boolean;
  /**
   * Initial value of an uncontrolled field - `null` for no selection; an
   * array with `multiple`.
   */
  defaultValue?: AutocompleteValue | null;
  multiple?: false;
  /**
   * Called with the new value and the item behind it: `(value, item)`, or
   * `(values, items)` with `multiple`, where `items[i]` belongs to
   * `values[i]`. The item is `null` for a value without one - a static
   * option without `data`, a saved value `loadSelectedOptions` did not
   * deliver.
   */
  onChange?: (value: AutocompleteValue | null, item: TItem | null) => void;
  /**
   * Value of a controlled field - `null` for no selection; an array with
   * `multiple`.
   */
  value?: AutocompleteValue | null;
}

/** The value of a field with `multiple` - an array of values. */
interface MultipleSelectionProps<TItem extends object> {
  allowCustomValue?: never;
  /** Initial values of an uncontrolled field. */
  defaultValue?: AutocompleteValue[] | null;
  multiple: true;
  /**
   * Called with the new values and the items behind them - `items[i]`
   * belongs to `values[i]`. The item is `null` for a value without one - a
   * static option without `data`, a saved value `loadSelectedOptions` did
   * not deliver.
   */
  onChange?: (values: AutocompleteValue[], items: (TItem | null)[]) => void;
  /** Values of a controlled field. */
  value?: AutocompleteValue[] | null;
}

type SelectionProps<TItem extends object> =
  SingleSelectionProps<TItem> | MultipleSelectionProps<TItem>;

interface AsyncSourceProps<
  TItem extends object = AutocompleteItem,
> extends BaseAutocompleteProps<TItem> {
  hasMore?: never;
  /**
   * Loads the options from any API - REST, GraphQL, … Called with the typed
   * term (debounced) and, once the list is scrolled to its end, for the next
   * page. See `LoadOptionsParams` / `LoadOptionsResult`.
   */
  loadOptions: (params: LoadOptionsParams) => Promise<LoadOptionsResult<TItem>>;
  /**
   * Values the loaded options depend on besides the search term (e.g. a parent
   * filter) - the list is reloaded when they change. Compared by value, so
   * inline arrays and objects are fine.
   */
  loadOptionsDeps?: unknown[];
  /**
   * Loads the items of selected values whose label is not known yet (e.g. the
   * `defaultValue` of an edit form), so the labels show before the list has
   * ever been opened. `signal` is aborted when the field unmounts or the
   * values change before the items arrive. A value it does not deliver shows
   * as it is. After a rejection the values show as they are too, and are
   * asked for again when the list next opens.
   */
  loadSelectedOptions?: (
    values: AutocompleteValue[],
    params: { signal: AbortSignal },
  ) => Promise<TItem[]>;
  /** Called when `loadOptions` or `loadSelectedOptions` rejects. */
  onLoadError?: (error: unknown) => void;
  options?: never;
  /**
   * Items per page requested from `loadOptions`. Changing it starts the
   * list over from its first page.
   */
  pageSize?: number;
  selectAll?: never;
}

interface StaticSourceProps<
  TItem extends object = AutocompleteItem,
> extends BaseAutocompleteProps<TItem> {
  /**
   * `false` stops calling `loadMore` - the `options` are complete. Defaults
   * to `true`.
   */
  hasMore?: boolean;
  loadOptions?: never;
  loadOptionsDeps?: never;
  loadSelectedOptions?: never;
  onLoadError?: never;
  /**
   * The options, filtered by the typed term (ignoring case and diacritics).
   * Items using the default fields of `AutocompleteItem` are converted to
   * options; ready-made `label` / `value` options keep their own `data`.
   * With `getOptionLabel` / `getOptionValue` / `getOptionGroup` they can be
   * items of any shape (each is then its own `data`).
   */
  options: AutocompleteOption[] | NoInfer<TItem>[];
  pageSize?: never;
  /**
   * Multiple mode: the list starts with an option that selects all the
   * options it shows - those the typed term found, not `disabled` - and
   * deselects them once all are selected. `true` labels it "Select all" in
   * the language of the locale, a text labels it with that text. Not shown
   * when `maxSelections` would not let them all be selected.
   */
  selectAll?: boolean | string;
}

/** Loads the options from an API - `loadOptions`. */
export type AsyncAutocompleteProps<TItem extends object = AutocompleteItem> =
  AsyncSourceProps<TItem> & SelectionProps<TItem>;

/** Filters the `options` it is given. */
export type StaticAutocompleteProps<TItem extends object = AutocompleteItem> =
  StaticSourceProps<TItem> & SelectionProps<TItem>;

export type AutocompleteProps<TItem extends object = AutocompleteItem> =
  AsyncAutocompleteProps<TItem> | StaticAutocompleteProps<TItem>;

const toValues = (
  value: AutocompleteValue[] | AutocompleteValue | null | undefined,
): AutocompleteValue[] => {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
};

// Values come from inputs (strings) as often as from data (numbers)
const valueKey = (value: AutocompleteValue) => String(value);

const sameValue = (a: AutocompleteValue, b: AutocompleteValue) =>
  valueKey(a) === valueKey(b);

const normalizeText = foldSearchText;

function createOption<TItem extends object>(
  item: TItem,
  getOptionLabel?: (item: TItem) => string,
  getOptionValue?: (item: TItem) => AutocompleteValue,
  getOptionGroup?: (item: TItem) => string | null | undefined,
): AutocompleteOption {
  const record = item as Record<string, unknown>;
  const fallbackValue = record.value ?? record.id;
  const fallbackLabel = record.label ?? record.name ?? record.title;
  const group = getOptionGroup
    ? getOptionGroup(item)
    : typeof record.group === "string"
      ? record.group
      : undefined;

  return {
    label: getOptionLabel
      ? getOptionLabel(item)
      : String(fallbackLabel ?? fallbackValue ?? ""),
    value: getOptionValue
      ? getOptionValue(item)
      : typeof fallbackValue === "number"
        ? fallbackValue
        : String(fallbackValue ?? ""),
    data: item,
    ...(record.disabled === true ? { disabled: true } : {}),
    ...(group ? { group } : {}),
  };
}

// Static items are read like loaded ones; ready-made options without
// getters keep their identity and optional `data` payload.
function normalizeStaticOption<TItem extends object>(
  item: TItem | AutocompleteOption,
  getOptionLabel?: (item: TItem) => string,
  getOptionValue?: (item: TItem) => AutocompleteValue,
  getOptionGroup?: (item: TItem) => string | null | undefined,
): AutocompleteOption {
  const option = item as AutocompleteOption;
  if (
    !getOptionLabel &&
    !getOptionValue &&
    !getOptionGroup &&
    typeof option.label === "string" &&
    (typeof option.value === "string" || typeof option.value === "number")
  ) {
    return option;
  }
  return createOption(
    item as TItem,
    getOptionLabel,
    getOptionValue,
    getOptionGroup,
  );
}

/** A run of the listed options under one heading - or under none. */
interface ListSection {
  /** Index of the first option after the section. */
  end: number;
  /** The heading - none for the options before the groups and after them. */
  label?: string;
  /** Index of the first option of the section. */
  start: number;
}

/**
 * The options in the order they are listed, and the sections of that list:
 * `leading` (the empty option, "Select all") and the options without a
 * group first, then each group - in the order their first options come
 * in, so that a page loaded later adds to the groups it has options of -
 * and `trailing` ("Add “…”") last.
 */
function arrangeOptions(
  leading: AutocompleteOption[],
  options: AutocompleteOption[],
  trailing: AutocompleteOption[],
) {
  const ungrouped: AutocompleteOption[] = [];
  const groups = new Map<string, AutocompleteOption[]>();

  for (const option of options) {
    if (!option.group) {
      ungrouped.push(option);
      continue;
    }
    const members = groups.get(option.group);
    if (members) members.push(option);
    else groups.set(option.group, [option]);
  }

  if (groups.size === 0) {
    const listed =
      leading.length || trailing.length
        ? [...leading, ...options, ...trailing]
        : options;
    return {
      listed,
      sections: [{ end: listed.length, start: 0 }] as ListSection[],
    };
  }

  const listed = [...leading, ...ungrouped];
  const sections: ListSection[] = [];
  if (listed.length) sections.push({ end: listed.length, start: 0 });

  for (const [label, members] of groups) {
    const start = listed.length;
    for (const member of members) listed.push(member);
    sections.push({ end: listed.length, label, start });
  }

  if (trailing.length) {
    const start = listed.length;
    listed.push(...trailing);
    sections.push({ end: listed.length, start });
  }

  return { listed, sections };
}

/** The message of a failed `onCreate` - an `Error`'s own, or `fallback`. */
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : fallback;

/**
 * The rows of a virtualized list - the heading of each group and the
 * options - and the row of each option.
 */
function buildListRows(sections: ListSection[], rowKeys: string[]) {
  const rows: VirtualListRow[] = [];
  const rowOfOption: number[] = [];

  for (const section of sections) {
    if (section.label !== undefined) {
      rows.push({ heading: true, key: `h\u0000${section.label}` });
    }
    for (let index = section.start; index < section.end; index++) {
      rowOfOption[index] = rows.length;
      rows.push({ heading: false, key: `o\u0000${rowKeys[index]}` });
    }
  }

  return { rowOfOption, rows };
}

const NO_ROWS: VirtualListRow[] = [];

// The option `hasEmpty` adds - blank, but not empty, so it has a height
const EMPTY_OPTION: AutocompleteOption = { label: " ", value: "" };

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

// The field at each size - the paddings and the text of `Input`
const dimStyles = {
  xs: "px-1 py-0 text-sm",
  sm: "px-1 py-0.5 text-sm",
  md: "px-2 py-1 text-base",
  lg: "px-3 py-2 text-lg",
};

// The text of the list - the options as big as the field
const listDimStyles = {
  xs: "text-sm",
  sm: "text-sm",
  md: undefined,
  lg: "text-lg",
};

// Chips that fit the line of text of the field, so that a field with chips
// is as tall as an `Input` - at `md` a chip a little flatter than its own
const chipSizes = { xs: "sm", sm: "sm", md: "md", lg: "md" } as const;
const chipDimStyles = {
  xs: undefined,
  sm: undefined,
  md: "py-px",
  lg: undefined,
};
const iconSizes = { xs: 14, sm: 14, md: 16, lg: 18 };

interface OptionRowProps {
  active: boolean;
  /** Accessible name instead of the label (the blank empty option). */
  ariaLabel?: string;
  /** Content instead of the label - the rows the field adds itself. */
  content?: React.ReactNode;
  disabled: boolean;
  /** Puts the typed term in the label in bold. */
  highlight: boolean;
  id: string;
  index: number;
  /** Measures the row (virtualization). */
  measureRef?: (element: HTMLElement | null) => void;
  onHover: (event: React.MouseEvent, index: number) => void;
  onSelect: (option: AutocompleteOption) => void;
  option: AutocompleteOption;
  /** `aria-posinset` of a virtualized list. */
  posInSet?: number;
  renderOption?: BaseAutocompleteProps["renderOption"];
  /** Key of the row among the measured ones (virtualization). */
  rowKey?: string;
  /** The typed term - for `renderOption` and the highlight. */
  search: string;
  selected: boolean;
  /** A line above the row - "Add “…”" after the options. */
  separated?: boolean;
  /** `aria-setsize` of a virtualized list - `-1` while more can load. */
  setSize?: number;
}

/**
 * An option of the list. A component of its own, so that the compiler
 * memoizes every row - moving the highlight renders the two rows it moves
 * between, not the whole list.
 */
function OptionRow({
  active,
  ariaLabel,
  content,
  disabled,
  highlight,
  id,
  index,
  measureRef,
  onHover,
  onSelect,
  option,
  posInSet,
  renderOption,
  rowKey,
  search,
  selected,
  separated = false,
  setSize,
}: OptionRowProps) {
  return (
    <li
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      aria-posinset={posInSet}
      aria-selected={selected}
      aria-setsize={setSize}
      className={cn(
        "px-2 py-1",
        // Forced colors (Windows High Contrast) draw no background: the
        // highlighted option takes the system's highlight colors, a
        // selected one an outline inside it
        active &&
          "forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
        selected && "forced-colors:outline-2 forced-colors:-outline-offset-2",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        !disabled &&
          !selected &&
          "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        selected &&
          "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200",
        !disabled &&
          selected &&
          "hover:bg-neutral-300 dark:hover:bg-neutral-600",
        !selected && active && "bg-neutral-100 dark:bg-neutral-800",
        selected && active && "bg-neutral-300 dark:bg-neutral-600",
        separated && "border-t border-neutral-200 dark:border-neutral-700",
      )}
      data-disabled={disabled ? "" : undefined}
      data-highlighted={active ? "" : undefined}
      data-row-key={rowKey}
      data-selected={selected ? "" : undefined}
      id={id}
      onClick={disabled ? undefined : () => onSelect(option)}
      // A move, not an enter - see `handleHover`
      onMouseMove={disabled ? undefined : (event) => onHover(event, index)}
      ref={measureRef}
      role="option"
    >
      {content ??
        (renderOption ? (
          renderOption(option, { active, search, selected })
        ) : highlight ? (
          <HighlightedText term={search} text={option.label} />
        ) : (
          option.label
        ))}
    </li>
  );
}

/**
 * A searchable select - single or multiple, with static `options` or
 * options loaded from an API (`loadOptions`) with infinite scroll.
 *
 * The keyboard follows the ARIA combobox pattern: ArrowDown opens the list,
 * Enter picks the highlighted option. Enter in a closed typing field is left
 * to the browser, as in a text input - it submits the form. A select
 * (`asSelect`) opens its list on Enter and Space (the select-only combobox).
 * Options can be listed under group headings, added by the user
 * (`onCreate`), or rendered only while in view (`virtualized`).
 */
export default function Autocomplete<TItem extends object = AutocompleteItem>({
  allowCustomValue: allowCustomValueProp = false,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-required": ariaRequired,
  asSelect = false,
  className,
  closeOnSelect = false,
  defaultValue,
  description,
  dim = "md",
  disabled: disabledProp = false,
  error,
  filterOptions,
  form,
  getOptionGroup,
  getOptionLabel,
  getOptionValue,
  hasEmpty = false,
  hasMore: hasMoreOptions = true,
  highlightMatches = false,
  id,
  label,
  loadMore,
  loadOptions,
  loadOptionsDeps,
  loadSelectedOptions,
  maxSelections,
  maxVisibleChips,
  multiple = false,
  name,
  onChange,
  onCreate,
  onLoadError,
  options,
  pageSize = DEFAULT_PAGE_SIZE,
  placeholder,
  readOnly = false,
  ref,
  renderOption,
  required,
  selectAll = false,
  syncWithDefaultValue = false,
  value,
  virtualized = false,
  ...props
}: AutocompleteProps<TItem>) {
  const locale = useLocale();
  const messages = useMessages();

  // A select is no native field, and the list opens from the field around
  // the input - a disabled fieldset around them leaves them alone unless told
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;
  // What the value cannot be changed by - a read-only field is still
  // focusable and submitted
  const locked = disabled || readOnly;
  // The typed text is a value of its own - in a single typing field
  const allowCustomValue = allowCustomValueProp && !multiple && !asSelect;

  const [open, setOpen] = useState(false);
  // The typed text - `null` while not typing, when a single-mode field shows
  // the label of its selection instead
  const [search, setSearch] = useState<string | null>(null);
  // The highlighted option, by its value - when the list is replaced (new
  // `options`, a reload) the highlight stays with its option or goes away,
  // never onto another option at its index
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Loaded list (async mode)
  const [loadedOptions, setLoadedOptions] = useState<AutocompleteOption[]>([]);
  const [listKey, setListKey] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingFirstPage, setLoadingFirstPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // The list whose loading failed - it shows an error while it stays open
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // Set as the list opens: the loaded list is from an earlier opening - it
  // is loaded again, and shown until the new one arrives
  const [listOutdated, setListOutdated] = useState(false);

  // Options whose labels stay known after they drop out of the list - the
  // picked ones and the selected ones a loaded page delivered
  const [pickedOptions, setPickedOptions] = useState<AutocompleteOption[]>([]);
  const [preloadedOptions, setPreloadedOptions] = useState<
    AutocompleteOption[]
  >([]);
  // Options the lists for the current `loadOptionsDeps` have delivered, by
  // value - typed text can name one before the list of its own search is
  // there. Under other deps, the same label can be another option.
  const [deliveredOptions, setDeliveredOptions] = useState<{
    depsKey: string;
    options: ReadonlyMap<string, AutocompleteOption>;
  }>(() => ({ depsKey: "", options: new Map() }));
  // Values `loadSelectedOptions` has answered for - with their item or not
  const [settledValues, setSettledValues] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Values whose `loadSelectedOptions` failed - asked for again when the list
  // next opens, not in a loop
  const [failedValues, setFailedValues] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Selection of an uncontrolled field
  const isControlled = value !== undefined;
  const [internalValues, setInternalValues] = useState(() =>
    toValues(defaultValue),
  );
  const [interacted, setInteracted] = useState(false);

  // `onCreate`: the term an option is being added for, the failure of the
  // last one, and what is announced once one is added
  const [creating, setCreating] = useState<string | null>(null);
  const [createError, setCreateError] = useState<{
    message: string;
    search: string;
  } | null>(null);
  const [createdMessage, setCreatedMessage] = useState("");
  // A reset or a newer single selection makes an earlier creation obsolete,
  // even if its promise cannot be canceled. A new one can start immediately.
  const createVersion = useRef(0);
  const cancelCreation = () => {
    createVersion.current += 1;
    setCreating(null);
    setCreateError(null);
  };
  // The focus is in the field - it shows all its chips then
  const [focused, setFocused] = useState(false);
  // The listbox, once its panel is rendered - virtualization follows the
  // panel's scrolling
  const [listElement, setListElement] = useState<HTMLUListElement | null>(null);

  const popoverContentRef = useRef<HTMLDivElement>(null);
  // The combobox - the input of a typing field, the element of a select
  const inputRef = useRef<HTMLElement>(null);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue` of an uncontrolled field, like a native field does
  const formResetRef = useFormReset(() => {
    cancelCreation();
    setCreatedMessage("");
    setSearch(null);
    if (isControlled) return;
    setInternalValues(toValues(defaultValue));
    setInteracted(false);
  }, form);

  const inputCallbackRef = useCallback(
    (element: HTMLElement | null) => {
      inputRef.current = element;
      const detachReset = formResetRef(element);
      const detachFieldset = fieldsetRef(element);
      const detachRef = attachRef(ref, element);

      return () => {
        inputRef.current = null;
        detachRef();
        detachReset?.();
        detachFieldset?.();
      };
    },
    [fieldsetRef, formResetRef, ref],
  );

  // Callers pass the callbacks as inline arrow functions, so their identity
  // changes on every parent render. Keep the latest ones in a ref and let the
  // fetching effects depend on a serialized snapshot of `loadOptionsDeps`
  // instead, so they react to the actual filter values and not to render churn.
  const callbacksRef = useRef({
    getOptionGroup,
    getOptionLabel,
    getOptionValue,
    loadOptions,
    loadSelectedOptions,
    onLoadError,
  });

  useInsertionEffect(() => {
    callbacksRef.current = {
      getOptionGroup,
      getOptionLabel,
      getOptionValue,
      loadOptions,
      loadSelectedOptions,
      onLoadError,
    };
  });

  const isAsync = typeof loadOptions === "function";
  const selectedValues = isControlled ? toValues(value) : internalValues;
  // The props are a union by `multiple` - `commit` passes what the mode takes
  const reportChange = onChange as
    | ((
        value: AutocompleteValue[] | AutocompleteValue | null,
        item: (TItem | null)[] | TItem | null,
      ) => void)
    | undefined;

  // Disabling the field - or making it read-only - closes its list, for
  // good, not until it can be changed again
  if (locked && open) {
    setOpen(false);
    setActiveKey(null);
    if (!multiple) setSearch(null);
  }

  // Uncontrolled: a `defaultValue` arriving later (data of an edit form) is
  // applied unless the user has picked something meanwhile; with
  // `syncWithDefaultValue` every change is.
  const defaultKey = JSON.stringify(toValues(defaultValue));
  const [appliedDefaultKey, setAppliedDefaultKey] = useState(defaultKey);

  if (!isControlled && defaultKey !== appliedDefaultKey) {
    setAppliedDefaultKey(defaultKey);

    if (syncWithDefaultValue || (appliedDefaultKey === "[]" && !interacted)) {
      setInternalValues(toValues(defaultValue));
    }
  }

  const staticOptions = useMemo(
    () =>
      options?.map((item) =>
        normalizeStaticOption(
          item,
          getOptionLabel,
          getOptionValue,
          getOptionGroup,
        ),
      ),
    [getOptionGroup, getOptionLabel, getOptionValue, options],
  );

  const knownOptions = useMemo(() => {
    const known = new Map<string, AutocompleteOption>();
    const sources = [
      preloadedOptions,
      pickedOptions,
      staticOptions ?? [],
      loadedOptions,
    ];

    for (const source of sources) {
      for (const option of source) known.set(valueKey(option.value), option);
    }

    return known;
  }, [loadedOptions, pickedOptions, preloadedOptions, staticOptions]);

  // By a set - a long list asks for every option
  const selectedKeys = new Set(selectedValues.map(valueKey));
  const isSelected = (option: AutocompleteOption) =>
    selectedKeys.has(valueKey(option.value));

  // Keep the latest loaded version of each selected option - otherwise a
  // search that drops it from the list would lose or restore an older label
  // and item, or start a preload of the label mid-typing.
  const keptOptions = new Map(
    [...preloadedOptions, ...pickedOptions].map((option) => [
      valueKey(option.value),
      option,
    ]),
  );
  const selectedToKeep = loadedOptions.filter((option) => {
    const key = valueKey(option.value);
    return selectedKeys.has(key) && keptOptions.get(key) !== option;
  });

  if (selectedToKeep.length > 0) {
    setPickedOptions((prev) => {
      const next = new Map(
        prev.map((option) => [valueKey(option.value), option]),
      );
      for (const option of selectedToKeep) {
        next.set(valueKey(option.value), option);
      }
      return [...next.values()];
    });
  }

  // Selected values whose items `loadSelectedOptions` is still to deliver -
  // no list has delivered them, and it has not answered for them yet
  const pendingValues =
    isAsync && loadSelectedOptions
      ? selectedValues.filter((selected) => {
          const key = valueKey(selected);
          return !knownOptions.has(key) && !settledValues.has(key);
        })
      : [];
  const pendingKey = pendingValues.length ? JSON.stringify(pendingValues) : "";
  // A value asked for again after a failure keeps showing as it is - the
  // field stays usable while it is retried
  const isPreloading = pendingValues.some(
    (pending) => !failedValues.has(valueKey(pending)),
  );

  // The options of the selected values, in their order. A value no list
  // knows shows as it is - so that it can be seen and removed like the
  // others - once no preload is going to deliver its label.
  const selectedOptions = selectedValues.flatMap(
    (selected): AutocompleteOption[] => {
      const known = knownOptions.get(valueKey(selected));
      if (known) return [known];
      return pendingValues.includes(selected) &&
        !failedValues.has(valueKey(selected))
        ? []
        : [{ label: valueKey(selected), value: selected }];
    },
  );

  useEffect(() => {
    const { loadSelectedOptions: loadSelected } = callbacksRef.current;

    if (!loadSelected || !pendingKey) return;

    const values = JSON.parse(pendingKey) as AutocompleteValue[];
    const controller = new AbortController();
    const { signal } = controller;

    const keys = values.map(valueKey);

    const settle = (items: AutocompleteOption[], failed: boolean) => {
      setPreloadedOptions((prev) => [...prev, ...items]);
      setSettledValues((prev) => new Set([...prev, ...keys]));
      setFailedValues((prev) =>
        failed
          ? new Set([...prev, ...keys])
          : new Set([...prev].filter((key) => !keys.includes(key))),
      );
    };

    // The executor catches a synchronous throw too, just as loadPage does.
    new Promise<TItem[]>((resolve) => resolve(loadSelected(values, { signal })))
      .then((items) => {
        if (signal.aborted) return;

        const { getOptionGroup, getOptionLabel, getOptionValue } =
          callbacksRef.current;
        settle(
          items.map((item) =>
            createOption(item, getOptionLabel, getOptionValue, getOptionGroup),
          ),
          false,
        );
      })
      .catch((loadError) => {
        if (signal.aborted) return;

        logger.error("Failed to load the selected options", loadError);
        callbacksRef.current.onLoadError?.(loadError);
        settle([], true);
      });

    // Unmounted, or other values to load
    return () => controller.abort();
  }, [pendingKey]);

  // In single mode the input shows the selection unless the user is typing -
  // its label must not be searched on, otherwise reopening the list would
  // narrow it down to the already selected option. Spaces around the term
  // are no part of it - a phone keyboard adds one after a word it completes.
  const searchTerm = asSelect ? "" : (search ?? "").trim();
  const depsKey = JSON.stringify(loadOptionsDeps ?? []);
  // A different page size changes page boundaries too - the page counter,
  // offset and cursor must start over rather than continue the old list.
  const requestKey = `${depsKey}\u0000${pageSize}\u0000${searchTerm}`;

  // The list on screen belongs to an older search - it is being replaced
  const isStale = isAsync && open && listKey !== requestKey;

  // A list that failed to load shows an error while the list stays open -
  // retrying then would repeat the failure in a loop. The next opening loads
  // it again, as it loads every list again.
  const loadFailed = !isStale && failedKey !== null && failedKey === listKey;

  if (!open && failedKey !== null) setFailedKey(null);

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const listboxId = `${generatedId}-listbox`;
  const optionId = (index: number) => `${generatedId}-option-${index}`;

  // The request in flight - a newer one aborts it, so that a slow response
  // cannot overwrite the results of a later one.
  const pendingRequest = useRef<AbortController | null>(null);
  // Activity disconnects effects while preserving the list's state. A
  // canceled request leaves that list incomplete and must be retried on reveal.
  const interruptedRequest = useRef(false);
  // Items and pages received for the current list (offset / page params)
  const receivedCount = useRef(0);
  const loadedPages = useRef(0);
  const loadedValues = useRef(new Set<string>());

  // Loads a page of options - the first one replaces the list, the next ones
  // are appended to it. `keep` loads the first page of the list on screen
  // again: its options stay until the new ones arrive.
  const loadPage = useCallback(
    (
      key: string,
      searchValue: string,
      append: boolean,
      pageCursor: string | null,
      keep: boolean,
    ) => {
      const { loadOptions: load } = callbacksRef.current;

      if (!load) return;

      pendingRequest.current?.abort();

      const controller = new AbortController();
      pendingRequest.current = controller;
      interruptedRequest.current = false;

      if (append) {
        setLoadingMore(true);
      } else {
        receivedCount.current = 0;
        loadedPages.current = 0;
        loadedValues.current = new Set();
        setListKey(key);
        if (!keep) setLoadedOptions([]);
        setCursor(null);
        setHasMore(false);
        setLoadingFirstPage(true);
        setLoadingMore(false);
        setListOutdated(false);
        // A failure of an earlier load of this list is no longer the news
        setFailedKey(null);
      }

      const offset = receivedCount.current;
      const page = loadedPages.current + 1;

      // A promise chain - the React Compiler cannot compile try / finally.
      // The executor turns an error `load` throws into a rejection too.
      new Promise<LoadOptionsResult<TItem>>((resolve) => {
        resolve(
          load({
            after: append ? pageCursor : null,
            cursor: append ? pageCursor : null,
            first: pageSize,
            offset,
            page,
            pageSize,
            search: searchValue,
            signal: controller.signal,
          }),
        );
      })
        .then((result) => {
          if (controller.signal.aborted) return;

          const normalized = normalizeLoadOptionsResult(result, offset);
          const { getOptionGroup, getOptionLabel, getOptionValue } =
            callbacksRef.current;

          const newOptions = normalized.items
            .map((item) =>
              createOption(
                item,
                getOptionLabel,
                getOptionValue,
                getOptionGroup,
              ),
            )
            .filter((option) => {
              const key = valueKey(option.value);
              if (loadedValues.current.has(key)) return false;
              loadedValues.current.add(key);
              return true;
            });

          receivedCount.current = offset + normalized.items.length;
          loadedPages.current = page;

          setLoadedOptions((prev) =>
            append ? [...prev, ...newOptions] : newOptions,
          );
          // The key starts with the deps - JSON, which has no NUL of its own
          const deps = key.slice(0, key.indexOf("\u0000"));
          setDeliveredOptions((prev) => {
            const options = new Map(
              prev.depsKey === deps ? prev.options : undefined,
            );
            for (const option of newOptions) {
              options.set(valueKey(option.value), option);
            }
            return { depsKey: deps, options };
          });
          setCursor(normalized.nextCursor);
          // A page that brings nothing new ends the list - guards against an
          // API that ignores the paging parameters
          setHasMore(normalized.hasMore && newOptions.length > 0);
        })
        .catch((loadError) => {
          if (controller.signal.aborted) return;

          logger.error("Failed to load the options", loadError);
          setHasMore(false);
          setFailedKey(key);
          callbacksRef.current.onLoadError?.(loadError);
        })
        .finally(() => {
          if (pendingRequest.current !== controller) return;

          pendingRequest.current = null;
          setLoadingFirstPage(false);
          setLoadingMore(false);
        });
    },
    [pageSize],
  );

  const [debouncedLoadPage] = useState(() =>
    debounce(
      (load: typeof loadPage, key: string, searchValue: string) =>
        load(key, searchValue, false, null, false),
      SEARCH_DEBOUNCE,
    ),
  );

  useEffect(
    () => () => {
      debouncedLoadPage.cancel();
      const controller = pendingRequest.current;
      if (controller) {
        interruptedRequest.current = true;
        pendingRequest.current = null;
        controller.abort();
      }
    },
    [debouncedLoadPage],
  );

  // The search term owns the fetching: an empty one loads the unfiltered list
  // right away, typing reloads it from the server (debounced). Every opening
  // loads the list on screen again - the data may have changed since - and
  // shows it until the new one arrives.
  useEffect(() => {
    const isCurrent = listKey === requestKey;

    if (
      !open ||
      !isAsync ||
      (isCurrent && !listOutdated && !interruptedRequest.current)
    ) {
      // A search still waiting for its debounce is outdated - the list
      // closed, or the term went back to the one on screen
      debouncedLoadPage.cancel();
      return;
    }

    if (searchTerm && !isCurrent) {
      debouncedLoadPage(loadPage, requestKey, searchTerm);
      return;
    }

    debouncedLoadPage.cancel();

    // A microtask keeps the loading state out of the effect body, which the
    // React Compiler would flag as a cascading render. It is dropped when the
    // field unmounts, or the list closes or changes, before it runs.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadPage(requestKey, searchTerm, false, null, isCurrent);
    });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedLoadPage,
    isAsync,
    listKey,
    listOutdated,
    loadPage,
    open,
    requestKey,
    searchTerm,
  ]);

  const baseOptions = isAsync
    ? isStale
      ? []
      : loadedOptions
    : (staticOptions ?? []);

  // In async mode `loadOptions` already filtered the options; filtering them
  // again by their label would drop matches on fields the label does not show
  // (phone, notes, …). The static list is matched ignoring case and
  // diacritics, so "cilovy" still finds "Cílový" - unless `filterOptions`
  // picks the options itself.
  const filteredOptions = asSelect
    ? baseOptions
    : filterOptions
      ? filterOptions(baseOptions, searchTerm)
      : isAsync
        ? baseOptions
        : defaultFilterOptions(baseOptions, searchTerm);

  const isLoadingList = isStale || loadingFirstPage;

  // With `maxSelections` reached, only the selected options can be picked -
  // to remove them (and the empty option, which removes them all)
  const selectionLimit = multiple ? maxSelections : undefined;
  const limitReached =
    selectionLimit !== undefined && selectedValues.length >= selectionLimit;

  // "Add “…”" - while the list shows no option the term names exactly (nor
  // is one selected), once it is known what the list has for the term
  const foldedTerm = normalizeText(searchTerm);
  const namesTerm = (option: AutocompleteOption) =>
    normalizeText(option.label) === foldedTerm;
  const addOption: AutocompleteOption | null =
    onCreate &&
    !asSelect &&
    !locked &&
    foldedTerm !== "" &&
    !isLoadingList &&
    !loadFailed &&
    !filteredOptions.some(namesTerm) &&
    !selectedOptions.some(namesTerm)
      ? {
          label: formatMessage(
            creating === searchTerm
              ? messages.autocomplete.creating
              : messages.autocomplete.create,
            { value: searchTerm },
          ),
          value: ADD_VALUE,
        }
      : null;

  // "Select all" - of the options the list shows that can be picked, when
  // `maxSelections` lets them all be selected
  const hasSelectAll = selectAll !== false && multiple && !isAsync && !locked;
  const pickableOptions = hasSelectAll
    ? filteredOptions.filter((option) => !option.disabled)
    : [];
  const allSelected =
    pickableOptions.length > 0 && pickableOptions.every(isSelected);
  const selectAllOption: AutocompleteOption | null =
    hasSelectAll &&
    pickableOptions.length > 0 &&
    (selectionLimit === undefined ||
      new Set([
        ...selectedValues.map(valueKey),
        ...pickableOptions.map((option) => valueKey(option.value)),
      ]).size <= selectionLimit)
      ? {
          label:
            typeof selectAll === "string"
              ? selectAll
              : messages.autocomplete.selectAll,
          value: SELECT_ALL_VALUE,
        }
      : null;

  // The rows of the list in their order, and the groups they are listed in
  const { listed: displayedOptions, sections } = arrangeOptions(
    [
      ...(asSelect && hasEmpty ? [EMPTY_OPTION] : []),
      ...(selectAllOption ? [selectAllOption] : []),
    ],
    filteredOptions,
    addOption ? [addOption] : [],
  );

  const limitMessage = limitReached
    ? formatPlural(
        locale.code,
        messages.autocomplete.maxSelections,
        selectionLimit,
      )
    : "";

  // What the live region beside the field tells screen readers about the
  // open list: that it loads, or how many options it found - also none -
  // and that the term can be added, after the reached `maxSelections`, a
  // sentence. A failure is an alert of its own.
  const resultsText =
    isLoadingList && filteredOptions.length === 0
      ? messages.autocomplete.loading
      : filteredOptions.length === 0
        ? messages.autocomplete.noResults
        : formatPlural(
            locale.code,
            messages.autocomplete.resultCount,
            filteredOptions.length,
          );
  const listStatus =
    open && !loadFailed
      ? [
          limitMessage,
          addOption
            ? formatMessage(messages.autocomplete.createHint, {
                results: resultsText,
                value: searchTerm,
              })
            : resultsText,
        ]
          .filter(Boolean)
          .join(" ")
      : "";
  const announcedStatus = useDebouncedValue(listStatus, ANNOUNCE_DELAY);

  // The rows the field adds itself are no options of the list
  const isOwnRow = (option: AutocompleteOption) =>
    option === EMPTY_OPTION ||
    option.value === ADD_VALUE ||
    option.value === SELECT_ALL_VALUE;

  const isDisabled = (option: AutocompleteOption) =>
    option.value === ADD_VALUE
      ? creating !== null || limitReached
      : option.value === SELECT_ALL_VALUE
        ? false
        : !!option.disabled ||
          (limitReached && option !== EMPTY_OPTION && !isSelected(option));

  // "Select all" is selected while all it selects are
  const isRowSelected = (option: AutocompleteOption) =>
    option.value === SELECT_ALL_VALUE ? allSelected : isSelected(option);

  // A key per row - its value, and for the second option with the same value
  // (a mistake of the options, or a static "" next to the empty option) the
  // number of the repetition too, so that the rows and the highlight stay
  // apart
  const valueCounts = new Map<string, number>();
  const rowKeys = displayedOptions.map((option) => {
    const key = valueKey(option.value);
    const count = valueCounts.get(key) ?? 0;
    valueCounts.set(key, count + 1);
    return count === 0 ? key : `${key}\u0000${count}`;
  });
  const duplicateValues = [...valueCounts]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const duplicatesKey = duplicateValues.length
    ? JSON.stringify(duplicateValues)
    : "";

  useEffect(() => {
    if (!duplicatesKey) return;
    logger.warn(
      `Autocomplete: several options have the same value (${duplicatesKey.slice(1, -1)}) - the field tells them apart by their value, so a selected one shows all of them as selected. Give every option a value of its own.`,
    );
  }, [duplicatesKey]);

  const activeIndex = activeKey === null ? -1 : rowKeys.indexOf(activeKey);

  const setActiveIndex = (index: number) => {
    setActiveKey(rowKeys[index] ?? null);
  };

  // Virtualization: the rows - the options and the heading of each group -
  // of which those in view are rendered, and the highlighted one wherever it
  // is (`aria-activedescendant` points to it)
  const listRows = virtualized ? buildListRows(sections, rowKeys) : null;
  const activeRow =
    activeIndex < 0
      ? -1
      : listRows
        ? listRows.rowOfOption[activeIndex]
        : activeIndex;
  const virtualList = useVirtualList({
    enabled: virtualized && open,
    keepRows: activeRow >= 0 ? [activeRow] : [],
    listElement,
    rows: listRows?.rows ?? NO_ROWS,
  });

  const pointerMoved = usePointerMoved();

  // Only a real move of the pointer highlights the option under it, not the
  // list scrolling beneath it from the keyboard
  const handleHover = (event: React.MouseEvent, index: number) => {
    if (pointerMoved(event)) setActiveIndex(index);
  };

  // The first option from `index` on (towards the end with `step` 1, the
  // start with -1) the highlight can move to - -1 for none
  const findEnabled = (index: number, step: 1 | -1) => {
    for (let i = index; i >= 0 && i < displayedOptions.length; i += step) {
      if (!isDisabled(displayedOptions[i])) return i;
    }
    return -1;
  };

  // Set when a select opens - its highlight is brought into view once the
  // list shows it
  const revealActive = useRef(false);

  const openList = () => {
    if (locked || open) return;

    // A select opens on its selection, as a native one: the arrow keys go on
    // from there, and it is what assistive technology reads (the APG
    // select-only combobox). A loaded list finds it by its value once there.
    const selectedIndex = asSelect
      ? displayedOptions.findIndex(isSelected)
      : -1;
    setActiveKey(
      selectedIndex >= 0
        ? rowKeys[selectedIndex]
        : asSelect && selectedValues.length > 0
          ? valueKey(selectedValues[0])
          : null,
    );
    revealActive.current = asSelect;
    setOpen(true);
    setCreatedMessage("");
    if (isAsync) setListOutdated(true);

    // The labels whose loading failed are asked for again - once per opening
    if (failedValues.size > 0) {
      setSettledValues(
        (prev) => new Set([...prev].filter((key) => !failedValues.has(key))),
      );
    }
  };

  const closeList = () => {
    if (!open) return;
    setOpen(false);
    setActiveIndex(-1);
    revealActive.current = false;
    // Back to showing the selection - typed text of its own stays, to be
    // taken as the focus leaves
    if (!multiple && !allowCustomValue) setSearch(null);
  };

  const commit = (
    values: AutocompleteValue[],
    lookup: Map<string, AutocompleteOption> = knownOptions,
  ) => {
    if (!multiple) cancelCreation();
    setInteracted(true);

    // A single empty value clears the field, also when it came from an
    // option - the same normalization as controlled and default values.
    const nextValues = multiple ? values : toValues(values[0]);
    if (!isControlled) setInternalValues(nextValues);

    const items = nextValues.map(
      (selected) =>
        (lookup.get(valueKey(selected))?.data as TItem | undefined) ?? null,
    );

    if (multiple) {
      reportChange?.(nextValues, items);
    } else {
      reportChange?.(nextValues[0] ?? null, items[0] ?? null);
    }
  };

  // Adds the options "Select all" stands for - or, all of them selected,
  // removes them
  const toggleAll = () => {
    const shownKeys = new Set(
      pickableOptions.map((option) => valueKey(option.value)),
    );

    commit(
      allSelected
        ? selectedValues.filter(
            (selected) => !shownKeys.has(valueKey(selected)),
          )
        : [
            ...selectedValues,
            ...pickableOptions
              .filter((option) => !selectedKeys.has(valueKey(option.value)))
              .map((option) => option.value),
          ],
    );

    if (closeOnSelect) closeList();
  };

  // The latest selection, limit and `commit` for an option added once a
  // promise resolves - the selection or its limit may have changed meanwhile
  const mountedRef = useRef(false);
  const latestRef = useRef({
    commit,
    knownOptions,
    selectedValues,
    selectionLimit,
  });

  useInsertionEffect(() => {
    // Controlled values and synchronized defaults can change without a
    // field event. They take precedence over a pending single creation too.
    const previousValues = latestRef.current.selectedValues;
    if (
      !multiple &&
      creating !== null &&
      (selectedValues.length !== previousValues.length ||
        selectedValues.some(
          (selected, index) => !sameValue(selected, previousValues[index]),
        ))
    ) {
      // Invalidate now, also when hidden. Insertion effects cannot update
      // state, so clear the pending UI after this commit finishes.
      const version = ++createVersion.current;
      queueMicrotask(() => {
        if (mountedRef.current && createVersion.current === version) {
          setCreating(null);
          setCreateError(null);
        }
      });
    }
    latestRef.current = {
      commit,
      knownOptions,
      selectedValues,
      selectionLimit,
    };
  });

  // Pending creation belongs to the field's actual lifetime: Activity can
  // hide it while the promise settles, without discarding the outcome.
  useInsertionEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // "Add “…”": `onCreate` makes an option of the typed term, which is then
  // selected (added in multiple mode) and announced - or fails, and the
  // list says why
  const addTypedOption = () => {
    if (!onCreate || creating !== null) return;

    const term = searchTerm;
    const version = ++createVersion.current;
    setCreating(term);
    setCreateError(null);
    setCreatedMessage("");

    // A promise chain - the React Compiler cannot compile try / finally.
    // The executor turns an error `onCreate` throws into a rejection too.
    new Promise<TItem | AutocompleteOption>((resolve) => {
      resolve(onCreate(term));
    })
      .then((created) => {
        if (!mountedRef.current || createVersion.current !== version) return;

        // Read like the options of the field - static ones of the shape of
        // `options`, others by the `getOption…` functions
        const { getOptionGroup, getOptionLabel, getOptionValue } =
          callbacksRef.current;
        const option = isAsync
          ? createOption(
              created as TItem,
              getOptionLabel,
              getOptionValue,
              getOptionGroup,
            )
          : normalizeStaticOption(
              created,
              getOptionLabel,
              getOptionValue,
              getOptionGroup,
            );
        const latest = latestRef.current;
        const lookup = new Map(latest.knownOptions).set(
          valueKey(option.value),
          option,
        );

        setPickedOptions((prev) =>
          prev.some((picked) => sameValue(picked.value, option.value))
            ? prev
            : [...prev, option],
        );

        if (!multiple) {
          latest.commit([option.value], lookup);
        } else if (
          (latest.selectionLimit === undefined ||
            latest.selectedValues.length < latest.selectionLimit) &&
          !latest.selectedValues.some((selected) =>
            sameValue(selected, option.value),
          )
        ) {
          latest.commit([...latest.selectedValues, option.value], lookup);
        }

        // The term is now the option - unless the user typed on meanwhile
        setSearch((current) =>
          current !== null && current.trim() === term ? null : current,
        );
        if (!multiple || closeOnSelect) {
          setOpen(false);
          setActiveKey(null);
          revealActive.current = false;
        }
        setCreatedMessage(
          formatMessage(messages.autocomplete.created, { value: option.label }),
        );
      })
      .catch((createFailure) => {
        if (!mountedRef.current || createVersion.current !== version) return;
        logger.error("Failed to add the option", createFailure);

        setCreateError({
          message: getErrorMessage(
            createFailure,
            formatMessage(messages.autocomplete.createError, { value: term }),
          ),
          search: term,
        });
      })
      .finally(() => {
        if (mountedRef.current && createVersion.current === version) {
          setCreating(null);
        }
      });
  };

  const handleSelect = (option: AutocompleteOption) => {
    if (option.value === ADD_VALUE) {
      if (!isDisabled(option)) addTypedOption();
      return;
    }

    if (option.value === SELECT_ALL_VALUE) {
      toggleAll();
      return;
    }

    // Picking the selection again changes nothing - as in a native select,
    // which a select opens on
    if (option === EMPTY_OPTION) {
      if (selectedValues.length > 0) commit([]);
      closeList();
      return;
    }

    if (isDisabled(option)) return;

    setPickedOptions((prev) =>
      prev.some((picked) => sameValue(picked.value, option.value))
        ? prev
        : [...prev, option],
    );

    const lookup = new Map(knownOptions).set(valueKey(option.value), option);

    if (multiple) {
      commit(
        isSelected(option)
          ? selectedValues.filter(
              (selected) => !sameValue(selected, option.value),
            )
          : [...selectedValues, option.value],
        lookup,
      );

      if (closeOnSelect) closeList();
    } else {
      if (selectedValues.length !== 1 || !isSelected(option)) {
        commit([option.value], lookup);
      } else {
        cancelCreation();
      }
      setSearch(null);
      setOpen(false);
      setActiveIndex(-1);
      revealActive.current = false;
    }
  };

  const handleRemove = (removedValue: AutocompleteValue) => {
    commit(
      selectedValues.filter((selected) => !sameValue(selected, removedValue)),
    );
  };

  // `allowCustomValue`: the typed text (without the spaces around it) -
  // `null` while the field shows its value - and the option it names, which
  // it stands for then
  const typedText = allowCustomValue && search !== null ? search.trim() : null;
  // The option is looked for in the list of the typed term - until it is
  // there (loading, or failed), among the options known already: the
  // selected ones and those the lists for these deps delivered, filtered as
  // the list would be. How fast the user types does not decide the value.
  const typedCandidates = () => {
    if (
      !isAsync ||
      (listKey === requestKey && !loadingFirstPage && !loadFailed)
    ) {
      return filteredOptions;
    }
    const known = [
      ...selectedOptions,
      ...(deliveredOptions.depsKey === depsKey
        ? deliveredOptions.options.values()
        : []),
    ];
    return filterOptions ? filterOptions(known, searchTerm) : known;
  };
  const typedOption = typedText
    ? typedCandidates().find((option) => !option.disabled && namesTerm(option))
    : undefined;

  // Takes the typed text as the value - the option it names, or the text
  // itself - as the focus leaves the field, or on Enter
  const commitTyped = () => {
    if (typedText === null) return;
    setSearch(null);

    if (typedText === "") {
      if (selectedValues.length > 0) commit([]);
      return;
    }

    const option = typedOption ?? { label: typedText, value: typedText };
    if (selectedValues.length === 1 && isSelected(option)) return;

    setPickedOptions((prev) => [
      ...prev.filter((picked) => !sameValue(picked.value, option.value)),
      option,
    ]);
    commit(
      [option.value],
      new Map(knownOptions).set(valueKey(option.value), option),
    );
  };

  // Set while the field moves the focus into its input itself - that focus
  // does not open the list, only the one the user moves there does
  const focusingInput = useRef(false);

  const focusInput = () => {
    focusingInput.current = true;
    inputRef.current?.focus();
    focusingInput.current = false;
  };

  // Set when the window loses the focus while it is in the combobox - the
  // combobox stays the active element then, and the popover closes the list.
  // The focus coming back with the window is no focus the user moves into
  // the field: it brings the list back as it was, open or closed.
  const leftWindow = useRef<{ open: boolean } | null>(null);

  const handleComboboxBlur = (event: React.FocusEvent) => {
    const windowLeft =
      getActiveElement(
        event.currentTarget.getRootNode() as Document | ShadowRoot,
      ) === event.currentTarget;
    leftWindow.current = windowLeft ? { open } : null;

    // The focus left the field - not only the window
    if (!windowLeft) {
      commitTyped();
      setCreatedMessage("");
    }
  };

  const handleComboboxFocus = (event: React.FocusEvent) => {
    if (event.target !== inputRef.current) return;

    const returning = leftWindow.current;
    leftWindow.current = null;

    if (returning) {
      if (returning.open) openList();
    } else if (!asSelect && !focusingInput.current) {
      openList();
    }
  };

  // The focus moves on to the chip taking the place of the removed one, or
  // to the input after the last one - it would be lost with the chip
  const removeChip = (chip: HTMLElement, removedValue: AutocompleteValue) => {
    const next = chip.nextElementSibling;

    if (next instanceof HTMLElement && next.getAttribute("role") === "button") {
      next.focus();
    } else {
      focusInput();
    }
    handleRemove(removedValue);
  };

  // The button goes away with the value - the focus on it moves to the input
  const handleClear = (button: HTMLElement) => {
    if (
      button === getActiveElement(button.getRootNode() as Document | ShadowRoot)
    ) {
      focusInput();
    }
    if (selectedValues.length > 0) commit([]);
    else if (!multiple) cancelCreation();
    setSearch(null);
  };

  // Scrolling to the end of the list loads more options
  const canLoadMore = isAsync ? hasMore : !!loadMore && hasMoreOptions;

  const loadNextPage = () => {
    if (loadingMore || isLoadingList || !canLoadMore) return;

    if (isAsync) {
      loadPage(requestKey, searchTerm, true, cursor, false);
    } else if (loadMore) {
      setLoadingMore(true);
      // A synchronous throw is a failed load too - the loading flag must
      // clear so that the next scroll can retry it.
      new Promise<void>((resolve) => resolve(loadMore()))
        .catch((loadError) =>
          logger.error("Failed to load more options", loadError),
        )
        .finally(() => setLoadingMore(false));
    }
  };

  const handleScroll = () => {
    const content = popoverContentRef.current;

    if (!content) return;

    const { clientHeight, scrollHeight, scrollTop } = content;

    if (scrollTop + clientHeight < scrollHeight - 10) return;

    loadNextPage();
  };

  const handleScrollRef = useRef(handleScroll);

  useEffect(() => {
    handleScrollRef.current = handleScroll;
  });

  // A page too short to fill the list leaves nothing to scroll to its end -
  // after every page, check whether the list shows its end already. A
  // static `loadMore` that brought no new options is not called again for
  // the same options, or it would be called in a loop.
  const staticCount = staticOptions?.length ?? 0;
  const filledStaticCount = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !canLoadMore || loadingMore) return;

    let frame = 0;

    const checkFilled = (framesWaited: number) => {
      const content = popoverContentRef.current;

      // The list is rendered into a portal a frame or two after the popover
      // opens
      if (!content) {
        if (framesWaited < 5) {
          frame = requestAnimationFrame(() => checkFilled(framesWaited + 1));
        }
        return;
      }

      // A list that is not laid out (yet) has no height to fill
      if (
        !content.clientHeight ||
        content.scrollHeight > content.clientHeight
      ) {
        return;
      }

      if (!isAsync) {
        if (filledStaticCount.current === staticCount) return;
        filledStaticCount.current = staticCount;
      }

      handleScrollRef.current();
    };

    frame = requestAnimationFrame(() => checkFilled(0));

    return () => cancelAnimationFrame(frame);
  }, [canLoadMore, filteredOptions, isAsync, loadingMore, open, staticCount]);

  useEffect(() => {
    if (!open) return;

    let content: HTMLDivElement | null = null;
    const onScroll = () => handleScrollRef.current();

    // The list is rendered into a portal after the popover opens
    const timeoutId = setTimeout(() => {
      content = popoverContentRef.current;
      content?.addEventListener("scroll", onScroll);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      content?.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  // The list is rendered into a portal a frame or two after it opens, a
  // loaded one once it arrives - the highlight of an opening select is
  // brought into view then
  useEffect(() => {
    if (!open || !revealActive.current) return;

    let frame = 0;
    const reveal = (framesWaited: number) => {
      const content = popoverContentRef.current;
      const option =
        activeIndex >= 0 && content
          ? getElementByIdAt(content, optionId(activeIndex))
          : null;

      if (option) {
        revealActive.current = false;
        option.scrollIntoView({ block: "nearest" });
      } else if (framesWaited < 5) {
        frame = requestAnimationFrame(() => reveal(framesWaited + 1));
      }
    };
    reveal(0);

    return () => cancelAnimationFrame(frame);
  });

  // Brings the option at `index` into view - with the heading of its group
  // when it is the first option there. A virtualized option that is not
  // rendered yet is scrolled to by where it is estimated to be.
  const revealOption = (index: number) => {
    const headed = sections.some(
      (section) => section.start === index && section.label !== undefined,
    );
    const content = popoverContentRef.current;
    const option = content ? getElementByIdAt(content, optionId(index)) : null;

    if (option) {
      if (headed) {
        option.parentElement?.firstElementChild?.scrollIntoView({
          block: "nearest",
        });
      }
      option.scrollIntoView({ block: "nearest" });
    } else if (listRows) {
      const row = listRows.rowOfOption[index];
      virtualList.scrollToRows(headed ? row - 1 : row, row);
    }
  };

  // Moves the highlight from the keyboard: keeps it in view, and reaching the
  // last option loads the next page as scrolling to it would
  const moveActive = (index: number) => {
    setActiveIndex(index);
    revealOption(index);
    if (findEnabled(index + 1, 1) === -1) loadNextPage();
  };

  // How many options PageUp / PageDown move by - those a view of the list
  // holds, but one
  const pageStep = () => {
    const viewHeight = popoverContentRef.current?.clientHeight ?? 0;
    const content = popoverContentRef.current;
    const optionHeight = content
      ? (getElementByIdAt(
          content,
          optionId(Math.max(activeIndex, 0)),
        )?.getBoundingClientRect().height ?? 0)
      : 0;

    return viewHeight > 0 && optionHeight > 0
      ? Math.max(Math.floor(viewHeight / optionHeight) - 1, 1)
      : DEFAULT_PAGE_STEP;
  };

  // PageUp / PageDown: the highlight moves by a view of the list, to the
  // first or last option at most
  const movePage = (step: 1 | -1) => {
    const count = displayedOptions.length;
    if (count === 0) return;

    const target = Math.min(
      Math.max(activeIndex + step * pageStep(), 0),
      count - 1,
    );
    const next = findEnabled(target, step);
    const index = next >= 0 ? next : findEnabled(target, step === 1 ? -1 : 1);
    if (index >= 0) moveActive(index);
  };

  // Opens a select with the option at `index` highlighted (none for -1) -
  // brought into view once the list shows it. The list is not there yet to
  // scroll or to load its next page, as `moveActive` does.
  const openListOn = (index: number) => {
    openList();
    if (index >= 0) setActiveIndex(index);
  };

  // A select picks the highlighted option with Enter or Space, like a
  // native one - or just closes without one
  const pickActive = () => {
    const option = displayedOptions[activeIndex];

    if (option) {
      handleSelect(option);
    } else {
      closeList();
    }
  };

  // The text typed into a select - letters in quick succession are one
  // search (`time` of the last one)
  const typeAhead = useRef({ text: "", time: 0 });

  // A select moves the highlight to the next option starting with the
  // typed text, as a native one does - opening the list first
  const highlightTyped = (letter: string, time: number) => {
    const previous = typeAhead.current;
    const text =
      (time - previous.time < TYPE_AHEAD_TIMEOUT ? previous.text : "") +
      normalizeText(letter);
    typeAhead.current = { text, time };

    // The search goes on from the highlighted option - from the selected one
    // in a closed select, as in a native one - around the end of the list
    const current = open ? activeIndex : displayedOptions.findIndex(isSelected);
    const count = displayedOptions.length;
    const startsWith = (prefix: string, start: number) =>
      Array.from(
        { length: count },
        (_, offset) => (start + offset) % count,
      ).find((index) => {
        const option = displayedOptions[index];
        return (
          !isDisabled(option) &&
          !isOwnRow(option) &&
          normalizeText(option.label).startsWith(prefix)
        );
      });

    // A letter - also the same one again - moves on to the next option
    // starting with it. Further letters narrow the search down from the
    // highlighted option itself: "br" stays on "Brno" that "b" moved to.
    const repeated = [...text].every((char) => char === text[0]);
    const match = repeated
      ? (startsWith(text, current + 1) ?? startsWith(text[0], current + 1))
      : startsWith(text, Math.max(current, 0));

    if (match === undefined) {
      // Nothing starts so - the next letter starts a new search
      typeAhead.current = { text: "", time };
      return;
    }

    if (open) {
      moveActive(match);
    } else {
      openListOn(match);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // A read-only field takes no keys - Enter in its input submits the form,
    // as in a read-only text input
    if (readOnly) return;

    // The keys of a chip are its own - only Escape closes the list from it
    if (event.target !== inputRef.current && event.key !== "Escape") return;

    // The keys of an input method editor (IME) composing text - Enter
    // confirms the conversion, the arrows pick a candidate. Safari sends the
    // confirming Enter after `compositionend`, with the key code 229.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    // The input is read-only while the selected labels load - the popover
    // would take Enter and Space as the keys of its trigger and toggle.
    // Enter in the closed field still submits the form, as when loaded.
    if (
      isPreloading &&
      !asSelect &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      const input = inputRef.current;
      if (event.key === "Enter" && !open && input instanceof HTMLInputElement) {
        input.form?.requestSubmit();
      }
      return;
    }

    // A space typed while a search of a select is going on is part of it -
    // "New Y" goes on to "New York" - as in a native select; otherwise it
    // picks the highlighted option
    const typingAhead =
      typeAhead.current.text !== "" &&
      event.timeStamp - typeAhead.current.time < TYPE_AHEAD_TIMEOUT;

    if (
      asSelect &&
      event.key.length === 1 &&
      (event.key !== " " || typingAhead) &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      highlightTyped(event.key, event.timeStamp);
      return;
    }

    // A Space after them picks again
    if (NAVIGATION_KEYS.has(event.key))
      typeAhead.current = { text: "", time: 0 };

    // Enter in a closed typing field submits the form, as in a text input -
    // a select opens on it (the select-only combobox), on the arrow keys on
    // its selection, on Home / End on its first / last option
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        (asSelect &&
          (event.key === "ArrowUp" ||
            event.key === "Enter" ||
            event.key === " "))
      ) {
        event.preventDefault();
        openList();
        return;
      }

      if (asSelect && (event.key === "Home" || event.key === "End")) {
        event.preventDefault();
        openListOn(
          event.key === "Home"
            ? findEnabled(0, 1)
            : findEnabled(displayedOptions.length - 1, -1),
        );
        return;
      }
    }

    switch (event.key) {
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          closeList();
        }
        break;
      case "ArrowDown": {
        event.preventDefault();
        const next = findEnabled(activeIndex + 1, 1);
        if (next >= 0) moveActive(next);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const previous = findEnabled(activeIndex - 1, -1);
        if (previous >= 0) moveActive(previous);
        break;
      }
      // A typing field leaves Home / End to the caret in its text
      case "Home": {
        const first = findEnabled(0, 1);
        if (asSelect && open && first >= 0) {
          event.preventDefault();
          moveActive(first);
        }
        break;
      }
      case "End": {
        const last = findEnabled(displayedOptions.length - 1, -1);
        if (asSelect && open && last >= 0) {
          event.preventDefault();
          moveActive(last);
        }
        break;
      }
      case "PageDown":
      case "PageUp":
        if (open) {
          event.preventDefault();
          movePage(event.key === "PageDown" ? 1 : -1);
        }
        break;
      case " ":
        // Opening is handled above - a typing field types the space
        if (asSelect) {
          event.preventDefault();
          pickActive();
        }
        break;
      case "Enter":
        if (asSelect) {
          event.preventDefault();
          pickActive();
        } else if (open && displayedOptions[activeIndex]) {
          event.preventDefault();
          handleSelect(displayedOptions[activeIndex]);
        } else if (allowCustomValue) {
          // The typed text is the value - and the form is submitted, as
          // from a text input
          commitTyped();
          closeList();
        }
        break;
      case "Tab": {
        // Tab takes the highlighted option of a select as the focus moves
        // on (the select-only combobox) - one to pick, not a toggle of one
        // of several
        const option = displayedOptions[activeIndex];
        if (asSelect && !multiple && open && option && !isDisabled(option)) {
          handleSelect(option);
        }
        break;
      }
      case "Backspace":
        // Multiple mode: backspace in the empty input removes the last chip -
        // not while the chips are still loading, it would remove a value
        // that cannot be seen
        if (multiple && !search && !isPreloading && selectedValues.length > 0) {
          handleRemove(selectedValues[selectedValues.length - 1]);
        }
        break;
      default:
        break;
    }
  };

  const handleInputChange = (text: string) => {
    setSearch(text);
    setActiveIndex(-1);
    setCreatedMessage("");
    if (!open) setOpen(true);

    // Erasing the text of a single selection clears it
    if (!multiple && text === "") {
      if (selectedValues.length > 0) commit([]);
      else cancelCreation();
    }
  };

  // What the field holds - with `allowCustomValue`, the value the typed text
  // stands for, before it is taken as the value: the form gets what the
  // input shows
  const typedValue = typedText ? (typedOption?.value ?? typedText) : null;
  const currentValues =
    typedValue !== null
      ? toValues(typedValue)
      : typedText === ""
        ? []
        : selectedValues;

  // A single field without a value submits an empty one, so that clearing it
  // reaches backends that keep fields missing from the request unchanged. A
  // multiple one submits no value at all rather than [""].
  const submittedValues =
    multiple || currentValues.length > 0 ? currentValues : [""];

  // Hidden inputs are the form value; the validation input lets the browser
  // enforce `required` although the visible input holds no value of its own.
  // Disabled, like a disabled native field, they are neither submitted nor
  // validated - read-only, the value is submitted, not validated.
  const hiddenInputs = (
    <>
      {name &&
        submittedValues.map((selected) => (
          <input
            disabled={disabled}
            form={form}
            key={valueKey(selected)}
            name={name}
            readOnly
            type="hidden"
            value={selected}
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
          onFocus={focusInput}
          onInvalid={(event) => {
            const validationInput = event.currentTarget;
            validationInput.removeAttribute("inert");
            setTimeout(() => validationInput.setAttribute("inert", ""));
          }}
          required
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value={currentValues.length > 0 ? "valid" : ""}
        />
      )}
    </>
  );

  // The combobox - the typing input, or in a select an element without text
  // editing (the APG select-only combobox), which is neither read-only nor
  // autocompleting for assistive technology - unless `readOnly`
  const comboboxProps = {
    "aria-activedescendant":
      open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
    "aria-controls": open ? listboxId : undefined,
    "aria-describedby": joinTokens(errorId, descriptionId, ariaDescribedBy),
    "aria-expanded": open,
    // Also those of `Field` or a form library - on the combobox, not on the
    // element around it
    "aria-invalid": error ? ("true" as const) : ariaInvalid,
    "aria-label": label ? undefined : ariaLabel,
    // Only an input is named by the `<label>` pointing at it
    "aria-labelledby":
      ariaLabelledBy ?? (asSelect && label ? labelId : undefined),
    "aria-readonly": readOnly ? ("true" as const) : undefined,
    "aria-required": required ? ("true" as const) : ariaRequired,
    "data-disabled": disabled ? "" : undefined,
    "data-invalid": error || isAriaInvalid(ariaInvalid) ? "" : undefined,
    "data-readonly": readOnly ? "" : undefined,
    "data-state": open ? ("open" as const) : ("closed" as const),
    id: inputId,
    onBlur: handleComboboxBlur,
    ref: inputCallbackRef,
    role: "combobox",
    // Not focusable while disabled, like a native field
    tabIndex: disabled ? undefined : 0,
  };

  const comboboxClassName = cn(
    "min-w-16 grow focus:outline-hidden",
    asSelect && !locked && "cursor-pointer",
    disabled && "cursor-not-allowed",
  );

  const selectCombobox = (
    text: string | undefined,
    placeholderText?: string,
  ) => (
    <div
      {...comboboxProps}
      aria-disabled={disabled || undefined}
      className={cn(comboboxClassName, "min-h-lh truncate select-none")}
    >
      {text ?? (
        // The color of an input's placeholder
        <span className="text-neutral-500 dark:text-neutral-400">
          {placeholderText}
        </span>
      )}
    </div>
  );

  const typingInputProps = {
    ...comboboxProps,
    "aria-autocomplete": "list" as const,
    autoComplete: "off",
    disabled,
    // Enter submits the form of the field, as in a native one
    form,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      handleInputChange(event.target.value),
    readOnly: isPreloading || locked,
    type: "text",
  };

  // The whole field acts as the input: a press on its padding or chevron
  // keeps the focus in the input (instead of moving it to the wrapper) and a
  // click focuses the input.
  const fieldProps = {
    onClick: (event: React.MouseEvent) => {
      inputRef.current?.focus();
      // A select toggles (the popover does it); a typing field only opens -
      // also when the input had the focus already, after Escape or a
      // keyboard pick
      if (!asSelect) {
        event.stopPropagation();
        openList();
      }
    },
    onMouseDown: (event: React.MouseEvent) => {
      if (event.target !== inputRef.current) event.preventDefault();
    },
  };

  const fieldClassName = cn(
    "w-full items-center rounded-md border border-neutral-300 bg-surface focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700 dark:bg-surface-dark",
    dimStyles[dim],
    // Forced colors draw every border in one color - an outline makes the
    // border of an invalid field thicker
    error &&
      "border-danger-500! focus-within:ring-danger-500! forced-colors:outline-1",
    asSelect && !locked && "cursor-pointer",
    disabled && "cursor-not-allowed opacity-60",
  );

  // No chevron in a read-only field - its list does not open
  const chevron = isPreloading ? (
    // The placeholder says it
    <Spinner aria-hidden="true" size="sm" />
  ) : readOnly ? null : (
    <ChevronDown
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
        open && "rotate-180 transform",
      )}
      size={iconSizes[dim]}
    />
  );

  // `maxVisibleChips`: the chips past it are summed up while the focus is
  // elsewhere
  const chipsCollapsed =
    maxVisibleChips !== undefined &&
    !focused &&
    !open &&
    selectedOptions.length > maxVisibleChips;
  const visibleChips = chipsCollapsed
    ? selectedOptions.slice(0, Math.max(maxVisibleChips, 0))
    : selectedOptions;
  const hiddenChips = selectedOptions.slice(visibleChips.length);

  const chips = visibleChips.map((option) => (
    <Chip
      aria-label={
        locked ? undefined : `${messages.autocomplete.clear} ${option.label}`
      }
      className={cn(chipDimStyles[dim], !locked && "cursor-pointer")}
      key={valueKey(option.value)}
      onClick={
        locked
          ? undefined
          : (event) => {
              event.preventDefault();
              event.stopPropagation();
              handleRemove(option.value);
            }
      }
      onKeyDown={
        locked
          ? undefined
          : (event) => {
              if (
                event.key === "Enter" ||
                event.key === " " ||
                event.key === "Backspace" ||
                event.key === "Delete"
              ) {
                event.preventDefault();
                event.stopPropagation();
                removeChip(event.currentTarget, option.value);
              }
            }
      }
      onMouseDown={
        locked
          ? undefined
          : (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
      }
      role={locked ? undefined : "button"}
      size={chipSizes[dim]}
      tabIndex={locked ? undefined : 0}
    >
      {option.label}
      {!locked && <>&nbsp;×</>}
    </Chip>
  ));

  // The accessible name of the listbox - "Options for City" of a label of
  // text, the label itself of one with markup
  const labelText =
    typeof label === "string" || typeof label === "number"
      ? String(label)
      : null;

  // The rows of the listbox: the options of each group under its heading,
  // and - virtualized - only the rendered rows, with spacers holding the
  // room of the others. Without virtualization all rows are rendered.
  const { measureRef, offsets, renderedRows } = virtualList;
  // `aria-setsize` / `aria-posinset` of a virtualized list - by group, the
  // options outside the groups make a set of their own; unknown while more
  // can load
  const ungroupedCount = sections.reduce(
    (count, section) =>
      section.label === undefined ? count + section.end - section.start : count,
    0,
  );

  const spacer = (key: string, fromRow: number, toRow: number) =>
    offsets && toRow > fromRow ? (
      <li
        aria-hidden="true"
        key={key}
        role="none"
        style={{ height: offsets[toRow] - offsets[fromRow] }}
      />
    ) : null;

  const renderOptionRow = (
    index: number,
    section: ListSection,
    positionInSet: number,
  ) => {
    const option = displayedOptions[index];
    const own = isOwnRow(option) && option !== EMPTY_OPTION;
    const adding = option.value === ADD_VALUE && creating !== null;

    return (
      <OptionRow
        active={index === activeIndex}
        ariaLabel={
          option === EMPTY_OPTION
            ? messages.autocomplete.emptyOption
            : undefined
        }
        content={
          adding ? (
            <span className="flex items-center gap-2">
              {option.label}
              <Spinner aria-hidden="true" size="sm" />
            </span>
          ) : own ? (
            option.label
          ) : undefined
        }
        disabled={isDisabled(option)}
        highlight={highlightMatches && !own}
        id={optionId(index)}
        index={index}
        key={rowKeys[index]}
        measureRef={measureRef}
        onHover={handleHover}
        onSelect={handleSelect}
        option={option}
        posInSet={listRows ? positionInSet : undefined}
        renderOption={renderOption}
        rowKey={listRows ? `o\u0000${rowKeys[index]}` : undefined}
        search={highlightMatches || renderOption ? searchTerm : ""}
        selected={isRowSelected(option)}
        separated={option.value === ADD_VALUE && index > 0}
        setSize={
          listRows
            ? canLoadMore
              ? -1
              : section.label === undefined
                ? ungroupedCount
                : section.end - section.start
            : undefined
        }
      />
    );
  };

  const listContent: React.ReactNode[] = [];
  // Rendered rows are gone through in their order, section by section
  let renderedPointer = 0;
  // The first row of a run of sections none of whose rows is rendered
  let skippedFromRow = -1;
  let ungroupedBefore = 0;
  // A closed list renders no rows - its panel is not there
  const sectionCount = open ? sections.length : 0;

  for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex++) {
    const section = sections[sectionIndex];
    if (section.end === section.start) continue;

    const labeled = section.label !== undefined;
    const firstOptionRow = listRows
      ? listRows.rowOfOption[section.start]
      : section.start;
    const firstRow = labeled ? firstOptionRow - 1 : firstOptionRow;
    const endRow = firstOptionRow + section.end - section.start;

    // The options of the section to render
    const indexes: number[] = [];
    if (renderedRows) {
      while (
        renderedPointer < renderedRows.length &&
        renderedRows[renderedPointer] < endRow
      ) {
        const row = renderedRows[renderedPointer];
        renderedPointer += 1;
        if (row >= firstOptionRow) {
          indexes.push(section.start + row - firstOptionRow);
        }
      }
    } else {
      for (let index = section.start; index < section.end; index++) {
        indexes.push(index);
      }
    }

    const setStart = labeled ? 0 : ungroupedBefore;
    if (!labeled) ungroupedBefore += section.end - section.start;

    if (indexes.length === 0) {
      if (skippedFromRow < 0) skippedFromRow = firstRow;
      continue;
    }

    if (skippedFromRow >= 0) {
      listContent.push(
        spacer(`gap-${skippedFromRow}`, skippedFromRow, firstRow),
      );
      skippedFromRow = -1;
    }

    const rows: React.ReactNode[] = [];
    let nextRow = firstOptionRow;
    for (const index of indexes) {
      const row = firstOptionRow + index - section.start;
      if (row > nextRow) rows.push(spacer(`gap-${nextRow}`, nextRow, row));
      rows.push(
        renderOptionRow(index, section, setStart + index - section.start + 1),
      );
      nextRow = row + 1;
    }
    if (nextRow < endRow) rows.push(spacer(`gap-${nextRow}`, nextRow, endRow));

    if (!labeled) {
      listContent.push(...rows);
      continue;
    }

    const headingId = `${generatedId}-group-${sectionIndex}`;
    listContent.push(
      <li key={`group\u0000${section.label}`} role="none">
        <ul aria-labelledby={headingId} role="group">
          <li
            className="cursor-default px-2 pt-2 pb-1 text-xs font-semibold text-neutral-600 select-none dark:text-neutral-400"
            data-row-key={listRows ? `h\u0000${section.label}` : undefined}
            id={headingId}
            ref={measureRef}
            role="presentation"
          >
            {section.label}
          </li>
          {rows}
        </ul>
      </li>,
    );
  }

  if (skippedFromRow >= 0 && listRows) {
    listContent.push(
      spacer(`gap-${skippedFromRow}`, skippedFromRow, listRows.rows.length),
    );
  }

  // What the live region beside the field says: the option being added, the
  // one just added, else the state of the open list
  const liveText =
    creating !== null
      ? formatMessage(messages.autocomplete.creating, { value: creating })
      : createdMessage || announcedStatus;

  return (
    <div {...props} className={cn("relative", className)}>
      {label && (
        <label
          className="mb-1.5 block text-sm font-medium"
          htmlFor={asSelect ? undefined : inputId}
          id={labelId}
          // A select is no input a `<label>` focuses by itself
          onClick={asSelect ? () => inputRef.current?.focus() : undefined}
        >
          {label}
          {messages.form.labelSuffix}{" "}
          {/* The star is for the eye - `required` tells assistive technology */}
          {required && <RequiredMark />}
        </label>
      )}

      {hiddenInputs}

      <Popover
        className="w-full"
        // The browser keeps no row in place while the rows around it are
        // swapped for spacers - the list does it
        contentClassName={virtualized ? "[overflow-anchor:none]" : undefined}
        contentRef={popoverContentRef}
        // The input is the combobox - the wrapper is no button around it
        interactiveTrigger
        // The focus the user moves into the input of a typing field opens the
        // list - not the one of a chip or the clear button, nor the one the
        // field moves there itself, nor the one the window brings back
        onFocus={handleComboboxFocus}
        onKeyDown={disabled ? undefined : handleKeyDown}
        onOpenChange={(isOpen) => (isOpen ? openList() : closeList())}
        open={open}
        // The panel only wraps the listbox - no unnamed dialog around it
        popupRole="listbox"
        position="bottom"
        trigger={
          multiple ? (
            <div
              {...fieldProps}
              className={cn(
                fieldClassName,
                "flex max-h-40 flex-wrap gap-1 overflow-y-auto",
              )}
              // All chips show while the focus is in the field
              onBlur={
                maxVisibleChips === undefined
                  ? undefined
                  : (event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setFocused(false);
                      }
                    }
              }
              onFocus={
                maxVisibleChips === undefined
                  ? undefined
                  : () => setFocused(true)
              }
            >
              {isPreloading && selectedOptions.length === 0 ? (
                <Chip
                  className={cn(chipDimStyles[dim], "opacity-50")}
                  size={chipSizes[dim]}
                >
                  {messages.autocomplete.loadingSelected}
                </Chip>
              ) : (
                chips
              )}
              {hiddenChips.length > 0 && (
                <Chip
                  className={chipDimStyles[dim]}
                  size={chipSizes[dim]}
                  title={hiddenChips.map((option) => option.label).join(", ")}
                >
                  {formatPlural(
                    locale.code,
                    messages.autocomplete.moreSelected,
                    hiddenChips.length,
                  )}
                </Chip>
              )}
              {asSelect ? (
                selectCombobox(
                  selectedOptions.length ? "" : undefined,
                  placeholder,
                )
              ) : (
                <input
                  {...typingInputProps}
                  // Grows from a narrow start - beside the chips, not below
                  className={cn(comboboxClassName, "w-16")}
                  placeholder={selectedOptions.length ? undefined : placeholder}
                  value={search ?? ""}
                />
              )}
              {chevron}
            </div>
          ) : (
            <div
              {...fieldProps}
              className={cn(fieldClassName, "relative flex")}
            >
              {asSelect ? (
                selectCombobox(
                  selectedOptions[0]?.label,
                  isPreloading
                    ? messages.autocomplete.loadingSelected
                    : placeholder,
                )
              ) : (
                <input
                  {...typingInputProps}
                  className={cn(comboboxClassName, "w-full min-w-0")}
                  placeholder={
                    isPreloading
                      ? messages.autocomplete.loadingSelected
                      : placeholder
                  }
                  value={search ?? selectedOptions[0]?.label ?? ""}
                />
              )}
              {currentValues.length > 0 && !asSelect && !locked && (
                <button
                  aria-label={messages.autocomplete.clear}
                  className={cn(
                    "ms-2 cursor-pointer rounded p-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500",
                    // Over the padding of the small fields, which it would
                    // make taller
                    (dim === "xs" || dim === "sm") && "-my-0.5",
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleClear(event.currentTarget);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      handleClear(event.currentTarget);
                    }
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  type="button"
                >
                  <X
                    aria-hidden="true"
                    className="me-0.5"
                    size={iconSizes[dim]}
                  />
                </button>
              )}
              {chevron}
            </div>
          )
        }
        triggerType="click"
        width="100%"
      >
        <ul
          aria-label={
            labelText
              ? formatMessage(messages.autocomplete.listLabel, {
                  label: labelText,
                })
              : label
                ? undefined
                : ariaLabel
          }
          aria-labelledby={
            label && !labelText
              ? labelId
              : label || ariaLabel
                ? undefined
                : ariaLabelledBy
          }
          aria-multiselectable={multiple || undefined}
          className={listDimStyles[dim]}
          id={listboxId}
          // A click on an option keeps the focus in the input
          onMouseDown={(event) => event.preventDefault()}
          ref={virtualized ? setListElement : undefined}
          role="listbox"
        >
          {listContent}
        </ul>
        {/* The state of the list is no option - it shows beside the listbox,
            in view under a long list. The live region next to the field
            announces it: this one comes and goes with the list, and a live
            region added with its text already in it is not read out. */}
        <div
          className={cn(
            "sticky bottom-0 bg-surface dark:bg-surface-dark",
            listDimStyles[dim],
          )}
          onMouseDown={(event) => event.preventDefault()}
        >
          {/* The empty option of a select is no result, nor is "Add “…”" */}
          {filteredOptions.length === 0 &&
            !isLoadingList &&
            !loadFailed &&
            !addOption && (
              <p className="px-2 py-1 text-sm text-neutral-500 dark:text-neutral-400">
                {messages.autocomplete.noResults}
              </p>
            )}
          {/* Loading shows while the list is empty, or under it when paginating */}
          {((isLoadingList && filteredOptions.length === 0) || loadingMore) && (
            <div className="flex items-center gap-2 p-2">
              {messages.autocomplete.loading}{" "}
              <Spinner aria-hidden="true" size="sm" />
            </div>
          )}
          {limitReached && (
            <p className="border-t border-neutral-200 px-2 py-1 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              {limitMessage}
            </p>
          )}
          {createError && createError.search === searchTerm && (
            <p
              className="border-t border-neutral-200 px-2 py-1 text-sm text-danger-700 dark:border-neutral-700 dark:text-danger-400"
              role="alert"
            >
              {createError.message}
            </p>
          )}
        </div>
        {loadFailed && (
          <p
            className="px-2 py-1 text-sm text-danger-700 dark:text-danger-400"
            onMouseDown={(event) => event.preventDefault()}
            role="alert"
          >
            {messages.autocomplete.loadError}
          </p>
        )}
      </Popover>

      {/* There while the list is open - empty as it opens, the state comes
          after a pause, so it is read out (a region added with its text in
          it would not be) - and not in a page of closed fields. It stays
          while it tells of an option being added or just added. */}
      {(open || creating !== null || createdMessage !== "") && (
        <div className="sr-only" role="status">
          {liveText}
        </div>
      )}

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
