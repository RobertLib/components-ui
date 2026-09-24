import { Search } from "lucide-react";
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import cn from "../../utils/cn";
import Dialog, { DialogFooter } from "../dialog";
import Kbd from "../kbd";
import Spinner from "../spinner";
import logger from "../../utils/logger";
import { isSafeHref } from "../../utils/sanitize-rich-text";
import useDebouncedValue from "../../hooks/use-debounced-value";
import useHotkeys from "../../hooks/use-hotkeys";
import useIsApplePlatform from "../../hooks/use-is-apple-platform";
import { formatPlural } from "../../i18n/format";
import {
  matchesShortcut,
  parseShortcut,
  toAriaKeyShortcuts,
} from "../../utils/shortcut";
import { useLocale, useMessages, useRouter } from "../../providers/ui-context";
import {
  findMatchRanges,
  rankMatch,
  toSearchable,
  toSearchWords,
  type MatchRange,
  type SearchableText,
} from "./match";

/** A command of `CommandPalette` - an action (`onSelect`), a page (`href`) or both. */
export interface CommandPaletteItem {
  /** A second line under the label, e.g. the e-mail of a person - searched too. */
  description?: string;
  /** Shown, but cannot be picked. */
  disabled?: boolean;
  /**
   * Heading of the group the item is listed under. The groups come in the
   * order of their first item - while searching, the group with the best
   * match first; items without a group form one without a heading.
   */
  group?: string;
  /**
   * Page the item opens - through the router of `UIProvider`. A URL with a
   * scheme (`https://…`, `mailto:`, `tel:`) is opened by the browser; other
   * schemes are not opened - a `javascript:` or `data:` URL from the data of
   * a search would run in the page.
   */
  href?: string;
  /** An icon before the label, e.g. a lucide icon of size 16. */
  icon?: React.ReactNode;
  /** Unique among the items. */
  id: string | number;
  /** More words the search finds the item by, e.g. "bill" for "Invoices". */
  keywords?: string[];
  /** Text of the item - the search matches it first and highlights the matches. */
  label: string;
  /** Called when the item is picked (Enter, a click), as the palette closes. */
  onSelect?: () => void;
  /**
   * A shortcut shown next to the item, e.g. `"mod+shift+n"` (see the
   * shortcut syntax on the Kbd page). Only shown - register it with
   * `useHotkeys`.
   */
  shortcut?: string;
}

/** The second argument of `loadItems`. */
export interface CommandPaletteLoadParams {
  /** Aborted when the search changes before the items arrive, or the palette closes. */
  signal: AbortSignal;
}

export interface CommandPaletteProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "role" | "title"
> {
  /** Classes of the dialog. */
  className?: string;
  /** Uncontrolled: whether the palette starts open. */
  defaultOpen?: boolean;
  /**
   * The commands - filtered by the search as the user types, ignoring case
   * and diacritics, the best matches first.
   */
  items?: CommandPaletteItem[];
  /**
   * Loads items for the search - from an API, e.g. the customers whose
   * name matches. Called when the palette opens (with `""`) and as the user
   * types, once typing pauses. The items it returns are listed after the
   * matching `items`, as they are - not filtered again.
   */
  loadItems?: (
    query: string,
    params: CommandPaletteLoadParams,
  ) => Promise<CommandPaletteItem[]>;
  /** Called when `loadItems` rejects. */
  onLoadError?: (error: unknown) => void;
  /** Called when the palette opens or closes - the shortcut, Escape, a pick. */
  onOpenChange?: (open: boolean) => void;
  /** Controls whether the palette is open. */
  open?: boolean;
  /** Placeholder and accessible name of the search field. */
  placeholder?: string;
  /**
   * Opens the palette from anywhere in the page (and closes it) - see the
   * shortcut syntax on the Kbd page. `null` for none.
   */
  shortcut?: string | null;
  /** Heading of the dialog - the localized "Command menu" by default. */
  title?: React.ReactNode;
}

// Typing into the search is waited out this long (ms) before `loadItems`
const SEARCH_DEBOUNCE = 300;

// Near the top of the screen, so the dialog does not jump as the results
// change - full screen on phones
const paletteClassName =
  "sm:top-[12vh] sm:max-h-[76vh] sm:translate-y-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0";

