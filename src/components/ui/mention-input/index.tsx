import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  attachRef,
  isAriaInvalid,
  useFieldsetDisabled,
  useFormReset,
} from "../../../hooks/use-form-control";
import useDebouncedValue from "../../../hooks/use-debounced-value";
import usePointerMoved from "../../../hooks/use-pointer-moved";
import {
  formatMessage,
  formatNumber,
  formatPlural,
} from "../../../i18n/ui/format";
import { useLocale, usePortalContainer } from "../../../providers/ui-context";
import cn, { joinTokens } from "../../../utils/cn";
import logger from "../../../utils/logger";
import FormDescription from "../form-description";
import FormError from "../form-error";
import { fieldLabelClass, useReadOnly } from "../form-scope";
import { getElementByIdAt } from "../overlay-stack";
import Popover from "../popover";
import RequiredMark from "../required-mark";
import Spinner from "../spinner";
import {
  applyTextChange,
  findQuery,
  insertMentions,
  parseCopiedValue,
  parseValue,
  resolveTriggers,
  serializeValue,
  toMentionParts,
  type LoadMentionSuggestions,
  type MentionQuery,
  type MentionRange,
  type MentionSuggestion,
  type MentionTrigger,
  type TextInsertion,
} from "./markup";
import { filterSuggestions, findLabelMatches } from "./suggestions";

export interface MentionInputProps extends Omit<
  React.ComponentProps<"textarea">,
  | "children"
  | "className"
  | "dangerouslySetInnerHTML"
  | "defaultValue"
  | "onChange"
  | "value"
> {
  /**
   * Grows and shrinks with the text - between `minRows` and `maxRows`
   * lines, then it scrolls. It has no resize handle then.
   */
  autosize?: boolean;
  /**
   * Classes of the wrapper around the label, the field, the description and
   * the error message.
   */
  className?: string;
  /**
   * Initial value of an uncontrolled field - text with mention tokens. It is
   * followed until the user edits, so it may arrive after the first render;
   * a reset of the form brings it back.
   */
  defaultValue?: string;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field - the paddings and the text of `Textarea`. */
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
   * Id of the `<form>` the hidden input belongs to, when the field is not
   * inside it - a reset of that form resets the field too.
   */
  form?: string;
  /** The `<label>` of the field - a text, or content like a text with an icon. */
  label?: React.ReactNode;
  /**
   * Loads the suggestions for the text typed after a trigger - from an API,
   * as the user pauses typing (right away after the trigger itself). The
   * `signal` aborts once the query changes. Used for the triggers without
   * suggestions of their own. The list opened again loads anew - it offers
   * nothing loaded before, also when this function is another one.
   */
  loadSuggestions?: LoadMentionSuggestions;
  /**
   * The most characters of the text as it shows - a mention counts as
   * "@Jana Nováková". A mention that would not fit is not inserted.
   */
  maxLength?: number;
  /**
   * With `autosize`: the most lines the field grows to - more text
   * scrolls. No limit by default.
   */
  maxRows?: number;
  /** The most suggestions listed at once - 8 by default. */
  maxSuggestions?: number;
  /**
   * With `autosize`: the lines of the empty field - by default it is as
   * high as one without `autosize`.
   */
  minRows?: number;
  /** Submits the value - the text with mention tokens - in a hidden input of this name. */
  name?: string;
  /**
   * Called with the new value - the text with the mentions as tokens,
   * `@[Jana Nováková](user:42)`.
   */
  onChange?: (value: string) => void;
  /** Called when `loadSuggestions` throws or rejects. */
  onLoadError?: (error: unknown) => void;
  /**
   * The text can be read, selected and copied but not changed, and no
   * suggestions open. It is still submitted. Marked with `data-readonly`.
   * By default read-only inside a read-only `FormSection` / `FormGrid`.
   */
  readOnly?: boolean;
  /**
   * The textarea - e.g. for React Hook Form (`Controller`), which focuses
   * a field that failed validation. Its `value` is the text as it shows;
   * the value with the tokens is the hidden input's.
   */
  ref?: React.Ref<HTMLTextAreaElement>;
  /** An empty field blocks the submit of its form. */
  required?: boolean;
  /**
   * Shows how many characters the text has - with `maxLength` "123 / 500",
   * and near the limit screen readers are told how many are left once the
   * typing pauses, like with `Textarea`.
   */
  showCount?: boolean;
  /**
   * People or records offered after a trigger, filtered by the typed text
   * ignoring case and diacritics. Used for the triggers without
   * suggestions of their own.
   */
  suggestions?: MentionSuggestion[];
  /**
   * The characters that start a mention - a string, or a trigger with its
   * own suggestions (`{ char: "#", loadSuggestions: loadTickets }`).
   * `["@"]` by default. Read stored values with the same triggers
   * (`parseMentions`, `MentionText`).
   */
  triggers?: readonly (string | MentionTrigger)[];
  /**
   * Value of a controlled field - the text with the mentions as tokens,
   * `@[Jana Nováková](user:42)`.
   */
  value?: string;
}

