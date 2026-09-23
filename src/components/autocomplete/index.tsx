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
import FormError from "../form-error";
import logger from "../../utils/logger";
import Popover from "../popover";
import removeDiacritics from "../../utils/remove-diacritics";
import Spinner from "../spinner";
import { formatMessage } from "../../i18n/format";
import { useFormReset } from "../../hooks/use-form-control";
import {
  normalizeLoadOptionsResult,
  type LoadOptionsParams,
  type LoadOptionsResult,
} from "./load-options";
import { useMessages } from "../../providers/ui-context";

export type {
  LoadOptionsPage,
  LoadOptionsParams,
  LoadOptionsResult,
  RelayConnection,
} from "./load-options";

const DEFAULT_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE = 300;

export type AutocompleteValue = string | number;

export interface AutocompleteOption<T = AutocompleteValue> {
  /** Text shown in the list and in the field. */
  label: string;
  /** Reported by `onChange` and submitted with the form. */
  value: T;
  /** The loaded item the option was created from (async mode). */
  data?: unknown;
}

/**
 * Fields the default label and value are read from, unless
 * `getOptionLabel` / `getOptionValue` are given: the label from `label`,
 * `name` or `title`, the value from `value` or `id`.
 */
export interface AutocompleteItem {
  id?: AutocompleteValue;
  label?: string;
  name?: string;
  title?: string;
  value?: AutocompleteValue;
}

interface BaseAutocompleteProps<
  TItem extends object = AutocompleteItem,
> extends Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange" | "children"
> {
  /**
   * Behaves like a select: no typing, a click opens the whole list. Combine
   * with `hasEmpty` to allow clearing the selection.
   */
  asSelect?: boolean;
  /** Multiple mode: close the list after each pick. */
  closeOnSelect?: boolean;
  /** Initial value of an uncontrolled field. */
  defaultValue?: AutocompleteValue | AutocompleteValue[] | null;
  disabled?: boolean;
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /** Label of a loaded item - see `AutocompleteItem` for the default. */
  getOptionLabel?: (item: TItem) => string;
  /** Value of a loaded item - see `AutocompleteItem` for the default. */
  getOptionValue?: (item: TItem) => AutocompleteValue;
  /** `asSelect` only: adds an empty first option that clears the selection. */
  hasEmpty?: boolean;
  label?: string;
  /**
   * Static mode: called when the list is scrolled to its end - load more and
   * pass the longer `options`. Set `hasMore` to `false` once there is
   * nothing more to load.
   */
  loadMore?: () => Promise<void>;
  /** Multiple mode: the most options that can be selected. */
  maxSelections?: number;
  multiple?: boolean;
  /**
   * Submits the value(s) in hidden inputs of this name, so the field works
   * in a plain `<form>` / `FormData`.
   */
  name?: string;
  /**
   * Called with the new value and the item(s) behind it: `(value, item)` in
   * single mode, `(values, items)` in multiple mode.
   */
  onChange?: (
    value: AutocompleteValue[] | AutocompleteValue | null,
    data?: TItem[] | TItem | null,
  ) => void;
  placeholder?: string;
  /** Custom rendering of an option in the list. */
  renderOption?: (
    option: AutocompleteOption,
    state: { active: boolean; selected: boolean },
  ) => React.ReactNode;
  required?: boolean;
  /**
   * Uncontrolled mode: apply every change of `defaultValue`, not only the
   * first one (e.g. when the form is reset with new data).
   */
  syncWithDefaultValue?: boolean;
  /** Value of a controlled field - `null` for no selection. */
  value?: AutocompleteValue[] | AutocompleteValue | null;
}

export interface AsyncAutocompleteProps<
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
   * ever been opened.
   */
  loadSelectedOptions?: (values: AutocompleteValue[]) => Promise<TItem[]>;
  /** Called when `loadOptions` or `loadSelectedOptions` rejects. */
  onLoadError?: (error: unknown) => void;
  options?: never;
  /** Items per page requested from `loadOptions`. */
  pageSize?: number;
}

export interface StaticAutocompleteProps<
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
  /** The options, filtered by the typed term (ignoring case and diacritics). */
  options: AutocompleteOption[];
  pageSize?: never;
}

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

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

/**
 * A searchable select - single or multiple, with static `options` or
 * options loaded from an API (`loadOptions`) with infinite scroll.
 */