/** An item prepared for the search. */
interface SearchEntry {
  /** The description and the keywords, folded. */
  other: string;
  description?: SearchableText;
  item: CommandPaletteItem;
  label: SearchableText;
}

const toSearchEntry = (item: CommandPaletteItem): SearchEntry => ({
  description:
    item.description === undefined ? undefined : toSearchable(item.description),
  item,
  label: toSearchable(item.label),
  other: toSearchable([item.description, ...(item.keywords ?? [])].join(" "))
    .folded,
});

/** A row of the list. */
interface Option {
  entry: SearchEntry;
  /** Tells the items of `items` and of `loadItems` apart. */
  key: string;
  /** How well it matches - see `rankMatch`. Loaded items keep their order. */
  rank: number;
}

interface OptionGroup {
  name?: string;
  options: Option[];
}

/**
 * The options in groups, the best matches first - in each group, and the
 * group with the best match before the others, so the first option is the
 * best one. Groups that match equally well keep the order of their first
 * option.
 */
function groupOptions(options: Option[]) {
  const groups = new Map<string | undefined, OptionGroup>();

  for (const option of options) {
    const name = option.entry.item.group;
    const group = groups.get(name) ?? { name, options: [] };
    group.options.push(option);
    groups.set(name, group);
  }

  // Stable sorts - equal matches stay in the order they were given
  return Array.from(groups.values(), (group) => ({
    ...group,
    options: [...group.options].sort((a, b) => a.rank - b.rank),
  })).sort((a, b) => a.options[0].rank - b.options[0].rank);
}

// A URL with a scheme, or a protocol-relative one, is no page of the app
const isExternalUrl = (href: string) => /^([a-z][a-z\d+.-]*:|\/\/)/i.test(href);

/** Whether a shortcut has a modifier - then it may work in text fields too. */
function hasModifier(shortcut: string) {
  const { alt, ctrl, meta } = parseShortcut(shortcut);
  return alt || ctrl || meta;
}

/** `text` with the `ranges` marked - as React nodes, never as HTML. */
function HighlightedText({
  ranges,
  text,
}: {
  ranges: MatchRange[];
  text: string;
}) {
  if (ranges.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        className="bg-transparent font-semibold text-primary-700 dark:text-primary-300"
        key={index}
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });

  if (cursor < text.length) parts.push(text.slice(cursor));

  return parts;
}

interface OptionRowProps {
  active: boolean;
  id: string;
  onHover: (event: React.MouseEvent, key: string) => void;
  onRun: (item: CommandPaletteItem) => void;
  option: Option;
  words: string[];
}

/**
 * An option of the list - a component of its own, so that the compiler
 * memoizes every row: moving the highlight renders the two rows it moves
 * between, not the whole list.
 */