// The paddings and the text of `Textarea`, at each size. The minimal height
// is that of a Textarea too.
const dimStyles = {
  xs: "px-1 py-0 text-sm min-h-12",
  sm: "px-1 py-0.5 text-sm min-h-15",
  md: "px-2 py-1 text-base min-h-20",
  lg: "px-3 py-2 text-lg min-h-25",
};

// The vertical padding of `dimStyles` - the rows of an autosizing field are
// lines plus these and the border
const verticalPaddings = {
  xs: "0rem",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
};

const listDimStyles = {
  xs: "text-sm",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

// Typing after a trigger is waited out this long (ms) before loading
const LOAD_DELAY = 250;

// The state of the list is announced once it has not changed for this long
const ANNOUNCE_DELAY = 500;

// The counter is told to screen readers this long after the typing pauses
const COUNT_ANNOUNCE_DELAY = 750;

const DEFAULT_MAX_SUGGESTIONS = 8;

// The type of the clipboard data that keeps the mentions of copied text -
// pasted into a mention field, they stay mentions
const CLIPBOARD_TYPE = "application/x-mention-value";
// ... and the triggers it was written with - a field with others reads it
// with them
const CLIPBOARD_TRIGGERS_TYPE = "application/x-mention-triggers";

// The undo history of the browser brings back texts - their mentions are
// remembered for so many of them
const REMEMBERED_TEXTS = 100;

/** Whether a slot renders anything - the `false` of a condition does not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

const sameQuery = (a: MentionQuery | null, b: MentionQuery | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.char === b.char &&
    a.start === b.start &&
    a.end === b.end &&
    a.text === b.text);

/** A label with the words of the query in bold. */
function HighlightedLabel({ label, query }: { label: string; query: string }) {
  const ranges = findLabelMatches(label, query);
  if (ranges.length === 0) return label;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end]) => {
    if (start > cursor) parts.push(label.slice(cursor, start));
    parts.push(
      <b className="font-semibold" key={start}>
        {label.slice(start, end)}
      </b>,
    );
    cursor = end;
  });
  if (cursor < label.length) parts.push(label.slice(cursor));

  return parts;
}

/**
 * A multi-line text field in which typing a trigger (`@`) offers people or
 * records to mention, positioned at the caret - from a static list or
 * loaded as the user types. The arrow keys move through them, Enter or Tab
 * inserts one, Escape closes the list. The field shows a mention as
 * "@Jana Nováková" and stores it as a token, `@[Jana Nováková](user:42)` -
 * `parseMentions` reads the ids, `MentionText` shows the value.
 *
 * It is a native textarea, so typing, IME composition, spell checking,
 * undo and screen readers work as in any text field; the mentions are
 * highlighted by a layer under the text. A mention is deleted whole with
 * Backspace or Delete, the caret skips over it, and a change inside it makes
 * it text again. Copied and pasted between mention fields, mentions stay
 * mentions.
 */
