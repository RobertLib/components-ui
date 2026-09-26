import { X } from "lucide-react";
import { attachRef, useFormReset } from "../hooks/use-form-control";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import Popover from "./popover";
import { foldSearchText } from "../utils/remove-diacritics";
import usePointerMoved from "../hooks/use-pointer-moved";
import { formatMessage, formatPlural } from "../i18n/format";
import { useLocale } from "../providers/ui-context";

export interface TagsInputProps extends Omit<
  React.ComponentProps<"input">,
  "className" | "defaultValue" | "onChange" | "size" | "type" | "value"
> {
  /**
   * Adds the typed text as a value when the focus leaves the field too -
   * also for a click on the submit button. Text it refuses stays in the
   * input, and keeps the form from being submitted without it.
   */
  addOnBlur?: boolean;
  /**
   * Lets a value be in the list more than once. Values are compared
   * ignoring case - "Anna" is in a list with "anna".
   */
  allowDuplicates?: boolean;
  /**
   * Classes of the outer wrapper around the label, the field and the
   * messages - not of the field itself.
   */
  className?: string;
  /** Initial values of an uncontrolled field. */
  defaultValue?: string[];
  /** Help text under the field - it describes the input. */
  description?: React.ReactNode;
  /**
   * Disables the field - like a disabled native one, it is then neither
   * submitted nor validated.
   */
  disabled?: boolean;
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the hidden inputs belong to, when the field is not
   * inside it - like the `form` attribute of a native field. A reset of
   * that form resets the field too.
   */
  form?: string;
  /** Text of the `<label>` above the field. */
  label?: string;
  /**
   * The most values the list takes - more are refused, and the field says
   * so.
   */
  maxTags?: number;
  /**
   * Submits every value in a hidden input of this name -
   * `formData.getAll(name)` returns them. Without a value nothing is
   * submitted; the typed text is not a value until it is added.
   */
  name?: string;
  /** Called with the new values whenever one is added or removed. */
  onChange?: (tags: string[]) => void;
  /**
   * The values can't be changed - they are shown and submitted, and no ×
   * buttons, typing, pasting or suggestions add or remove any.
   */
  readOnly?: boolean;
  /**
   * At least one value must be in the list before the form can be
   * submitted - the browser says so.
   */
  required?: boolean;
  /**
   * Texts that end a value as they are typed - and split pasted text, as
   * line breaks do. Enter always adds the typed text.
   */
  separators?: string[];
  /**
   * Values offered as the user types - matched ignoring case and
   * diacritics. The arrow keys move through them, Enter adds the
   * highlighted one; any other text can still be added. They may arrive
   * while the user types (loaded for the typed text).
   */
  suggestions?: string[];
  /**
   * Checks a value before it is added - returns why it cannot be (shown
   * under the field, the text stays in the input), or nothing when it is
   * fine.
   */
  validate?: (tag: string) => string | null | undefined;
  /** Values of a controlled field. */
  value?: string[];
}

const DEFAULT_SEPARATORS = [","];

const normalizeText = foldSearchText;

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits text at the separators - and at line breaks with `lines`. */
function splitTags(text: string, separators: string[], lines: boolean) {
  const patterns = separators.filter(Boolean).map(escapeRegExp);
  if (lines) patterns.push("\\r?\\n", "\\r", "\\t");
  return patterns.length === 0
    ? [text]
    : text.split(new RegExp(patterns.join("|")));
}

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

/**
 * Free-form values in one field - e-mail recipients, keywords. Enter or a
 * separator adds the typed text, pasted text is split into values, and
 * every value has a × button. Backspace in the empty input moves to the
 * last value, a second one removes it; the arrow keys move between the
 * values. `suggestions` makes it a combobox that offers values as the user
 * types.
 */
