import { ChevronDown, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Chip from "../chip";
import cn from "../../utils/cn";
import debounce from "../../utils/debounce";
import FormDescription from "../form-description";
import FormError from "../form-error";
import logger from "../../utils/logger";
import Popover from "../popover";
import removeDiacritics from "../../utils/remove-diacritics";
import Spinner from "../spinner";
import { formatMessage, formatPlural } from "../../i18n/format";
import {
  useFieldsetDisabled,
  useFormReset,
} from "../../hooks/use-form-control";
import {
  normalizeLoadOptionsResult,
  type LoadOptionsParams,
  type LoadOptionsResult,
} from "./load-options";
import { useLocale, useMessages } from "../../providers/ui-context";

export type {
  LoadOptionsPage,
  LoadOptionsParams,
  LoadOptionsResult,
  RelayConnection,
} from "./load-options";

const DEFAULT_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE = 300;
// Letters typed into a select within this time (ms) are one search
const TYPE_AHEAD_TIMEOUT = 500;

export type AutocompleteValue = string | number;

export interface AutocompleteOption<T = AutocompleteValue> {
  /** Text shown in the list and in the field. */
  label: string;
  /** Reported by `onChange` and submitted with the form. */
  value: T;
  /**
   * The item the option was created from - a loaded one, or a static one
   * read by `getOptionLabel` / `getOptionValue`. `onChange` reports it.
   */
  data?: unknown;
  /** Shown in the list, but cannot be picked. */
  disabled?: boolean;
}

/**
 * Fields the default label and value are read from, unless
 * `getOptionLabel` / `getOptionValue` are given: the label from `label`,
 * `name` or `title`, the value from `value` or `id`.
 */
export interface AutocompleteItem {
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
  "defaultValue" | "onChange" | "children"
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
  /**
   * Disables the field - like a disabled native one, it is then neither
   * submitted nor validated. A disabled `<fieldset>` around it disables it
   * too.
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
  /** Text of the `<label>` above the field. */
  label?: string;
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
   * Several values - `value`, `defaultValue` and `onChange` then work with
   * arrays.
   */
  multiple?: boolean;
  /**
   * Submits the value(s) in hidden inputs of this name, so the field works
   * in a plain `<form>` / `FormData`.
   */
  name?: string;
  /** Shown in the empty field. */
  placeholder?: string;
  /** Custom rendering of an option in the list. */
  renderOption?: (
    option: AutocompleteOption,
    state: { active: boolean; selected: boolean },
  ) => React.ReactNode;
  /** A value must be picked before the form can be submitted. */
  required?: boolean;
  /**
   * Uncontrolled mode: apply every change of `defaultValue`, not only the
   * first one (e.g. when the form is reset with new data).
   */
  syncWithDefaultValue?: boolean;
}

/** The value of a field without `multiple` - one value. */
interface SingleSelectionProps<TItem extends object> {
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
  /** Items per page requested from `loadOptions`. */
  pageSize?: number;
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
   * With `getOptionLabel` / `getOptionValue` they can be items of any shape
   * (each is then its own `data`).
   */
  options: AutocompleteOption[] | NoInfer<TItem>[];
  pageSize?: never;
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

const normalizeText = (text: string) => removeDiacritics(text).toLowerCase();

function createOption<TItem extends object>(
  item: TItem,
  getOptionLabel?: (item: TItem) => string,
  getOptionValue?: (item: TItem) => AutocompleteValue,
): AutocompleteOption {
  const record = item as Record<string, unknown>;
  const fallbackValue = record.value ?? record.id;
  const fallbackLabel = record.label ?? record.name ?? record.title;

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
  };
}

// The option `hasEmpty` adds - blank, but not empty, so it has a height
const EMPTY_OPTION: AutocompleteOption = { label: " ", value: "" };

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

interface OptionRowProps {
  active: boolean;
  /** Accessible name instead of the label (the blank empty option). */
  ariaLabel?: string;
  disabled: boolean;
  id: string;
  index: number;
  onHover: (index: number) => void;
  onSelect: (option: AutocompleteOption) => void;
  option: AutocompleteOption;
  renderOption?: BaseAutocompleteProps["renderOption"];
  selected: boolean;
}

/**
 * An option of the list. A component of its own, so that the compiler
 * memoizes every row - moving the highlight renders the two rows it moves
 * between, not the whole list.
 */
function OptionRow({
  active,
  ariaLabel,
  disabled,
  id,
  index,
  onHover,
  onSelect,
  option,
  renderOption,
  selected,
}: OptionRowProps) {
  return (
    <li
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      aria-selected={selected}
      className={cn(
        "px-2 py-1",
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
      )}
      id={id}
      onClick={disabled ? undefined : () => onSelect(option)}
      onMouseEnter={disabled ? undefined : () => onHover(index)}
      role="option"
    >
      {renderOption ? renderOption(option, { active, selected }) : option.label}
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
 */
export default function Autocomplete<TItem extends object = AutocompleteItem>({
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
  disabled: disabledProp = false,
  error,
  form,
  getOptionLabel,
  getOptionValue,
  hasEmpty = false,
  hasMore: hasMoreOptions = true,
  id,
  label,
  loadMore,
  loadOptions,
  loadOptionsDeps,
  loadSelectedOptions,
  maxSelections,
  multiple = false,
  name,
  onChange,
  onLoadError,
  options,
  pageSize = DEFAULT_PAGE_SIZE,
  placeholder,
  renderOption,
  required,
  syncWithDefaultValue = false,
  value,
  ...props
}: AutocompleteProps<TItem>) {
  const locale = useLocale();
  const messages = useMessages();

  // A select is no native field, and the list opens from the field around
  // the input - a disabled fieldset around them leaves them alone unless told
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;

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

  // Options whose labels stay known after they drop out of the list - the
  // picked ones and the selected ones a loaded page delivered
  const [pickedOptions, setPickedOptions] = useState<AutocompleteOption[]>([]);
  const [preloadedOptions, setPreloadedOptions] = useState<
    AutocompleteOption[]
  >([]);
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
  const [internalValues, setInternalValues] = useState(() =>
    toValues(defaultValue),
  );
  const [interacted, setInteracted] = useState(false);

  const popoverContentRef = useRef<HTMLDivElement>(null);
  // The combobox - the input of a typing field, the element of a select
  const inputRef = useRef<HTMLElement>(null);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue` of an uncontrolled field, like a native field does
  const formResetRef = useFormReset(() => {
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

      return () => {
        inputRef.current = null;
        detachReset?.();
        detachFieldset?.();
      };
    },
    [fieldsetRef, formResetRef],
  );

  // Callers pass the callbacks as inline arrow functions, so their identity
  // changes on every parent render. Keep the latest ones in a ref and let the
  // fetching effects depend on a serialized snapshot of `loadOptionsDeps`
  // instead, so they react to the actual filter values and not to render churn.
  const callbacksRef = useRef({
    getOptionLabel,
    getOptionValue,
    loadOptions,
    loadSelectedOptions,
    onLoadError,
  });

  useEffect(() => {
    callbacksRef.current = {
      getOptionLabel,
      getOptionValue,
      loadOptions,
      loadSelectedOptions,
      onLoadError,
    };
  });

  const isAsync = typeof loadOptions === "function";
  const isControlled = value !== undefined;
  const selectedValues = isControlled ? toValues(value) : internalValues;
  // The props are a union by `multiple` - `commit` passes what the mode takes
  const reportChange = onChange as
    | ((
        value: AutocompleteValue[] | AutocompleteValue | null,
        item: (TItem | null)[] | TItem | null,
      ) => void)
    | undefined;

  // Disabling the field closes its list - for good, not until it is enabled
  // again
  if (disabled && open) {
    setOpen(false);
    setActiveKey(null);
    if (!multiple) setSearch(null);
    if (asSelect && isAsync) setListKey(null);
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

  // Static items of any shape are read like loaded ones
  const staticOptions = useMemo(
    () =>
      options && (getOptionLabel || getOptionValue)
        ? (options as TItem[]).map((item) =>
            createOption(item, getOptionLabel, getOptionValue),
          )
        : (options as AutocompleteOption[] | undefined),
    [getOptionLabel, getOptionValue, options],
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

  const isSelected = (option: AutocompleteOption) =>
    selectedValues.some((selected) => sameValue(selected, option.value));

  // A selected option only the loaded list knows is kept - otherwise a search
  // that drops it from the list would take its label (and chip) with it, or
  // start a preload of the label mid-typing
  const selectedKeys = new Set(selectedValues.map(valueKey));
  const keptKeys = new Set(
    [...preloadedOptions, ...pickedOptions].map((option) =>
      valueKey(option.value),
    ),
  );
  const selectedToKeep = loadedOptions.filter((option) => {
    const key = valueKey(option.value);
    return selectedKeys.has(key) && !keptKeys.has(key);
  });

  if (selectedToKeep.length > 0) {
    setPickedOptions((prev) => [...prev, ...selectedToKeep]);
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

    loadSelected(values, { signal })
      .then((items) => {
        if (signal.aborted) return;

        const { getOptionLabel, getOptionValue } = callbacksRef.current;
        settle(
          items.map((item) =>
            createOption(item, getOptionLabel, getOptionValue),
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
  // narrow it down to the already selected option.
  const searchTerm = asSelect ? "" : (search ?? "");
  const depsKey = JSON.stringify(loadOptionsDeps ?? []);
  const requestKey = `${depsKey}\u0000${searchTerm}`;

  // The list on screen belongs to an older search - it is being replaced
  const isStale = isAsync && open && listKey !== requestKey;

  // A list that failed to load shows an error while the list stays open -
  // retrying then would repeat the failure in a loop. The next opening loads
  // it again.
  const loadFailed = !isStale && failedKey !== null && failedKey === listKey;

  if (!open && failedKey !== null) {
    setFailedKey(null);
    if (listKey === failedKey) setListKey(null);
  }

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
  // Items and pages received for the current list (offset / page params)
  const receivedCount = useRef(0);
  const loadedPages = useRef(0);
  const loadedValues = useRef(new Set<string>());

  // Loads a page of options - the first one replaces the list, the next ones
  // are appended to it.
  const loadPage = useCallback(
    (
      key: string,
      searchValue: string,
      append: boolean,
      pageCursor: string | null,
    ) => {
      const { loadOptions: load } = callbacksRef.current;

      if (!load) return;

      pendingRequest.current?.abort();

      const controller = new AbortController();
      pendingRequest.current = controller;

      if (append) {
        setLoadingMore(true);
      } else {
        receivedCount.current = 0;
        loadedPages.current = 0;
        loadedValues.current = new Set();
        setListKey(key);
        setLoadedOptions([]);
        setCursor(null);
        setHasMore(false);
        setLoadingFirstPage(true);
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
          const { getOptionLabel, getOptionValue } = callbacksRef.current;

          const newOptions = normalized.items
            .map((item) => createOption(item, getOptionLabel, getOptionValue))
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
        load(key, searchValue, false, null),
      SEARCH_DEBOUNCE,
    ),
  );

  useEffect(
    () => () => {
      debouncedLoadPage.cancel();
      pendingRequest.current?.abort();
    },
    [debouncedLoadPage],
  );

  // The search term owns the fetching: an empty one loads the unfiltered list
  // right away, typing reloads it from the server (debounced).
  useEffect(() => {
    if (!open || !isAsync || listKey === requestKey) {
      // A search still waiting for its debounce is outdated - the list
      // closed, or the term went back to the one on screen
      debouncedLoadPage.cancel();
      return;
    }

    if (searchTerm) {
      debouncedLoadPage(loadPage, requestKey, searchTerm);
      return;
    }

    debouncedLoadPage.cancel();

    // A microtask keeps the loading state out of the effect body, which the
    // React Compiler would flag as a cascading render. It is dropped when the
    // field unmounts, or the list closes or changes, before it runs.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadPage(requestKey, "", false, null);
    });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedLoadPage,
    isAsync,
    listKey,
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
  // diacritics, so "cilovy" still finds "Cílový".
  const filteredOptions =
    asSelect || isAsync || !searchTerm
      ? baseOptions
      : baseOptions.filter((option) =>
          normalizeText(option.label).includes(normalizeText(searchTerm)),
        );

  const displayedOptions =
    asSelect && hasEmpty ? [EMPTY_OPTION, ...filteredOptions] : filteredOptions;

  const isLoadingList = isStale || loadingFirstPage;

  // With `maxSelections` reached, only the selected options can be picked -
  // to remove them (and the empty option, which removes them all)
  const selectionLimit = multiple && maxSelections ? maxSelections : undefined;
  const limitReached =
    selectionLimit !== undefined && selectedValues.length >= selectionLimit;

  const isDisabled = (option: AutocompleteOption) =>
    !!option.disabled ||
    (limitReached && option !== EMPTY_OPTION && !isSelected(option));

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
    if (disabled || open) return;

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
    // Back to showing the selection
    if (!multiple) setSearch(null);
    // A select shows a fresh list every time it is opened
    if (asSelect && isAsync) setListKey(null);
  };

  const commit = (
    nextValues: AutocompleteValue[],
    lookup: Map<string, AutocompleteOption> = knownOptions,
  ) => {
    setInteracted(true);

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

  const handleSelect = (option: AutocompleteOption) => {
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
      }
      setSearch(null);
      setOpen(false);
      setActiveIndex(-1);
      revealActive.current = false;
      if (asSelect && isAsync) setListKey(null);
    }
  };

  const handleRemove = (removedValue: AutocompleteValue) => {
    commit(
      selectedValues.filter((selected) => !sameValue(selected, removedValue)),
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
    if (button === document.activeElement) focusInput();
    commit([]);
    setSearch(null);
  };

  // Scrolling to the end of the list loads more options
  const canLoadMore = isAsync ? hasMore : !!loadMore && hasMoreOptions;

  const loadNextPage = () => {
    if (loadingMore || isLoadingList || !canLoadMore) return;

    if (isAsync) {
      loadPage(requestKey, searchTerm, true, cursor);
    } else if (loadMore) {
      setLoadingMore(true);
      loadMore()
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
      const option =
        activeIndex >= 0
          ? document.getElementById(optionId(activeIndex))
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

  // Moves the highlight from the keyboard: keeps it in view, and reaching the
  // last option loads the next page as scrolling to it would
  const moveActive = (index: number) => {
    setActiveIndex(index);
    document
      .getElementById(optionId(index))
      ?.scrollIntoView({ block: "nearest" });
    if (findEnabled(index + 1, 1) === -1) loadNextPage();
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

    // From the option after the highlighted one, around the end of the list
    const count = displayedOptions.length;
    const order = Array.from(
      { length: count },
      (_, offset) => (activeIndex + 1 + offset) % count,
    );
    const startsWith = (prefix: string) =>
      order.find((index) => {
        const option = displayedOptions[index];
        return (
          !isDisabled(option) && normalizeText(option.label).startsWith(prefix)
        );
      });

    // The same letter again moves on to the next option starting with it
    const repeated = [...text].every((char) => char === text[0]);
    const match =
      startsWith(text) ?? (repeated ? startsWith(text[0]) : undefined);

    if (match === undefined) {
      // Nothing starts so - the next letter starts a new search
      typeAhead.current = { text: "", time };
      return;
    }

    openList();
    moveActive(match);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
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

    if (
      asSelect &&
      event.key.length === 1 &&
      event.key !== " " &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      highlightTyped(event.key, event.timeStamp);
      return;
    }

    // Enter in a closed typing field submits the form, as in a text input -
    // a select opens on it (the select-only combobox)
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        (asSelect && (event.key === "Enter" || event.key === " "))
      ) {
        event.preventDefault();
        openList();
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
        }
        break;
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
    if (!open) setOpen(true);

    // Erasing the text of a single selection clears it
    if (!multiple && text === "" && selectedValues.length > 0) commit([]);
  };

  // A single field without a value submits an empty one, so that clearing it
  // reaches backends that keep fields missing from the request unchanged. A
  // multiple one submits no value at all rather than [""].
  const submittedValues =
    multiple || selectedValues.length > 0 ? selectedValues : [""];

  // Hidden inputs are the form value; the validation input lets the browser
  // enforce `required` although the visible input holds no value of its own.
  // Disabled, like a disabled native field, they are neither submitted nor
  // validated.
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
      {required && (
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
          value={selectedValues.length > 0 ? "valid" : ""}
        />
      )}
    </>
  );

  // The combobox - the typing input, or in a select an element without text
  // editing (the APG select-only combobox), which is neither read-only nor
  // autocompleting for assistive technology
  const comboboxProps = {
    "aria-activedescendant":
      open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
    "aria-controls": open ? listboxId : undefined,
    "aria-describedby": cn(errorId, descriptionId, ariaDescribedBy),
    "aria-expanded": open,
    // Also those of `Field` or a form library - on the combobox, not on the
    // element around it
    "aria-invalid": error ? ("true" as const) : ariaInvalid,
    "aria-label": label ? undefined : ariaLabel,
    // Only an input is named by the `<label>` pointing at it
    "aria-labelledby":
      ariaLabelledBy ?? (asSelect && label ? labelId : undefined),
    "aria-required": required ? ("true" as const) : ariaRequired,
    id: inputId,
    ref: inputCallbackRef,
    role: "combobox",
    // Not focusable while disabled, like a native field
    tabIndex: disabled ? undefined : 0,
  };

  const comboboxClassName = cn(
    "min-w-16 grow focus:outline-none",
    asSelect && !disabled && "cursor-pointer",
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
    readOnly: isPreloading || disabled,
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
    "w-full items-center rounded-md border border-neutral-300 bg-surface px-2 py-1 focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700 dark:bg-surface-dark",
    error && "border-danger-500! focus-within:ring-danger-500!",
    asSelect && !disabled && "cursor-pointer",
    disabled && "cursor-not-allowed opacity-60",
  );

  const chevron = isPreloading ? (
    // The placeholder says it
    <Spinner aria-hidden="true" size="sm" />
  ) : (
    <ChevronDown
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
        open && "rotate-180 transform",
      )}
      size={16}
    />
  );

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
          {required && (
            <span
              aria-hidden="true"
              className="text-danger-700 dark:text-danger-400"
            >
              *
            </span>
          )}
        </label>
      )}

      {hiddenInputs}

      <Popover
        className="w-full"
        contentRef={popoverContentRef}
        // The input is the combobox - the wrapper is no button around it
        interactiveTrigger
        // The focus the user moves into the input of a typing field opens the
        // list - not the one of a chip or the clear button, nor the one the
        // field moves there itself
        onFocus={(event) => {
          if (
            !asSelect &&
            event.target === inputRef.current &&
            !focusingInput.current
          ) {
            openList();
          }
        }}
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
            >
              {isPreloading && selectedOptions.length === 0 ? (
                <Chip className="opacity-50">
                  {messages.autocomplete.loadingSelected}
                </Chip>
              ) : (
                selectedOptions.map((option) => (
                  <Chip
                    aria-label={
                      disabled
                        ? undefined
                        : `${messages.autocomplete.clear} ${option.label}`
                    }
                    className={disabled ? undefined : "cursor-pointer"}
                    key={valueKey(option.value)}
                    onClick={
                      disabled
                        ? undefined
                        : (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRemove(option.value);
                          }
                    }
                    onKeyDown={
                      disabled
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
                      disabled
                        ? undefined
                        : (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }
                    }
                    role={disabled ? undefined : "button"}
                    tabIndex={disabled ? undefined : 0}
                  >
                    {option.label}
                    {!disabled && <>&nbsp;×</>}
                  </Chip>
                ))
              )}
              {asSelect ? (
                selectCombobox(
                  selectedOptions.length ? "" : undefined,
                  placeholder,
                )
              ) : (
                <input
                  {...typingInputProps}
                  className={comboboxClassName}
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
              {selectedValues.length > 0 && !asSelect && !disabled && (
                <button
                  aria-label={messages.autocomplete.clear}
                  className="ml-2 cursor-pointer rounded p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
                  <X className="mr-0.5" size={16} />
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
            label
              ? formatMessage(messages.autocomplete.listLabel, { label })
              : ariaLabel
          }
          aria-labelledby={label || ariaLabel ? undefined : ariaLabelledBy}
          aria-multiselectable={multiple || undefined}
          id={listboxId}
          // A click on an option keeps the focus in the input
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
        >
          {displayedOptions.map((option, index) => (
            <OptionRow
              active={index === activeIndex}
              ariaLabel={
                option === EMPTY_OPTION
                  ? messages.autocomplete.emptyOption
                  : undefined
              }
              disabled={isDisabled(option)}
              id={optionId(index)}
              index={index}
              key={rowKeys[index]}
              onHover={setActiveIndex}
              onSelect={handleSelect}
              option={option}
              renderOption={renderOption}
              selected={isSelected(option)}
            />
          ))}
        </ul>
        {/* The state of the list is no option - it is announced from a live
            region beside the listbox, which stays in view under a long list */}
        <div
          className="sticky bottom-0 bg-surface dark:bg-surface-dark"
          onMouseDown={(event) => event.preventDefault()}
          role="status"
        >
          {/* The empty option of a select is no result */}
          {filteredOptions.length === 0 && !isLoadingList && !loadFailed && (
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
              {formatPlural(
                locale.code,
                messages.autocomplete.maxSelections,
                selectionLimit,
              )}
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