export default function MentionInput({
  autosize = false,
  className,
  defaultValue,
  description,
  dim = "md",
  disabled: disabledProp = false,
  error,
  form,
  id,
  label,
  loadSuggestions,
  maxLength,
  maxRows,
  maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
  minRows,
  name,
  onBlur,
  onChange,
  onCompositionEnd,
  onCompositionStart,
  onCopy,
  onCut,
  onFocus,
  onKeyDown,
  onLoadError,
  onPaste,
  onScroll,
  onSelect,
  placeholder,
  readOnly: ownReadOnly,
  ref,
  required,
  showCount = false,
  style,
  suggestions,
  triggers,
  value,
  ...props
}: MentionInputProps) {
  const readOnly = useReadOnly(ownReadOnly);
  const locale = useLocale();
  const messages = locale.messages.ui;
  const getPortalContainer = usePortalContainer();
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = disabledProp || fieldsetDisabled;
  const locked = disabled || readOnly;

  const resolvedTriggers = useMemo(() => resolveTriggers(triggers), [triggers]);
  const chars = resolvedTriggers.map((trigger) => trigger.char).join("");

  // The value of an uncontrolled field - until the user edits, and again
  // after a reset, it is `defaultValue`
  const [enteredValue, setEnteredValue] = useState<string>();
  const isControlled = value !== undefined;
  const currentValue = isControlled
    ? value
    : (enteredValue ?? defaultValue ?? "");
  const parsed = useMemo(
    () => parseValue(currentValue, chars),
    [chars, currentValue],
  );

  const [query, setQuery] = useState<MentionQuery | null>(null);
  // The text changed from outside (a controlled value, a reset) - the
  // mention being typed is gone with it
  if (
    query &&
    parsed.text.slice(query.start, query.end) !== query.char + query.text
  ) {
    setQuery(null);
  }
  // The trigger position whose list Escape closed - it stays closed until
  // the caret leaves that mention
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  // The suggestion the user moved the highlight to, and the query it was
  // on - otherwise the first one is highlighted, so Enter takes the best
  const [chosen, setChosen] = useState<{ key: string; query: string } | null>(
    null,
  );
  const [loaded, setLoaded] = useState<{
    items: MentionSuggestion[];
    key: string;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // A query with a space that found nothing - longer ones from the same
  // trigger are no mention either, and are not loaded
  const [exhausted, setExhausted] = useState<{
    start: number;
    text: string;
  } | null>(null);
  // Told to screen readers once a mention is inserted
  const [inserted, setInserted] = useState("");
  // The trigger the list is placed at
  const [marker, setMarker] = useState<HTMLSpanElement | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const isComposing = useRef(false);
  // A text with mentions being inserted - its input event takes them
  const pendingInsertion = useRef<TextInsertion | null>(null);
  // Where the caret goes once a value set without the browser renders
  const pendingCaret = useRef<number | null>(null);
  // Where the caret was - it skips over a mention in the direction it moves
  const lastCaret = useRef<number | null>(null);
  // The mentions of the texts the field had - undo brings them back
  const history = useRef(new Map<string, MentionRange[]>());

  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const descriptionId = description ? `${textareaId}-description` : undefined;
  const listboxId = `${generatedId}-listbox`;
  const optionId = (index: number) => `${generatedId}-option-${index}`;
  const invalid = !!error || isAriaInvalid(props["aria-invalid"]);

  // For the listeners of the document and the loading, which run between
  // renders
  const latest = useRef({ loadSuggestions, onLoadError, resolvedTriggers });
  useLayoutEffect(() => {
    latest.current = { loadSuggestions, onLoadError, resolvedTriggers };
  });

  const invalidTriggers = (triggers ?? [])
    .map((trigger) => (typeof trigger === "string" ? trigger : trigger.char))
    .filter((char) => !chars.includes(char))
    .join(" ");
  useEffect(() => {
    if (!invalidTriggers) return;
    logger.warn(
      `MentionInput: "${invalidTriggers}" cannot start a mention - a trigger is one character, not a space, a bracket or a backslash.`,
    );
  }, [invalidTriggers]);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue`
  const formResetRef = useFormReset(() => {
    setEnteredValue(undefined);
    setQuery(null);
    setDismissedAt(null);
    history.current.clear();
  }, form);

  const textareaCallbackRef = useCallback(
    (element: HTMLTextAreaElement | null) => {
      textareaRef.current = element;
      const detachReset = formResetRef(element);
      const detachFieldset = fieldsetRef(element);
      const detachRef = attachRef(ref, element);

      return () => {
        textareaRef.current = null;
        detachReset?.();
        detachFieldset?.();
        detachRef();
      };
    },
    [fieldsetRef, formResetRef, ref],
  );

  // The suggestions of the trigger typed - its own, else the field's
  const trigger = query
    ? resolvedTriggers.find((candidate) => candidate.char === query.char)
    : undefined;
  const hasOwnSource =
    !!trigger && (!!trigger.suggestions || !!trigger.loadSuggestions);
  const staticSuggestions = hasOwnSource ? trigger.suggestions : suggestions;
  const hasLoader = hasOwnSource
    ? !!trigger.loadSuggestions
    : !!loadSuggestions;
  const hasSource = !!staticSuggestions || hasLoader;
  const offersSuggestions =
    !!suggestions ||
    !!loadSuggestions ||
    resolvedTriggers.some(
      (candidate) => !!candidate.suggestions || !!candidate.loadSuggestions,
    );

  const isExhausted =
    !!query &&
    !!exhausted &&
    exhausted.start === query.start &&
    query.text.startsWith(exhausted.text);
  const isWanted =
    !!query &&
    hasSource &&
    isFocused &&
    !locked &&
    dismissedAt !== query.start &&
    !isExhausted;

  const loadKey =
    isWanted && hasLoader && query ? `${query.char}\u0000${query.text}` : null;

  // The suggestions loaded stay while the list is open, as the next ones
  // load. Closed, they are old - `loadSuggestions` may be another one when it
  // opens again (of another project), and Enter must not insert theirs.
  if (loadKey === null && (loaded !== null || failedKey !== null)) {
    setLoaded(null);
    setFailedKey(null);
  }

  useEffect(() => {
    if (loadKey === null) return;
    const [char, text] = loadKey.split("\u0000");
    const { loadSuggestions: fieldLoad, resolvedTriggers: current } =
      latest.current;
    const own = current.find((candidate) => candidate.char === char);
    const load =
      own && (own.suggestions || own.loadSuggestions)
        ? own.loadSuggestions
        : fieldLoad;
    if (!load) return;

    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(
      () => {
        // A promise chain - the React Compiler cannot compile try / catch
        // with conditions. The executor turns an error `load` throws into
        // a rejection too.
        new Promise<MentionSuggestion[]>((resolve) => {
          resolve(load(text, { signal, trigger: char }));
        })
          .then((items) => {
            if (signal.aborted) return;
            setLoaded({ items, key: loadKey });
            setFailedKey(null);
          })
          .catch((loadError) => {
            if (signal.aborted) return;
            logger.error(
              "Failed to load the suggestions of a mention",
              loadError,
            );
            latest.current.onLoadError?.(loadError);
            setFailedKey(loadKey);
          });
      },
      // The suggestions for the trigger alone show at once
      text === "" ? 0 : LOAD_DELAY,
    );

    // Another query, or the list closed
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadKey]);

  const queryText = query?.text ?? "";
  const loadedForQuery = loadKey !== null && loaded?.key === loadKey;
  const loadFailed = loadKey !== null && failedKey === loadKey;
  const isLoading = loadKey !== null && !loadedForQuery && !loadFailed;
  // While the next ones load, those of the query before stay - of the same
  // trigger - so that the list does not flicker
  const loadedItems =
    loadKey !== null && loaded && loaded.key.startsWith(`${query?.char}\u0000`)
      ? loadedForQuery
        ? loaded.items
        : // Those still matching what is typed now - Enter must not insert
          // a suggestion of the text before
          filterSuggestions(loaded.items, queryText, loaded.items.length)
      : [];

  const staticMatches =
    isWanted && staticSuggestions
      ? filterSuggestions(staticSuggestions, queryText, maxSuggestions)
      : [];
  const options = [
    ...staticMatches,
    ...loadedItems.filter(
      (item) =>
        !staticMatches.some((match) => String(match.id) === String(item.id)),
    ),
  ].slice(0, maxSuggestions);

  // A query with a space that matches nothing is ordinary text
  const hasSpace = /\s/.test(queryText);
  if (
    query &&
    hasSpace &&
    loadedForQuery &&
    options.length === 0 &&
    (exhausted?.start !== query.start || exhausted.text !== query.text)
  ) {
    setExhausted({ start: query.start, text: query.text });
  }

  const isListShown =
    isWanted && (options.length > 0 || isLoading || loadFailed || !hasSpace);

  // A key per option - its id, numbered when the id repeats
  const idCounts = new Map<string, number>();
  const optionKeys = options.map((option) => {
    const key = String(option.id);
    const count = idCounts.get(key) ?? 0;
    idCounts.set(key, count + 1);
    return count === 0 ? key : `${key}\u0000${count}`;
  });
  const queryKey = query ? `${query.start}\u0000${query.text}` : "";
  const chosenIndex =
    chosen && chosen.query === queryKey ? optionKeys.indexOf(chosen.key) : -1;
  const activeIndex = !isListShown
    ? -1
    : chosenIndex >= 0 && !options[chosenIndex].disabled
      ? chosenIndex
      : options.findIndex((option) => !option.disabled);

  // What the live region tells about the open list - after a pause
  const listStatus = isListShown
    ? isLoading && options.length === 0
      ? messages.common.loading
      : loadFailed
        ? ""
        : options.length === 0
          ? messages.mentionInput.noResults
          : formatPlural(
              locale.code,
              messages.mentionInput.resultCount,
              options.length,
            )
    : "";
  const announcedStatus = useDebouncedValue(listStatus, ANNOUNCE_DELAY);

  /** Finds the mention typed before the caret - in `text` as the field has it now. */
  const updateQuery = (
    textarea: HTMLTextAreaElement,
    changed?: { mentions: MentionRange[]; text: string },
  ) => {
    const { mentions, text } = changed ?? parsed;
    const { selectionEnd, selectionStart } = textarea;
    const next =
      selectionStart === selectionEnd
        ? findQuery(text, selectionStart, mentions, resolvedTriggers)
        : null;
    setQuery((current) => (sameQuery(current, next) ? current : next));
    if (!next) setDismissedAt(null);
  };

  /** Keeps the mentions of a text - the undo of the browser may bring it back. */
  const remember = (text: string, mentions: MentionRange[]) => {
    const remembered = history.current;
    remembered.delete(text);
    remembered.set(text, mentions);
    if (remembered.size > REMEMBERED_TEXTS) {
      remembered.delete(remembered.keys().next().value as string);
    }
  };

  const commit = (text: string, mentions: MentionRange[]) => {
    // The text before too - the first one was never changed to
    remember(parsed.text, parsed.mentions);
    remember(text, mentions);
    const next = serializeValue(text, mentions, chars);
    if (next === currentValue) return;
    if (!isControlled) setEnteredValue(next);
    onChange?.(next);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const text = textarea.value;
    const { inputType } = event.nativeEvent as InputEvent;
    const insertion = pendingInsertion.current;
    pendingInsertion.current = null;
    setInserted("");

    let mentions: MentionRange[];
    if (
      insertion &&
      text ===
        parsed.text.slice(0, insertion.from) +
          insertion.text +
          parsed.text.slice(insertion.to)
    ) {
      mentions = insertMentions(parsed.mentions, insertion);
    } else if (
      (inputType === "historyUndo" || inputType === "historyRedo") &&
      history.current.has(text)
    ) {
      mentions = history.current.get(text) ?? [];
    } else {
      const { selectionEnd, selectionStart } = textarea;
      mentions = applyTextChange(
        parsed.text,
        parsed.mentions,
        text,
        selectionStart === selectionEnd ? selectionEnd : null,
      );
    }

    commit(text, mentions);
    updateQuery(textarea, { mentions, text });
  };

  /**
   * Puts `text` with its mentions in place of `[from, to)` - by the editing
   * of the browser where it can, so that undo takes it back; else by the
   * value.
   */
  const replaceText = (
    textarea: HTMLTextAreaElement,
    insertion: TextInsertion,
    caretAfter?: number,
  ) => {
    const caret = caretAfter ?? insertion.from + insertion.text.length;
    pendingInsertion.current = insertion;
    textarea.focus();
    textarea.setSelectionRange(insertion.from, insertion.to);
    // `execCommand` is the only editing a script can do that the undo of
    // the browser knows - deprecated, but in every browser
    const edited =
      typeof document.execCommand === "function" &&
      document.execCommand(
        insertion.text ? "insertText" : "delete",
        false,
        insertion.text,
      );

    if (edited && pendingInsertion.current === null) {
      // The input event took the mentions
      textarea.setSelectionRange(caret, caret);
      return;
    }

    pendingInsertion.current = null;
    commit(
      parsed.text.slice(0, insertion.from) +
        insertion.text +
        parsed.text.slice(insertion.to),
      insertMentions(parsed.mentions, insertion),
    );
    pendingCaret.current = caret;
  };

  const pick = (suggestion: MentionSuggestion) => {
    const textarea = textareaRef.current;
    if (!query || !textarea || suggestion.disabled || locked) return;

    // A token that reads back: one line, not too long
    const parts = toMentionParts(suggestion.label, suggestion.id);
    if (!parts) return;
    const { id: mentionId, label: mentionLabel } = parts;
    const mentionText = query.char + mentionLabel;
    // A space after it, unless there is one already - the caret goes past
    // it. Not past a line break: the space goes before it.
    const next = parsed.text[query.end];
    const spacer = next !== undefined && /[^\S\n]/.test(next) ? "" : " ";
    const text = mentionText + spacer;

    setQuery(null);
    setChosen(null);
    if (
      maxLength !== undefined &&
      parsed.text.length - (query.end - query.start) + text.length > maxLength
    ) {
      setDismissedAt(query.start);
      return;
    }

    replaceText(
      textarea,
      {
        from: query.start,
        mentions: [
          {
            end: mentionText.length,
            id: mentionId,
            label: mentionLabel,
            start: 0,
            trigger: query.char,
          },
        ],
        text,
        to: query.end,
      },
      query.start + mentionText.length + 1,
    );
    setInserted(
      formatMessage(messages.mentionInput.inserted, { label: mentionLabel }),
    );
  };

  const moveActive = (index: number) => {
    setChosen({ key: optionKeys[index], query: queryKey });
    getElementByIdAt(getPortalContainer(), optionId(index))?.scrollIntoView({
      block: "nearest",
    });
  };

  /** The next enabled option from `index` in the direction of `step`, round. */
  const findEnabled = (index: number, step: 1 | -1) => {
    for (let offset = 0; offset < options.length; offset++) {
      const candidate =
        (index + step * offset + options.length * 2) % options.length;
      if (!options[candidate].disabled) return candidate;
    }
    return -1;
  };

  const pointerMoved = usePointerMoved();

  // Only a real move of the pointer highlights the suggestion under it, not
  // the list scrolling beneath it from the keyboard
  const handleHover = (event: React.MouseEvent, index: number) => {
    if (pointerMoved(event) && !options[index].disabled) {
      setChosen({ key: optionKeys[index], query: queryKey });
    }
  };

  /** Moves a caret inside a mention out of it - in the direction it went. */
  const skipMention = (textarea: HTMLTextAreaElement) => {
    const { selectionEnd, selectionStart } = textarea;
    if (selectionStart !== selectionEnd) {
      lastCaret.current = null;
      return;
    }

    const mention = parsed.mentions.find(
      (candidate) =>
        candidate.start < selectionStart && selectionStart < candidate.end,
    );
    if (!mention) {
      lastCaret.current = selectionStart;
      return;
    }

    const from = lastCaret.current;
    const to =
      from === mention.start
        ? mention.end
        : from === mention.end
          ? mention.start
          : selectionStart - mention.start < mention.end - selectionStart
            ? mention.start
            : mention.end;
    textarea.setSelectionRange(to, to);
    lastCaret.current = to;
  };

  /**
   * What deleting at a collapsed caret deletes, so that a mention goes whole
   * - the mention the caret is at the edge of. A word deleted backward (⌥ /
   * Ctrl + Backspace) also takes the one before the white space the caret is
   * after, "@Jana Nováková |", which the browser would delete half of.
   * `null` for none.
   */
  const findMentionDeletion = (
    textarea: HTMLTextAreaElement,
    backward: boolean,
    word = false,
  ) => {
    const { selectionEnd, selectionStart: caret } = textarea;
    if (caret !== selectionEnd || locked) return null;

    const mention = parsed.mentions.find((candidate) =>
      backward
        ? candidate.end === caret ||
          (word &&
            candidate.end < caret &&
            /^[^\S\n]+$/.test(parsed.text.slice(candidate.end, caret)))
        : candidate.start === caret,
    );
    if (!mention) return null;
    return backward
      ? { from: mention.start, to: caret }
      : { from: caret, to: mention.end };
  };

  /**
   * A phone keyboard deletes without a key event of its own (key code 229),
   * and a word deleted backward may end in a mention. The `beforeinput` comes
   * with the range to delete taken already - the field deletes the mention
   * instead. One that cannot be cancelled (of a composition on Android) is
   * left to the browser: the mention it reaches into becomes text.
   */
  const deleteMentionOnInput = (
    textarea: HTMLTextAreaElement,
    event: InputEvent,
  ) => {
    const { inputType } = event;
    const backward =
      inputType === "deleteContentBackward" ||
      inputType === "deleteWordBackward";
    const forward =
      inputType === "deleteContentForward" || inputType === "deleteWordForward";
    if (!event.cancelable || (!backward && !forward)) return;

    const deletion = findMentionDeletion(
      textarea,
      backward,
      inputType === "deleteWordBackward",
    );
    if (!deletion) return;

    event.preventDefault();
    replaceText(textarea, { ...deletion, mentions: [], text: "" });
  };

  const latestDelete = useRef(deleteMentionOnInput);
  useLayoutEffect(() => {
    latestDelete.current = deleteMentionOnInput;
  });

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleBeforeInput = (event: InputEvent) =>
      latestDelete.current(textarea, event);

    textarea.addEventListener("beforeinput", handleBeforeInput);
    return () => textarea.removeEventListener("beforeinput", handleBeforeInput);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);

    // The keys of an input method editor (IME) composing text - Enter
    // confirms the conversion. Safari sends the confirming Enter after
    // `compositionend`, with the key code 229.
    if (
      event.defaultPrevented ||
      isComposing.current ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }

    const textarea = event.currentTarget;
    const modified =
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

    if (isListShown) {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp": {
          if (modified || activeIndex < 0) break;
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          moveActive(findEnabled(activeIndex + step, step));
          return;
        }
        case "Enter":
        case "Tab":
          if (modified) break;
          if (activeIndex >= 0) {
            event.preventDefault();
            pick(options[activeIndex]);
            return;
          }
          // The suggestions are still on their way - no line break meanwhile
          if (event.key === "Enter" && isLoading) {
            event.preventDefault();
            return;
          }
          break;
        case "Escape":
          // It closes the list and nothing else - not a Dialog around
          event.preventDefault();
          event.stopPropagation();
          if (query) setDismissedAt(query.start);
          return;
        default:
          break;
      }
    }

    // A collapsed selection at the edge of a mention widened over it - the
    // browser deletes the whole mention, and can undo it
    if (event.key === "Backspace" || event.key === "Delete") {
      const deletion = findMentionDeletion(textarea, event.key === "Backspace");
      if (deletion) textarea.setSelectionRange(deletion.from, deletion.to);
    }
  };

  /** Copies the selected text with its whole mentions - `false` without any. */
  const copySelection = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const { selectionEnd: to, selectionStart: from } = event.currentTarget;
    const mentions = parsed.mentions
      .filter((mention) => mention.start >= from && mention.end <= to)
      .map((mention) => ({
        ...mention,
        end: mention.end - from,
        start: mention.start - from,
      }));
    if (mentions.length === 0) return false;

    const text = parsed.text.slice(from, to);
    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
    event.clipboardData.setData(
      CLIPBOARD_TYPE,
      serializeValue(text, mentions, chars),
    );
    event.clipboardData.setData(CLIPBOARD_TRIGGERS_TYPE, chars);
    return true;
  };

  const handleCopy = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    onCopy?.(event);
    if (!event.defaultPrevented) copySelection(event);
  };

  const handleCut = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    onCut?.(event);
    if (event.defaultPrevented || locked) return;

    const textarea = event.currentTarget;
    const { selectionEnd: to, selectionStart: from } = textarea;
    if (copySelection(event)) {
      replaceText(textarea, { from, mentions: [], text: "", to });
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    onPaste?.(event);
    if (event.defaultPrevented || locked) return;

    const { clipboardData } = event;
    const copied = clipboardData.getData(CLIPBOARD_TYPE);
    if (!copied) return;
    // Read with the triggers of the field it was copied from - a mention of
    // another trigger is text here
    const { mentions, text } = parseCopiedValue(
      copied,
      clipboardData.getData(CLIPBOARD_TRIGGERS_TYPE) || chars,
      chars,
    );
    const textarea = event.currentTarget;
    const { selectionEnd: to, selectionStart: from } = textarea;
    // Plain text - or text the browser cuts at `maxLength`, which would cut
    // a mention - is pasted by the browser
    if (
      mentions.length === 0 ||
      (maxLength !== undefined &&
        parsed.text.length - (to - from) + text.length > maxLength)
    ) {
      return;
    }

    event.preventDefault();
    replaceText(textarea, { from, mentions, text, to });
  };

  // The caret of a value set without the browser, once it renders
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    const textarea = textareaRef.current;
    if (caret === null || !textarea) return;
    pendingCaret.current = null;
    const position = Math.min(caret, textarea.value.length);
    textarea.setSelectionRange(position, position);
    lastCaret.current = position;
  });

  // The layer of the highlights scrolls with the text - also as its content
  // changes, and before a popover placed at the caret measures it (the
  // listeners of the window capture the scroll in the order they came)
  const syncScroll = () => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) return;
    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
  };
  useLayoutEffect(syncScroll);

  useEffect(() => {
    const handleScroll = (event: Event) => {
      const textarea = textareaRef.current;
      const overlay = overlayRef.current;
      if (!textarea || !overlay || event.target !== textarea) return;
      overlay.scrollTop = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  // The counter, as `Textarea` has it - the characters as the field shows
  // them, a line break as one
  const count = parsed.text.replace(/\r\n?/g, "\n").length;
  const limit =
    typeof maxLength === "number" && maxLength >= 0 ? maxLength : undefined;
  const remaining = limit === undefined ? undefined : limit - count;
  const counterText =
    limit === undefined
      ? formatNumber(locale.code, count)
      : formatMessage(messages.textarea.characterCount, {
          count: formatNumber(locale.code, count),
          max: formatNumber(locale.code, limit),
        });
  const limitMessage =
    remaining === undefined || limit === undefined
      ? ""
      : remaining < 0
        ? formatPlural(
            locale.code,
            messages.textarea.charactersOver,
            -remaining,
          )
        : remaining <= Math.max(10, limit / 10)
          ? formatPlural(
              locale.code,
              messages.textarea.charactersLeft,
              remaining,
            )
          : "";
  const [countAnnouncement, setCountAnnouncement] = useState("");

  useEffect(() => {
    if (!showCount || !isFocused) return;
    const timeout = setTimeout(
      () => setCountAnnouncement(limitMessage),
      COUNT_ANNOUNCE_DELAY,
    );
    return () => clearTimeout(timeout);
  }, [isFocused, limitMessage, showCount]);

  // The text again, in the layer under the field - the mentions highlighted,
  // and a mark where the list of the typed mention is placed
  const overlayContent: React.ReactNode[] = [];
  const markerAt = isListShown && query ? query.start : -1;
  let cursor = 0;
  const pushText = (to: number) => {
    if (markerAt >= cursor && markerAt < to) {
      overlayContent.push(
        parsed.text.slice(cursor, markerAt),
        // A new mark as the query changes - the list is placed anew, also
        // when the query wraps onto the next line
        <span
          data-mention-caret=""
          key={`caret-${queryText}`}
          ref={setMarker}
        />,
        parsed.text.slice(markerAt, to),
      );
    } else {
      overlayContent.push(parsed.text.slice(cursor, to));
    }
    cursor = to;
  };
  for (const mention of parsed.mentions) {
    pushText(mention.start);
    overlayContent.push(
      <span
        className="rounded-sm bg-primary-100 shadow-[0_0_0_1px_var(--color-primary-200)] dark:bg-primary-900 dark:shadow-[0_0_0_1px_var(--color-primary-800)] forced-colors:bg-transparent forced-colors:shadow-none forced-colors:outline-1 forced-colors:outline-[Highlight] forced-colors:outline-solid"
        data-mention=""
        key={`mention-${mention.start}`}
      >
        {parsed.text.slice(mention.start, mention.end)}
      </span>,
    );
    cursor = mention.end;
  }
  pushText(parsed.text.length);

  const rowsHeight = (rows: number) =>
    `calc(${rows}lh + ${verticalPaddings[dim]} + 2px)`;
  const sizeStyle: React.CSSProperties = {
    maxHeight:
      autosize && maxRows !== undefined ? rowsHeight(maxRows) : undefined,
    minHeight:
      autosize && minRows !== undefined ? rowsHeight(minRows) : undefined,
  };

  const field = (
    <div className="relative">
      {/* Under the text, as big as the field: the same font, padding and
          border, so the highlights lie under their words. With `autosize`
          it is the copy of the text that gives the field its height. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none scrollbar-gutter-stable overflow-hidden rounded-md border border-transparent bg-surface wrap-break-word whitespace-pre-wrap text-transparent forced-color-adjust-none select-none dark:bg-surface-dark forced-colors:bg-[Field]",
          dimStyles[dim],
          autosize ? "relative" : "absolute inset-0",
          disabled && "opacity-50",
        )}
        data-mention-overlay=""
        ref={overlayRef}
        style={autosize ? { ...style, ...sizeStyle } : style}
      >
        {overlayContent}
        {/* A last empty line has a height too */}{" "}
      </div>
      <textarea
        {...props}
        aria-activedescendant={
          activeIndex >= 0 ? optionId(activeIndex) : undefined
        }
        aria-autocomplete={offersSuggestions ? "list" : undefined}
        aria-controls={isListShown ? listboxId : undefined}
        aria-describedby={joinTokens(
          errorId,
          descriptionId,
          props["aria-describedby"],
        )}
        aria-invalid={error ? "true" : props["aria-invalid"]}
        aria-required={required ? "true" : props["aria-required"]}
        className={cn(
          "relative block form-control scrollbar-gutter-stable bg-transparent! wrap-break-word dark:bg-transparent!",
          dimStyles[dim],
          autosize ? "absolute inset-0 h-full resize-none" : "resize-y",
          disabled && "cursor-not-allowed",
          // Forced colors (Windows High Contrast) draw every border in one
          // color - an outline makes the border of an invalid field thicker
          error &&
            "border-danger-500! focus:ring-danger-500! forced-colors:outline-1",
        )}
        data-disabled={disabled ? "" : undefined}
        data-invalid={invalid ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        disabled={disabledProp}
        form={form}
        id={textareaId}
        maxLength={maxLength}
        onBlur={(event) => {
          setIsFocused(false);
          setCountAnnouncement("");
          onBlur?.(event);
        }}
        onChange={handleChange}
        onCompositionEnd={(event) => {
          isComposing.current = false;
          updateQuery(event.currentTarget);
          onCompositionEnd?.(event);
        }}
        onCompositionStart={(event) => {
          isComposing.current = true;
          onCompositionStart?.(event);
        }}
        onCopy={handleCopy}
        onCut={handleCut}
        onFocus={(event) => {
          setIsFocused(true);
          // Closed by leaving the field - it opens again on coming back
          setDismissedAt(null);
          updateQuery(event.currentTarget);
          onFocus?.(event);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onScroll={(event) => {
          syncScroll();
          onScroll?.(event);
        }}
        onSelect={(event) => {
          const textarea = event.currentTarget;
          if (!isComposing.current) skipMention(textarea);
          updateQuery(textarea);
          onSelect?.(event);
        }}
        placeholder={placeholder}
        readOnly={readOnly}
        ref={textareaCallbackRef}
        required={required}
        style={style}
        value={parsed.text}
      />
    </div>
  );

  const listLabel = trigger?.label ?? messages.mentionInput.suggestions;
  const liveText = inserted || announcedStatus;

  return (
    <div className={cn("cui-field flex flex-col gap-1.5", className)}>
      {hasContent(label) && (
        <label
          className={cn(
            fieldLabelClass(dim),
            "block truncate text-sm font-medium",
          )}
          htmlFor={textareaId}
        >
          {label}
          {messages.form.labelSuffix}{" "}
          {/* The star is for the eye - `required` tells assistive technology */}
          {required && <RequiredMark />}
        </label>
      )}

      <Popover
        anchor={marker ?? undefined}
        className="w-full"
        // The textarea is the field - the wrapper is no button around it
        interactiveTrigger
        // A click in the field moves the caret - the caret decides whether
        // the list shows, not a toggle
        onClick={(event) => event.preventDefault()}
        onOpenChange={(open) => {
          if (!open && query) setDismissedAt(query.start);
        }}
        offset={4}
        open={isListShown}
        // The panel only wraps the listbox - no unnamed dialog around it
        popupRole="listbox"
        position="bottom"
        trigger={field}
        triggerType="click"
        width="16rem"
      >
        <ul
          aria-label={listLabel}
          className={listDimStyles[dim]}
          id={listboxId}
          // A click on a suggestion keeps the focus in the field
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
        >
          {options.map((option, index) => {
            const active = index === activeIndex;
            return (
              <li
                aria-disabled={option.disabled || undefined}
                aria-selected={active}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5",
                  option.disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer",
                  active
                    ? "bg-neutral-100 dark:bg-neutral-800 forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
                    : !option.disabled &&
                        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                )}
                data-disabled={option.disabled ? "" : undefined}
                data-highlighted={active ? "" : undefined}
                id={optionId(index)}
                key={optionKeys[index]}
                onClick={option.disabled ? undefined : () => pick(option)}
                onMouseMove={(event) => handleHover(event, index)}
                role="option"
              >
                {option.icon && (
                  <span className="flex shrink-0 items-center">
                    {option.icon}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate">
                    <HighlightedLabel label={option.label} query={queryText} />
                  </span>
                  {option.description && (
                    <span className="block truncate text-xs text-neutral-600 dark:text-neutral-400">
                      {option.description}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {/* The state of the list is no option - the live region next to the
            field announces it */}
        <div onMouseDown={(event) => event.preventDefault()}>
          {isLoading && options.length === 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-600 dark:text-neutral-400">
              {messages.common.loading}
              <Spinner aria-hidden="true" size="sm" />
            </div>
          )}
          {!isLoading && !loadFailed && options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-neutral-600 dark:text-neutral-400">
              {messages.mentionInput.noResults}
            </p>
          )}
          {loadFailed && (
            <p
              className="px-2 py-1.5 text-sm text-danger-700 dark:text-danger-400"
              role="alert"
            >
              {messages.mentionInput.loadError}
            </p>
          )}
        </div>
      </Popover>

      {/* There while the list is open - empty as it opens, the state comes
          after a pause, so it is read out - and while it tells of the
          mention just inserted */}
      {(isListShown || inserted !== "") && (
        <div className="sr-only" role="status">
          {liveText}
        </div>
      )}

      {name && (
        <input
          disabled={disabled}
          form={form}
          name={name}
          type="hidden"
          value={currentValue}
        />
      )}

      {showCount ? (
        <div className="flex items-start gap-2">
          <FormDescription className="min-w-0 flex-1" id={descriptionId}>
            {description}
          </FormDescription>
          <p
            className={cn(
              "ms-auto shrink-0 text-xs tabular-nums",
              // One color or the other - with both, the CSS order decides
              remaining !== undefined && remaining < 0
                ? "text-danger-700 dark:text-danger-400"
                : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            {counterText}
          </p>
          <span className="sr-only" role="status">
            {countAnnouncement}
          </span>
        </div>
      ) : (
        <FormDescription id={descriptionId}>{description}</FormDescription>
      )}
      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}

export type {
  LoadMentionSuggestions,
  Mention,
  MentionLoadContext,
  MentionOptions,
  MentionSuggestion,
  MentionTrigger,
} from "./markup";