export default function TagsInput({
  addOnBlur = false,
  allowDuplicates = false,
  "aria-describedby": ariaDescribedBy,
  className,
  defaultValue,
  description,
  disabled = false,
  error,
  form,
  id,
  label,
  maxTags,
  name,
  onBlur,
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
  readOnly = false,
  ref,
  required = false,
  separators = DEFAULT_SEPARATORS,
  suggestions,
  validate,
  value,
  ...props
}: TagsInputProps) {
  const locale = useLocale();
  const { messages } = locale;

  // The values of an uncontrolled field. Until the user changes them, and
  // again after a reset, it shows `defaultValue` - also one that arrived
  // late.
  const [enteredTags, setEnteredTags] = useState<string[]>();
  const [text, setText] = useState("");
  // Why the typed text was not added
  const [inputError, setInputError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const isControlled = value !== undefined;
  const tags = isControlled ? value : (enteredTags ?? defaultValue ?? []);

  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const inputErrorId = inputError ? `${inputId}-input-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const listboxId = `${generatedId}-listbox`;
  const optionId = (index: number) => `${generatedId}-option-${index}`;

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue`, like it does for a native field
  const formResetRef = useFormReset(() => {
    setEnteredTags(undefined);
    setText("");
    setInputError(null);
    setListOpen(false);
  }, form);

  const inputCallbackRef = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      const detachReset = formResetRef(element);
      const detachRef = attachRef(ref, element);

      return () => {
        inputRef.current = null;
        detachReset?.();
        detachRef();
      };
    },
    [formResetRef, ref],
  );

  // The browser refuses to submit a required field without a value - and
  // says so at the input. So it does while the input holds text that was
  // refused (a click on the submit button with `addOnBlur`), which the form
  // would lose. Set at every render: the message belongs to the input
  // element, and a new one would start without it.
  const validationMessage =
    inputError ??
    (required && tags.length === 0 ? messages.tagsInput.required : "");

  useLayoutEffect(() => {
    inputRef.current?.setCustomValidity(validationMessage);
  });

  // Set when the × button with the focus goes away with its value - should
  // the focus get lost after all (with the button of a duplicate), it goes
  // to the input
  const removedWithFocus = useRef(false);

  useLayoutEffect(() => {
    if (!removedWithFocus.current) return;
    removedWithFocus.current = false;

    const active = document.activeElement;
    if (!active || active === document.body) inputRef.current?.focus();
  });

  const commit = (next: string[]) => {
    if (!isControlled) setEnteredTags(next);
    onChange?.(next);
  };

  // What the typed text is matched with - the suggestions not in the list
  const query = normalizeText(text.trim());
  const shownSuggestions = (suggestions ?? []).filter(
    (suggestion) =>
      (allowDuplicates || !tags.some((tag) => sameTag(tag, suggestion))) &&
      normalizeText(suggestion).includes(query),
  );
  // A read-only field shows and submits its values but takes no changes
  const locked = disabled || readOnly;
  const isListShown = listOpen && !locked && shownSuggestions.length > 0;
  const active = activeIndex < shownSuggestions.length ? activeIndex : -1;

  // Rejected text goes back into the input, joined as it would be typed
  const firstSeparator = separators[0] ?? "";
  const joiner = firstSeparator.trim()
    ? `${firstSeparator} `
    : firstSeparator || " ";

  /**
   * Adds the candidates that pass - returns the ones refused and why the
   * first of them was.
   */
  const addTags = (candidates: string[]) => {
    const next = [...tags];
    const refused: string[] = [];
    let reason: string | null = null;

    for (const candidate of candidates) {
      const typed = candidate.trim();
      if (!typed) continue;

      // A suggestion typed in another case is added as it is spelled there
      const tag =
        suggestions?.find((suggestion) => sameTag(suggestion, typed)) ?? typed;
      const problem =
        maxTags !== undefined && next.length >= maxTags
          ? formatPlural(locale.code, messages.tagsInput.maxTags, maxTags)
          : !allowDuplicates && next.some((existing) => sameTag(existing, tag))
            ? formatMessage(messages.tagsInput.duplicate, { tag })
            : validate?.(tag) || null;

      if (problem) {
        refused.push(typed);
        reason = reason ?? problem;
      } else {
        next.push(tag);
      }
    }

    if (next.length > tags.length) commit(next);
    return { reason, refused };
  };

  /** Adds `parts` - what is refused stays in the input, before `rest`. */
  const addParts = (parts: string[], rest: string) => {
    const { reason, refused } = addTags(parts);
    const remaining = [...refused, rest.trimStart()].filter(Boolean);

    setText(remaining.join(joiner));
    setInputError(reason);
    setActiveIndex(-1);
    setListOpen(!reason && remaining.length > 0);
  };

  const handleTextChange = (nextText: string) => {
    // A separator typed - or text with one, e.g. from the keyboard of a
    // phone - ends the values before it
    const parts = splitTags(nextText, separators, false);

    if (parts.length > 1) {
      addParts(parts.slice(0, -1), parts[parts.length - 1]);
      return;
    }

    setText(nextText);
    setInputError(null);
    setActiveIndex(-1);
    setListOpen(nextText.trim() !== "");
  };

  const getTagButtons = () =>
    Array.from(
      fieldRef.current?.querySelectorAll<HTMLElement>("[data-tag-remove]") ??
        [],
    );

  const removeTag = (index: number, button: HTMLElement) => {
    // The focus goes on to the value taking its place, the one before it or
    // the input - it would be lost with the button
    if (button === document.activeElement) {
      const buttons = getTagButtons();
      (buttons[index + 1] ?? buttons[index - 1] ?? inputRef.current)?.focus();
      removedWithFocus.current = true;
    }

    commit(tags.filter((_, i) => i !== index));
    setInputError(null);
  };

  const moveActive = (index: number) => {
    setActiveIndex(index);
    document
      .getElementById(optionId(index))
      ?.scrollIntoView({ block: "nearest" });
  };

  const pointerMoved = usePointerMoved();

  // Only a real move of the pointer highlights the suggestion under it, not
  // the list scrolling beneath it from the keyboard
  const handleHover = (event: React.MouseEvent, index: number) => {
    if (pointerMoved(event)) setActiveIndex(index);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);

    // The keys of an input method editor (IME) composing text - Enter
    // confirms the conversion. Safari sends the confirming Enter after
    // `compositionend`, with the key code 229.
    if (
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }

    const input = event.currentTarget;

    switch (event.key) {
      case "Enter":
        if (locked) break;
        if (isListShown && active >= 0) {
          event.preventDefault();
          addParts([shownSuggestions[active]], "");
        } else if (text.trim()) {
          // Enter in an empty input submits the form, as in any text field
          event.preventDefault();
          addParts([text], "");
        }
        break;
      case "ArrowDown":
        if (!suggestions || locked) break;
        event.preventDefault();
        if (!isListShown) {
          setListOpen(true);
          setActiveIndex(0);
        } else {
          moveActive(active + 1 < shownSuggestions.length ? active + 1 : 0);
        }
        break;
      case "ArrowUp":
        if (!isListShown) break;
        event.preventDefault();
        moveActive(active > 0 ? active - 1 : shownSuggestions.length - 1);
        break;
      case "Escape":
        if (isListShown) {
          // It closes the list and nothing else - not a Dialog around
          event.preventDefault();
          event.stopPropagation();
          setListOpen(false);
          setActiveIndex(-1);
        }
        break;
      case "Backspace":
      case "ArrowLeft":
      case "ArrowRight": {
        // From the start of the input to the last value - Backspace there
        // removes it
        const back =
          event.key === "Backspace" ||
          (event.key === "ArrowLeft") !== isRtl(input);
        const atStart =
          event.key === "Backspace"
            ? input.value === ""
            : input.selectionStart === 0 && input.selectionEnd === 0;
        if (back && atStart && tags.length > 0 && !locked) {
          event.preventDefault();
          getTagButtons().at(-1)?.focus();
        }
        break;
      }
      default:
        break;
    }
  };

  const handleTagKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    const buttons = getTagButtons();

    switch (event.key) {
      case "Backspace":
      case "Delete":
        event.preventDefault();
        removeTag(index, event.currentTarget);
        break;
      case "ArrowLeft":
      case "ArrowRight": {
        event.preventDefault();
        const forward =
          (event.key === "ArrowRight") !== isRtl(event.currentTarget);
        const next = index + (forward ? 1 : -1);
        if (next >= buttons.length) inputRef.current?.focus();
        else buttons[Math.max(next, 0)]?.focus();
        break;
      }
      default:
        // Typing goes on in the input
        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          inputRef.current?.focus();
        }
        break;
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event);
    if (event.defaultPrevented || locked) return;

    const pasted = event.clipboardData.getData("text");
    // A single value is pasted as text - it may be edited before it is added
    if (splitTags(pasted, separators, true).length < 2) return;

    event.preventDefault();
    const input = event.currentTarget;
    const before = text.slice(0, input.selectionStart ?? text.length);
    const after = text.slice(input.selectionEnd ?? text.length);
    addParts(splitTags(before + pasted + after, separators, true), "");
  };

  // Rendered at the end of the field - a key of its own for each value,
  // also for a value in it twice
  const occurrences = new Map<string, number>();
  const tagKeys = tags.map((tag) => {
    const count = occurrences.get(tag) ?? 0;
    occurrences.set(tag, count + 1);
    return `${tag}\u0000${count}`;
  });

  const field = (
    <div
      className={cn(
        "flex max-h-40 w-full flex-wrap items-center gap-1 overflow-y-auto rounded-md border border-neutral-300 bg-surface px-2 py-1 focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700 dark:bg-surface-dark",
        error && "border-danger-500! focus-within:ring-danger-500!",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-text",
      )}
      // The whole field acts as the input: a press on its padding or a value
      // keeps the focus in the input, a click focuses it
      onClick={(event) => {
        if (!disabled) inputRef.current?.focus();
        // Not the popover around - the field opens its list itself
        if (suggestions) event.stopPropagation();
      }}
      onMouseDown={(event) => {
        if (event.target !== inputRef.current) event.preventDefault();
      }}
      ref={fieldRef}
    >
      {tags.map((tag, index) => (
        <span
          className={cn(
            "inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-full border border-neutral-300 bg-surface py-0.5 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-surface-dark dark:text-neutral-200",
            locked ? "px-2" : "ps-2 pe-1",
            // The value the keyboard is on
            "has-focus-visible:border-primary-500 has-focus-visible:bg-primary-50 dark:has-focus-visible:border-primary-400 dark:has-focus-visible:bg-primary-950",
          )}
          key={tagKeys[index]}
        >
          <span className="truncate">{tag}</span>
          {!locked && (
            <button
              aria-label={formatMessage(messages.tagsInput.remove, { tag })}
              className="relative shrink-0 cursor-pointer rounded-full p-0.5 text-neutral-500 after:absolute after:-inset-1 after:content-[''] hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              data-tag-remove=""
              onClick={(event) => removeTag(index, event.currentTarget)}
              onKeyDown={(event) => handleTagKeyDown(index, event)}
              // The input keeps the focus
              onMouseDown={(event) => event.preventDefault()}
              // One tab stop - the input; the arrow keys and Backspace
              // reach the buttons from it
              tabIndex={-1}
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          )}
        </span>
      ))}
      <input
        {...props}
        aria-activedescendant={
          isListShown && active >= 0 ? optionId(active) : undefined
        }
        aria-autocomplete={suggestions ? "list" : undefined}
        aria-controls={isListShown ? listboxId : undefined}
        aria-describedby={joinTokens(
          inputErrorId,
          errorId,
          descriptionId,
          ariaDescribedBy,
        )}
        aria-expanded={suggestions ? isListShown : undefined}
        aria-invalid={error || inputError ? "true" : props["aria-invalid"]}
        aria-required={required ? "true" : props["aria-required"]}
        // The browser's own suggestions would cover the list
        autoComplete={props.autoComplete ?? (suggestions ? "off" : undefined)}
        className="w-16 min-w-16 grow bg-transparent focus:outline-none disabled:cursor-not-allowed"
        disabled={disabled}
        form={form}
        id={inputId}
        onBlur={(event) => {
          onBlur?.(event);
          // Moving to a × button stays in the field
          if (
            addOnBlur &&
            !locked &&
            text.trim() &&
            !fieldRef.current?.contains(event.relatedTarget)
          ) {
            addParts([text], "");
          }
        }}
        onChange={(event) => handleTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={tags.length > 0 ? undefined : placeholder}
        readOnly={readOnly}
        ref={inputCallbackRef}
        role={suggestions ? "combobox" : undefined}
        type="text"
        value={text}
      />
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="block text-sm font-medium" htmlFor={inputId}>
          {label}
          {messages.form.labelSuffix}{" "}
          {/* The star is for the eye - `aria-required` tells assistive technology */}
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

      {/* Around the field also without suggestions - they may come later
          (loaded as the user types), and a field moved into the popover
          would be a new one, without the focus */}
      <Popover
        className="w-full"
        // The input is the combobox - the wrapper is no button around it
        interactiveTrigger
        onOpenChange={(open) => {
          if (open) return;
          setListOpen(false);
          setActiveIndex(-1);
        }}
        open={isListShown}
        // The panel only wraps the listbox - no unnamed dialog around it
        popupRole="listbox"
        position="bottom"
        trigger={field}
        triggerType="click"
        width="100%"
      >
        <ul
          aria-label={messages.tagsInput.suggestions}
          id={listboxId}
          // A click on a suggestion keeps the focus in the input
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
        >
          {shownSuggestions.map((suggestion, index) => (
            <li
              aria-selected={index === active}
              className={cn(
                "cursor-pointer px-2 py-1",
                index === active
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
              )}
              id={optionId(index)}
              key={`${suggestion}\u0000${index}`}
              onClick={() => addParts([suggestion], "")}
              onMouseMove={(event) => handleHover(event, index)}
              role="option"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      </Popover>

      {name &&
        tags.map((tag, index) => (
          <input
            disabled={disabled}
            form={form}
            key={tagKeys[index]}
            name={name}
            type="hidden"
            value={tag}
          />
        ))}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={inputErrorId}>{inputError}</FormError>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