export default function Autocomplete<TItem extends object = AutocompleteItem>({
  "aria-label": ariaLabel,
  asSelect = false,
  className,
  closeOnSelect = false,
  defaultValue,
  disabled = false,
  error,
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
  const messages = useMessages();

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
  const [settledPreloads, setSettledPreloads] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Selection of an uncontrolled field
  const [internalValues, setInternalValues] = useState(() =>
    toValues(defaultValue),
  );
  const [interacted, setInteracted] = useState(false);

  const popoverContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue` of an uncontrolled field, like a native field does
  const formResetRef = useFormReset(() => {
    setSearch(null);
    if (isControlled) return;
    setInternalValues(toValues(defaultValue));
    setInteracted(false);
  });

  const inputCallbackRef = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      const detachReset = formResetRef(element);

      return () => {
        inputRef.current = null;
        detachReset?.();
      };
    },
    [formResetRef],
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

  const knownOptions = useMemo(() => {
    const known = new Map<string, AutocompleteOption>();
    const sources = [
      preloadedOptions,
      pickedOptions,
      options ?? [],
      loadedOptions,
    ];

    for (const source of sources) {
      for (const option of source) known.set(valueKey(option.value), option);
    }

    return known;
  }, [loadedOptions, options, pickedOptions, preloadedOptions]);

  const selectedOptions = selectedValues
    .map((selected) => knownOptions.get(valueKey(selected)))
    .filter((option): option is AutocompleteOption => !!option);

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

  // Labels of selected values that no list has delivered yet
  const missingValues = selectedValues.filter(
    (selected) => !knownOptions.has(valueKey(selected)),
  );
  const missingKey = missingValues.length ? JSON.stringify(missingValues) : "";

  const isPreloading =
    isAsync &&
    !!loadSelectedOptions &&
    missingKey !== "" &&
    !settledPreloads.has(missingKey);

  const startedPreloads = useRef(new Set<string>());

  useEffect(() => {
    const { loadSelectedOptions: loadSelected } = callbacksRef.current;

    if (
      !loadSelected ||
      !missingKey ||
      startedPreloads.current.has(missingKey)
    ) {
      return;
    }

    startedPreloads.current.add(missingKey);

    loadSelected(JSON.parse(missingKey) as AutocompleteValue[])
      .then((items) => {
        const { getOptionLabel, getOptionValue } = callbacksRef.current;

        setPreloadedOptions((prev) => [
          ...prev,
          ...items.map((item) =>
            createOption(item, getOptionLabel, getOptionValue),
          ),
        ]);
      })
      .catch((loadError) => {
        logger.error("Failed to load the selected options", loadError);
        callbacksRef.current.onLoadError?.(loadError);
      })
      .finally(() => {
        setSettledPreloads((prev) => new Set(prev).add(missingKey));
      });
  }, [missingKey]);

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
  const errorId = error ? `${inputId}-error` : undefined;
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
    async (
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

      try {
        const result = await load({
          after: append ? pageCursor : null,
          cursor: append ? pageCursor : null,
          first: pageSize,
          offset,
          page,
          pageSize,
          search: searchValue,
          signal: controller.signal,
        });

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
      } catch (loadError) {
        if (!controller.signal.aborted) {
          logger.error("Failed to load the options", loadError);
          setHasMore(false);
          setFailedKey(key);
          callbacksRef.current.onLoadError?.(loadError);
        }
      } finally {
        if (pendingRequest.current === controller) {
          pendingRequest.current = null;
          setLoadingFirstPage(false);
          setLoadingMore(false);
        }
      }
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
    } else {
      debouncedLoadPage.cancel();
      // A microtask keeps the loading state out of the effect body, which
      // the React Compiler would flag as a cascading render
      queueMicrotask(() => loadPage(requestKey, "", false, null));
    }
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
    : (options ?? []);

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

  const displayedOptions: AutocompleteOption[] =
    asSelect && hasEmpty
      ? [{ label: " ", value: "" }, ...filteredOptions]
      : filteredOptions;

  const isLoadingList = isStale || loadingFirstPage;

  const activeIndex =
    activeKey === null
      ? -1
      : displayedOptions.findIndex(
          (option) => valueKey(option.value) === activeKey,
        );

  const setActiveIndex = (index: number) => {
    const option = displayedOptions[index];
    setActiveKey(option ? valueKey(option.value) : null);
  };

  const openList = () => {
    if (disabled || open) return;
    setActiveIndex(-1);
    setOpen(true);
  };

  const closeList = () => {
    if (!open) return;
    setOpen(false);
    setActiveIndex(-1);
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

    const items = nextValues
      .map((selected) => lookup.get(valueKey(selected))?.data as TItem)
      .filter(Boolean);

    if (multiple) {
      onChange?.(nextValues, items);
    } else {
      onChange?.(nextValues[0] ?? null, items[0] ?? null);
    }
  };

  const handleSelect = (option: AutocompleteOption) => {
    if (option.value === "" && hasEmpty) {
      commit([]);
      closeList();
      return;
    }

    setPickedOptions((prev) =>
      prev.some((picked) => sameValue(picked.value, option.value))
        ? prev
        : [...prev, option],
    );

    const lookup = new Map(knownOptions).set(valueKey(option.value), option);

    if (multiple) {
      if (isSelected(option)) {
        // Toggle off - remove the option
        commit(
          selectedValues.filter(
            (selected) => !sameValue(selected, option.value),
          ),
          lookup,
        );
      } else {
        // Toggle on - add the option (check limit)
        if (maxSelections && selectedValues.length >= maxSelections) return;
        commit([...selectedValues, option.value], lookup);
      }

      if (closeOnSelect) closeList();
    } else {
      commit([option.value], lookup);
      setSearch(null);
      setOpen(false);
      setActiveIndex(-1);
      if (asSelect && isAsync) setListKey(null);
    }
  };

  const handleRemove = (removedValue: AutocompleteValue) => {
    commit(
      selectedValues.filter((selected) => !sameValue(selected, removedValue)),
    );
  };

  // The focus moves on to the chip taking the place of the removed one, or
  // to the input after the last one - it would be lost with the chip
  const removeChip = (chip: HTMLElement, removedValue: AutocompleteValue) => {
    const next = chip.nextElementSibling;
    const target =
      next instanceof HTMLElement && next.getAttribute("role") === "button"
        ? next
        : inputRef.current;

    target?.focus();
    handleRemove(removedValue);
  };

  const handleClear = () => {
    commit([]);
    setSearch(null);
  };

  const loadNextPage = () => {
    if (loadingMore || isLoadingList) return;

    if (isAsync) {
      if (hasMore) loadPage(requestKey, searchTerm, true, cursor);
    } else if (loadMore && hasMoreOptions) {
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
  // after every page, check whether the list shows its end already
  useEffect(() => {
    if (!open || !hasMore || loadingMore) return;

    const frame = requestAnimationFrame(() => {
      const content = popoverContentRef.current;

      // A list that is not laid out (yet) has no height to fill
      if (
        content?.clientHeight &&
        content.scrollHeight <= content.clientHeight
      ) {
        handleScrollRef.current();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [hasMore, loadedOptions, loadingMore, open]);

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

  // Moves the highlight from the keyboard: keeps it in view, and reaching the
  // last option loads the next page as scrolling to it would
  const moveActive = (index: number) => {
    setActiveIndex(index);
    document
      .getElementById(optionId(index))
      ?.scrollIntoView({ block: "nearest" });
    if (index === displayedOptions.length - 1) loadNextPage();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // The keys of a chip are its own - only Escape closes the list from it
    if (event.target !== inputRef.current && event.key !== "Escape") return;

    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "Enter" ||
        (event.key === " " && asSelect)
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
      case "ArrowDown":
        event.preventDefault();
        if (activeIndex < displayedOptions.length - 1) {
          moveActive(activeIndex + 1);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (activeIndex > 0) moveActive(activeIndex - 1);
        break;
      // A typing field leaves Home / End to the caret in its text
      case "Home":
        if (asSelect && open && displayedOptions.length > 0) {
          event.preventDefault();
          moveActive(0);
        }
        break;
      case "End":
        if (asSelect && open && displayedOptions.length > 0) {
          event.preventDefault();
          moveActive(displayedOptions.length - 1);
        }
        break;
      case "Enter":
        if (activeIndex >= 0 && displayedOptions[activeIndex]) {
          event.preventDefault();
          handleSelect(displayedOptions[activeIndex]);
        }
        break;
      case "Backspace":
        // Multiple mode: backspace in the empty input removes the last chip
        if (multiple && !search && selectedValues.length > 0) {
          handleRemove(selectedValues[selectedValues.length - 1]);
        }
        break;
      default:
        break;
    }
  };

  const handleInputChange = (text: string) => {
    if (asSelect) return;

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
            key={valueKey(selected)}
            name={name}
            readOnly
            type="hidden"
            value={selected}
          />
        ))}
      {required && (
        <input
          aria-hidden="true"
          disabled={disabled}
          onChange={() => {}}
          // The browser focuses an invalid field on submit - the user belongs
          // in the visible one (its message still shows)
          onFocus={() => inputRef.current?.focus()}
          required
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value={selectedValues.length > 0 ? "valid" : ""}
        />
      )}
    </>
  );

  const inputProps = {
    "aria-activedescendant":
      open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
    "aria-autocomplete": "list" as const,
    "aria-controls": open ? listboxId : undefined,
    "aria-describedby": errorId,
    "aria-expanded": open,
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-label": label ? undefined : ariaLabel,
    "aria-required": required ? ("true" as const) : undefined,
    autoComplete: "off",
    disabled,
    id: inputId,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      handleInputChange(event.target.value),
    readOnly: asSelect || isPreloading || disabled,
    ref: inputCallbackRef,
    role: "combobox",
    tabIndex: disabled ? -1 : 0,
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

  const chevron = isPreloading ? (
    // The placeholder says it
    <Spinner aria-hidden="true" size="sm" />
  ) : (
    <ChevronDown
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-transform duration-200",
        open && "rotate-180 transform",
      )}
      size={16}
    />
  );

  return (
    <div {...props} className={cn("relative", className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium" htmlFor={inputId}>
          {label}: {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      {hiddenInputs}

      <Popover
        className="w-full"
        contentRef={popoverContentRef}
        // The input is the combobox - the wrapper is no button around it
        interactiveTrigger
        onFocus={() => !asSelect && openList()}
        onKeyDown={disabled ? undefined : handleKeyDown}
        onOpenChange={(isOpen) => (isOpen ? openList() : closeList())}
        open={disabled ? false : open}
        // The panel only wraps the listbox - no unnamed dialog around it
        popupRole="listbox"
        position="bottom"
        trigger={
          multiple ? (
            <div
              {...fieldProps}
              className={cn(
                "flex max-h-40 w-full flex-wrap items-center gap-1 overflow-y-auto rounded-md border border-neutral-300 bg-surface px-2 py-1 dark:border-neutral-700 dark:bg-surface-dark",
                error && "border-danger-500!",
                asSelect && !disabled && "cursor-pointer",
                disabled && "cursor-not-allowed opacity-60",
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
              <input
                {...inputProps}
                className={cn(
                  "min-w-16 grow focus:outline-none",
                  asSelect && !disabled && "cursor-pointer",
                  disabled && "cursor-not-allowed",
                )}
                placeholder={selectedOptions.length ? undefined : placeholder}
                value={search ?? ""}
              />
              {chevron}
            </div>
          ) : (
            <div
              {...fieldProps}
              className={cn(
                "relative flex w-full items-center rounded-md border border-neutral-300 bg-surface px-2 py-1 dark:border-neutral-700 dark:bg-surface-dark",
                error && "border-danger-500!",
                asSelect && !disabled && "cursor-pointer",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                {...inputProps}
                className={cn(
                  "w-full min-w-0 grow focus:outline-none",
                  asSelect && !disabled && "cursor-pointer",
                  disabled && "cursor-not-allowed",
                )}
                placeholder={
                  isPreloading
                    ? messages.autocomplete.loadingSelected
                    : placeholder
                }
                value={search ?? selectedOptions[0]?.label ?? ""}
              />
              {selectedValues.length > 0 && !asSelect && !disabled && (
                <button
                  aria-label={messages.autocomplete.clear}
                  className="ml-2 cursor-pointer p-1 focus:outline-none"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleClear();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      handleClear();
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
          aria-multiselectable={multiple || undefined}
          id={listboxId}
          // A click on an option keeps the focus in the input
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
        >
          {displayedOptions.map((option, index) => {
            const selected = isSelected(option);
            const active = index === activeIndex;

            return (
              <li
                aria-selected={selected}
                className={cn(
                  "cursor-pointer px-2 py-1",
                  !selected && "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                  selected &&
                    "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200",
                  selected && "hover:bg-neutral-300 dark:hover:bg-neutral-600",
                  !selected && active && "bg-neutral-100 dark:bg-neutral-800",
                  selected && active && "bg-neutral-300 dark:bg-neutral-600",
                )}
                id={optionId(index)}
                key={valueKey(option.value)}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
              >
                {renderOption
                  ? renderOption(option, { active, selected })
                  : option.label}
              </li>
            );
          })}
        </ul>
        {/* The state of the list is no option - it is announced from a live
            region beside the listbox */}
        <div onMouseDown={(event) => event.preventDefault()} role="status">
          {displayedOptions.length === 0 && !isLoadingList && !loadFailed && (
            <p className="px-2 py-1 text-sm text-neutral-500">
              {messages.autocomplete.noResults}
            </p>
          )}
          {/* Loading shows while the list is empty, or under it when paginating */}
          {((isLoadingList && displayedOptions.length === 0) ||
            loadingMore) && (
            <p className="flex items-center gap-2 p-2">
              {messages.autocomplete.loading}{" "}
              <Spinner aria-hidden="true" size="sm" />
            </p>
          )}
        </div>
        {loadFailed && (
          <p
            className="px-2 py-1 text-sm text-danger-600 dark:text-danger-400"
            onMouseDown={(event) => event.preventDefault()}
            role="alert"
          >
            {messages.autocomplete.loadError}
          </p>
        )}
      </Popover>

      {error && (
        <FormError className="mt-1.5" id={errorId}>
          {error}
        </FormError>
      )}
    </div>
  );
}