function OptionRow({
  active,
  id,
  onHover,
  onRun,
  option,
  words,
}: OptionRowProps) {
  const { description, item, label } = option.entry;
  // The shortcut is announced as the platform names its keys, like in menus
  const isApple = useIsApplePlatform();

  return (
    <div
      aria-disabled={item.disabled || undefined}
      aria-keyshortcuts={
        item.shortcut ? toAriaKeyShortcuts(item.shortcut, isApple) : undefined
      }
      aria-selected={active}
      className={cn(
        // Scrolled into view below the search field and above the footer
        "flex scroll-mt-24 scroll-mb-16 items-center gap-3 rounded-md px-3 py-2",
        item.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        active && "bg-neutral-200/70 dark:bg-neutral-800",
      )}
      id={id}
      onClick={item.disabled ? undefined : () => onRun(item)}
      onMouseMove={
        item.disabled ? undefined : (event) => onHover(event, option.key)
      }
      role="option"
    >
      {item.icon && (
        <span
          aria-hidden="true"
          className="flex shrink-0 text-neutral-500 dark:text-neutral-400"
        >
          {item.icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          <HighlightedText
            ranges={findMatchRanges(label, words)}
            text={item.label}
          />
        </span>
        {description && (
          <span className="block truncate text-sm text-neutral-500 dark:text-neutral-400">
            <HighlightedText
              ranges={findMatchRanges(description, words)}
              text={description.text}
            />
          </span>
        )}
      </span>
      {/* Phones have no keyboard for them, like for the hints below */}
      {/* Not part of the name - aria-keyshortcuts tells it */}
      {item.shortcut && (
        <Kbd
          aria-hidden="true"
          className="shrink-0 max-sm:hidden"
          shortcut={item.shortcut}
          size="sm"
        />
      )}
    </div>
  );
}

interface PaletteContentProps {
  items: CommandPaletteItem[];
  loadItems: CommandPaletteProps["loadItems"];
  onClose: () => void;
  onLoadError: CommandPaletteProps["onLoadError"];
  placeholder: string;
}

/**
 * The search and the results - mounted while the palette is open, so every
 * opening starts with an empty search.
 */
function PaletteContent({
  items,
  loadItems,
  onClose,
  onLoadError,
  placeholder,
}: PaletteContentProps) {
  const locale = useLocale();
  const messages = useMessages();
  const { navigate } = useRouter();

  const [query, setQuery] = useState("");
  const settledQuery = useDebouncedValue(query, SEARCH_DEBOUNCE);
  // The option the user moved the highlight to, and the search it was on -
  // otherwise the first option is highlighted, so Enter picks the best match
  const [chosen, setChosen] = useState<{ key: string; query: string } | null>(
    null,
  );

  // The items loaded for a search, and the search whose loading failed
  const [loaded, setLoaded] = useState<{
    items: CommandPaletteItem[];
    query: string;
  } | null>(null);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);

  // The pointer position of the last hover - see `handleHover`
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  // Callers pass the callbacks inline - the loading reacts to the search,
  // not to their identity
  const callbacksRef = useRef({ loadItems, onLoadError });

  useLayoutEffect(() => {
    callbacksRef.current = { loadItems, onLoadError };
  });

  const isAsync = typeof loadItems === "function";

  useEffect(() => {
    const load = callbacksRef.current.loadItems;
    if (!load) return;

    const controller = new AbortController();
    const { signal } = controller;

    // A promise chain - the React Compiler cannot compile try / catch with
    // conditions. The executor turns an error `load` throws into a
    // rejection too.
    new Promise<CommandPaletteItem[]>((resolve) => {
      resolve(load(settledQuery, { signal }));
    })
      .then((result) => {
        if (signal.aborted) return;
        setLoaded({ items: result, query: settledQuery });
        setFailedQuery(null);
      })
      .catch((error) => {
        if (signal.aborted) return;
        logger.error("Failed to load the items of the command palette", error);
        callbacksRef.current.onLoadError?.(error);
        setFailedQuery(settledQuery);
      });

    // Another search, or the palette closed
    return () => controller.abort();
  }, [isAsync, settledQuery]);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const searchEntries = useMemo(() => items.map(toSearchEntry), [items]);
  const words = useMemo(() => toSearchWords(query), [query]);

  // The results of the search typed now - loaded ones only once they are
  // for it, until then it is loading
  const isSettled = settledQuery === query;
  const loadFailed = isAsync && isSettled && failedQuery === settledQuery;
  const hasLoaded = isSettled && loaded !== null && loaded.query === query;
  const isLoading = isAsync && !loadFailed && !hasLoaded;

  const loadedEntries = useMemo(
    () => (loaded ? loaded.items.map(toSearchEntry) : []),
    [loaded],
  );

  const staticOptions = searchEntries.flatMap((entry): Option[] => {
    const rank =
      words.length === 0 ? 0 : rankMatch(entry.label, entry.other, words);
    return rank === null ? [] : [{ entry, key: `item-${entry.item.id}`, rank }];
  });

  const loadedOptions =
    hasLoaded && !loadFailed
      ? loadedEntries.map((entry): Option => ({
          entry,
          key: `loaded-${entry.item.id}`,
          // After the matching `items` of the same group
          rank: Number.MAX_SAFE_INTEGER,
        }))
      : [];

  const groups = groupOptions([...staticOptions, ...loadedOptions]);
  const options = groups.flatMap((group) => group.options);
  // The index of the first option of every group in `options`
  const groupStarts = groups.map((_, groupIndex) =>
    groups
      .slice(0, groupIndex)
      .reduce((count, group) => count + group.options.length, 0),
  );

  const isEnabled = (option: Option | undefined) =>
    !!option && !option.entry.item.disabled;

  const chosenIndex =
    chosen && chosen.query === query
      ? options.findIndex((option) => option.key === chosen.key)
      : -1;
  const activeIndex = isEnabled(options[chosenIndex])
    ? chosenIndex
    : options.findIndex(isEnabled);

  // The first enabled option from `index` on - towards the end with `step`
  // 1, the start with -1; -1 for none
  const findEnabled = (index: number, step: 1 | -1) => {
    for (let i = index; i >= 0 && i < options.length; i += step) {
      if (isEnabled(options[i])) return i;
    }
    return -1;
  };

  const moveTo = (index: number) => {
    const option = options[index];
    if (index < 0 || !option) return;

    setChosen({ key: option.key, query });

    // The first option of a group brings the heading of the group along
    const element = document.getElementById(optionId(index));
    const previous = element?.previousElementSibling;
    if (previous?.getAttribute("role") === "presentation") {
      previous.scrollIntoView({ block: "nearest" });
    }
    element?.scrollIntoView({ block: "nearest" });
  };

  const run = (item: CommandPaletteItem) => {
    if (item.disabled) return;

    // Closed - and the focus given back - before the command runs, so a
    // dialog it opens returns the focus to where the palette was opened
    // from, and a field it focuses keeps the focus
    flushSync(() => onClose());
    item.onSelect?.();

    if (!item.href) return;

    // Only links - a `javascript:` URL would run in the page, past the
    // guard React has for the `href` of links
    if (!isSafeHref(item.href)) {
      logger.error(
        "CommandPalette opens no href that is not a link:",
        item.href,
      );
    } else if (isExternalUrl(item.href)) {
      window.location.assign(item.href);
    } else {
      navigate(item.href);
    }
  };

  // Chrome moves the mouse after the list scrolled from the keyboard -
  // only a real move of the pointer highlights the option under it
  const handleHover = (event: React.MouseEvent, key: string) => {
    const { clientX: x, clientY: y } = event;
    const last = pointerRef.current;
    if (last && last.x === x && last.y === y) return;

    pointerRef.current = { x, y };
    // Moves within the highlighted option render nothing
    setChosen((current) =>
      current?.key === key && current.query === query
        ? current
        : { key, query },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // The keys of an input method editor (IME) composing text
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveTo(findEnabled(activeIndex + 1, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveTo(findEnabled(activeIndex - 1, -1));
        break;
      // With Shift they select text of the search, as in any field
      case "Home":
        if (plain && !event.shiftKey) {
          event.preventDefault();
          moveTo(findEnabled(0, 1));
        }
        break;
      case "End":
        if (plain && !event.shiftKey) {
          event.preventDefault();
          moveTo(findEnabled(options.length - 1, -1));
        }
        break;
      case "Enter": {
        const option = options[activeIndex];
        if (option) {
          event.preventDefault();
          run(option.entry.item);
        }
        break;
      }
      default:
        break;
    }
  };

  const hasQuery = words.length > 0;
  const noResults =
    hasQuery && options.length === 0 && !isLoading && !loadFailed;

  // Announced once the results of a search are complete - not on every
  // keystroke
  const resultCount =
    hasQuery && isSettled && !isLoading && options.length > 0
      ? formatPlural(
          locale.code,
          messages.commandPalette.resultCount,
          options.length,
        )
      : "";

  return (
    <>
      {/* Stays in view while the results scroll under it - at the top edge
          of the dialog body, over its padding */}
      <div className="sticky -top-6 z-10 -mx-6 -mt-6 bg-background px-6 pt-6 pb-3 dark:bg-background-dark">
        <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-surface px-3 focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700 dark:bg-surface-dark">
          <Search
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400"
          />
          <input
            aria-activedescendant={
              activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-label={placeholder}
            autoComplete="off"
            // Takes the focus as the palette opens - a key typed right after
            // the shortcut is not lost
            autoFocus
            className="h-10 w-full min-w-0 bg-transparent placeholder:text-neutral-500 focus:outline-none dark:placeholder:text-neutral-400"
            enterKeyHint="go"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            role="combobox"
            spellCheck={false}
            type="text"
            value={query}
          />
        </div>
      </div>

      <div
        aria-label={messages.commandPalette.results}
        className="-mx-3"
        id={listboxId}
        // A click on an option keeps the focus in the search
        onMouseDown={(event) => event.preventDefault()}
        role="listbox"
      >
        {groups.map((group, groupIndex) => {
          const rows = group.options.map((option, optionIndex) => {
            const index = groupStarts[groupIndex] + optionIndex;
            return (
              <OptionRow
                active={index === activeIndex}
                id={optionId(index)}
                key={option.key}
                onHover={handleHover}
                onRun={run}
                option={option}
                words={words}
              />
            );
          });

          if (group.name === undefined) {
            return <Fragment key="ungrouped">{rows}</Fragment>;
          }

          const headingId = `${baseId}-group-${groupIndex}`;
          return (
            <div
              aria-labelledby={headingId}
              className="mt-1 first:mt-0"
              key={`group-${group.name}`}
              role="group"
            >
              <div
                className="scroll-mt-24 px-3 pt-2 pb-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400"
                id={headingId}
                role="presentation"
              >
                {group.name}
              </div>
              {rows}
            </div>
          );
        })}
      </div>

      {/* The state of the list is no option - announced from a live region
          beside the listbox */}
      <div
        className="text-sm text-neutral-500 dark:text-neutral-400"
        role="status"
      >
        {isLoading && (
          <div className="flex items-center gap-2 py-2">
            {messages.common.loading}
            <Spinner aria-hidden="true" size="sm" />
          </div>
        )}
        {noResults && (
          <p className="py-2">{messages.commandPalette.noResults}</p>
        )}
        <span className="sr-only">{resultCount}</span>
      </div>
      {loadFailed && (
        <p
          className="py-2 text-sm text-danger-700 dark:text-danger-400"
          role="alert"
        >
          {messages.commandPalette.loadError}
        </p>
      )}
    </>
  );
}

/**
 * A command menu opened with a shortcut (⌘K / Ctrl+K by default): a dialog
 * with a search and the commands that match it, grouped. The list follows
 * the ARIA combobox pattern - the arrow keys, Home and End move the
 * highlight, Enter runs the highlighted command, Escape closes. Items with
 * `href` navigate through the router of `UIProvider`; `loadItems` adds
 * results from an API. On phones it fills the screen.
 */
export default function CommandPalette({
  className,
  defaultOpen = false,
  items = [],
  loadItems,
  onKeyDown,
  onLoadError,
  onOpenChange,
  open,
  placeholder,
  shortcut = "mod+k",
  title,
  ...props
}: CommandPaletteProps) {
  const messages = useMessages();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const changeOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Opens it - in the palette, the focus is in a modal dialog the page's
  // shortcuts do not reach; there the key handler below closes it
  useHotkeys(
    shortcut
      ? [
          [
            shortcut,
            // A held key repeats - the palette opens once
            (event) => {
              if (!event.repeat) changeOpen(!isOpen);
            },
            { allowInFields: hasModifier(shortcut) },
          ],
        ]
      : [],
    { enabled: !!shortcut },
  );

  const heading = title ?? messages.commandPalette.title;

  return (
    <Dialog
      {...props}
      aria-label={heading ? undefined : messages.commandPalette.title}
      className={cn(paletteClassName, className)}
      onClose={() => changeOpen(false)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        // A shortcut without a modifier ("/") is a character typed into the
        // search here
        if (event.defaultPrevented || !shortcut || !hasModifier(shortcut)) {
          return;
        }
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          if (!event.repeat) changeOpen(false);
        }
      }}
      open={isOpen}
      size="xl"
      title={heading || undefined}
    >
      <PaletteContent
        items={items}
        loadItems={loadItems}
        onClose={() => changeOpen(false)}
        onLoadError={onLoadError}
        placeholder={placeholder ?? messages.commandPalette.placeholder}
      />
      <DialogFooter className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500 max-sm:hidden dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <Kbd shortcut="arrowup" size="sm" />
          <Kbd shortcut="arrowdown" size="sm" />
          {messages.commandPalette.navigate}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd shortcut="enter" size="sm" />
          {messages.commandPalette.select}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd size="sm">Esc</Kbd>
          {messages.commandPalette.close}
        </span>
      </DialogFooter>
    </Dialog>
  );
}
