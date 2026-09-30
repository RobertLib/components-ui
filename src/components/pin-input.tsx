import { attachRef, useFormReset } from "../hooks/use-form-control";
import {
  useCallback,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { toLatinDigit } from "./input-mask";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../providers/ui-context";
import RequiredMark from "./required-mark";

type PinType = "numeric" | "alphanumeric";

interface CellComposition {
  code: string;
  element: HTMLInputElement;
  index: number;
  initialText: string;
  length: number;
  replacesCell: boolean;
  type: PinType;
}

/**
 * The attributes of an HTML element not listed here - `data-*`, `style`,
 * `title`, event handlers - go to the row of cells (the group), as
 * `className` does. `id` and `ref` are the first cell's.
 */
export interface PinInputProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "children"
  | "dangerouslySetInnerHTML"
  | "defaultChecked"
  | "defaultValue"
  | "onBlur"
  | "onChange"
  | "onFocus"
> {
  /**
   * Id of the element describing the field - the error message and the
   * description describe it too.
   */
  "aria-describedby"?: string;
  /** Accessible name of a field without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a field without `label`. */
  "aria-labelledby"?: string;
  /** Focuses the first empty cell when the field mounts. */
  autoFocus?: boolean;
  /** Classes of the row of cells - not of the label or the messages. */
  className?: string;
  /** Initial code of an uncontrolled field. */
  defaultValue?: string;
  /** Help text under the cells - it describes the field. */
  description?: React.ReactNode;
  /** Size of the cells. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Disables the field - it is then neither submitted nor validated. */
  disabled?: boolean;
  /** Validation message - also marks the cells as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the field belongs to, when it is not inside it -
   * like the `form` attribute of a native field. A reset of that form
   * resets the field too.
   */
  form?: string;
  /**
   * Splits the cells into groups of these sizes with a `separator` between
   * them, e.g. `[3, 3]` for "123 - 456". For the eye only: the code is one
   * value, typed and pasted as one. Cells past the groups join the last
   * one.
   */
  groups?: number[];
  /**
   * Id of the first cell - the ids of the other cells and of the messages
   * derive from it.
   */
  id?: string;
  /** Content of the `<label>` above the cells - the name of the group of cells. */
  label?: React.ReactNode;
  /**
   * Number of cells - of characters of the code. 6 by default, or the sum
   * of `groups`.
   */
  length?: number;
  /** Shows dots instead of the characters, as a password field does. */
  mask?: boolean;
  /** Submits the code - the characters joined - in a hidden input of this name. */
  name?: string;
  /** Called when the focus leaves the cells. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Called with the code whenever the user changes it. */
  onChange?: (value: string) => void;
  /**
   * Called with the code once the user has filled all cells - by typing,
   * pasting or the one-time code the phone offers. Also after each change
   * of a complete code, not after a change of `value` by the parent.
   */
  onComplete?: (value: string) => void;
  /** Called when the focus moves into the cells. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Shown in the empty cells, e.g. `"○"`. */
  placeholder?: string;
  /**
   * The cells show the code and take the focus - the arrow keys move
   * between them - but typing, pasting or deleting changes nothing. Unlike
   * a disabled field, the code is submitted with the form. As a native
   * read-only field, it is not validated.
   */
  readOnly?: boolean;
  /** Ref to the first cell - e.g. for `focus()`. */
  ref?: React.Ref<HTMLInputElement>;
  /** All cells must be filled before the form can be submitted. */
  required?: boolean;
  /** Shown between the `groups` of cells - a dash by default. */
  separator?: React.ReactNode;
  /**
   * `numeric` takes digits and opens the number keyboard of phones,
   * `alphanumeric` takes letters and digits.
   */
  type?: PinType;
  /** Code of a controlled field. */
  value?: string;
}

const NUMERIC = /^\d$/;
const ALPHANUMERIC = /^[\da-z]$/i;

/**
 * The characters of `text` a code of `type` takes - spaces, dashes and the
 * like of a pasted "123 456" are left out. Digits of other scripts - the
 * full-width "１２３" of Japanese and Chinese input methods, Arabic-Indic,
 * Persian and Devanagari ones - are taken as the Latin ones, as a mask
 * takes them.
 */
function sanitize(text: string, type: PinType) {
  const allowed = type === "numeric" ? NUMERIC : ALPHANUMERIC;
  return Array.from(text, (char) => toLatinDigit(char) ?? char)
    .filter((char) => allowed.test(char))
    .join("");
}

/**
 * The digit of the key pressed - also where the keyboard layout types
 * another character on it (a Czech one types "ě" on the 2 key).
 */
const digitOfKey = (event: React.KeyboardEvent) =>
  /^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1];

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

// Square cells of their own sizes, larger than the heights of an Input -
// each holds one character
const cellSizeStyles = {
  xs: "h-7 text-sm",
  sm: "h-8 text-sm",
  md: "h-10 text-lg",
  lg: "h-12 text-xl",
};

// The width of a cell - the cells get narrower when the row does not fit
const cellWidths = {
  xs: "1.75rem",
  sm: "2rem",
  md: "2.5rem",
  lg: "3rem",
};

const separatorSizes = {
  xs: "text-sm",
  sm: "text-sm",
  md: "text-lg",
  lg: "text-xl",
};

/**
 * The indexes of the cells a separator follows - the ends of the groups,
 * not the end of the code.
 */
function groupEnds(groups: number[] | undefined, length: number) {
  const ends = new Set<number>();
  let end = 0;
  // The cells past the last group belong to it - no separator after it
  for (const size of groups?.slice(0, -1) ?? []) {
    end += Math.max(0, Math.floor(size));
    if (end >= length) break;
    if (end > 0) ends.add(end - 1);
  }
  return ends;
}

/**
 * A one-time code or a PIN in a row of cells, one character each. Typing
 * moves on to the next cell, Backspace goes back, the arrow keys move
 * between the cells; a pasted code - or the one the phone offers from a
 * text message - fills them all. The cells are one tab stop.
 */
export default function PinInput({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  autoFocus = false,
  className,
  defaultValue,
  description,
  dim = "md",
  disabled = false,
  error,
  form,
  groups,
  id,
  label,
  length: lengthProp,
  mask = false,
  name,
  onBlur,
  onChange,
  onComplete,
  onFocus,
  placeholder,
  readOnly = false,
  ref,
  required = false,
  separator,
  type = "numeric",
  value,
  ...props
}: PinInputProps) {
  const messages = useMessages();
  const length =
    lengthProp ??
    (groups ? groups.reduce((sum, size) => sum + Math.max(0, size), 0) : 6);
  const separatorAfter = groupEnds(groups, length);

  // What the user entered into an uncontrolled field. Until then, and again
  // after a reset, it shows `defaultValue` - also one that arrived late.
  const [enteredValue, setEnteredValue] = useState<string>();
  const isControlled = value !== undefined;
  const code = (
    isControlled ? value : (enteredValue ?? defaultValue ?? "")
  ).slice(0, length);

  // A cell keeps the IME's text until it is confirmed; it is not yet part
  // of the code, and must not move the focus or complete the field.
  const composition = useRef<CellComposition | null>(null);
  const canceledComposition = useRef<CellComposition | null>(null);
  const [composingText, setComposingText] = useState<
    | (Pick<CellComposition, "code" | "index" | "length" | "type"> & {
        text: string;
      })
    | null
  >(null);
  // Some browsers send the committed text once more after compositionend,
  // on the original cell even though confirming it has moved the focus.
  const completedComposition = useRef<{
    element: HTMLInputElement;
    text: string;
  } | null>(null);

  const cancelComposition = () => {
    if (composition.current) {
      canceledComposition.current = composition.current;
      composition.current = null;
    }
  };

  if (
    composingText &&
    (composingText.code !== code ||
      composingText.length !== length ||
      composingText.type !== type ||
      disabled ||
      readOnly)
  ) {
    setComposingText(null);
  }

  // A discarded session stays discarded if its source returns to the old
  // value later. Insertion effects also see commits of a hidden Activity.
  useInsertionEffect(() => {
    const composing = composition.current;
    if (
      composing &&
      (composing.code !== code ||
        composing.length !== length ||
        composing.type !== type ||
        disabled ||
        readOnly)
    ) {
      cancelComposition();
    }
  });

  // The code has no gaps: the next character goes to the first empty cell,
  // which is where Tab stops - the last cell of a complete code
  const activeIndex = Math.min(code.length, length - 1);

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const cellId = (index: number) =>
    index === 0 ? inputId : `${inputId}-${index + 1}`;
  const labelId = `${inputId}-label`;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;

  const groupRef = useRef<HTMLDivElement>(null);
  // Set while the field moves the focus itself - a cell after the first
  // empty one may take it then, e.g. after a paste
  const movingFocus = useRef(false);

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue`, like it does for a native field
  const formResetRef = useFormReset(() => {
    // Its final event may still arrive after the reset. Keep the canceled
    // session until it ends so neither that event nor its trailing input
    // can put the discarded text back into the code.
    cancelComposition();
    completedComposition.current = null;
    setComposingText(null);
    setEnteredValue(undefined);
  }, form);

  const firstCellRef = useCallback(
    (element: HTMLInputElement | null) => attachRef(ref, element),
    [ref],
  );

  const focusCell = (index: number) => {
    const cell =
      groupRef.current?.querySelectorAll<HTMLInputElement>("input")[index];
    if (!cell) return;

    movingFocus.current = true;
    cell.focus();
    movingFocus.current = false;
    // Typing replaces the character
    cell.select();
  };

  const commit = (next: string) => {
    if (next === code) return;
    if (!isControlled) setEnteredValue(next);
    onChange?.(next);
    if (next.length === length) onComplete?.(next);
  };

  // Puts `text` into the cells from `index` on, over what they hold, and
  // moves on to the cell after it. A whole code replaces the value wherever
  // it lands - a paste into the second cell as well.
  const insert = (index: number, text: string) => {
    const chars = sanitize(text, type);
    if (!chars) return;

    const isWholeCode = chars.length >= length;
    commit(
      isWholeCode
        ? chars.slice(0, length)
        : (
            code.slice(0, index) +
            chars +
            code.slice(index + chars.length)
          ).slice(0, length),
    );
    focusCell(
      Math.min(isWholeCode ? length : index + chars.length, length - 1),
    );
  };

  // Removes the character of a cell - the ones after it move up
  const remove = (index: number) => {
    commit(code.slice(0, index) + code.slice(index + 1));
    focusCell(index);
  };

  // A code that got shorter under the focus - cleared by the parent after a
  // rejected code, or reset - moves the focus back to the first empty cell
  useLayoutEffect(() => {
    if (composition.current) return;
    const group = groupRef.current;
    if (!group) return;

    const cells = Array.from(group.querySelectorAll("input"));
    const focused = cells.findIndex(
      (cell) => cell === group.ownerDocument.activeElement,
    );
    if (focused > activeIndex) focusCell(activeIndex);
  });

  // The cell a key, a change or a paste acts on - a cell past the first
  // empty one (the parent refused a character) acts on the empty one
  const targetIndex = (index: number) => Math.min(index, activeIndex);

  const handleKeyDown = (
    cellIndex: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    // Candidate editing belongs to the IME. Safari can send its confirming
    // key after compositionend with key code 229 instead of isComposing.
    if (
      composition.current ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }
    completedComposition.current = null;

    const { key } = event;
    const index = targetIndex(cellIndex);

    // Nothing changes a read-only code - Tab and the navigation keys work
    if (readOnly && !["ArrowLeft", "ArrowRight", "End", "Home"].includes(key)) {
      return;
    }

    switch (key) {
      case "Backspace":
        event.preventDefault();
        // An empty cell goes back and clears the one before it
        if (code[index]) {
          remove(index);
        } else if (index > 0) {
          remove(index - 1);
        }
        return;
      case "Delete":
        event.preventDefault();
        if (code[index]) remove(index);
        return;
      case "ArrowLeft":
      case "ArrowRight": {
        event.preventDefault();
        const forward = (key === "ArrowRight") !== isRtl(event.currentTarget);
        const next = index + (forward ? 1 : -1);
        if (next >= 0 && next <= activeIndex) focusCell(next);
        return;
      }
      case "Home":
        event.preventDefault();
        focusCell(0);
        return;
      case "End":
        event.preventDefault();
        focusCell(activeIndex);
        return;
      default:
        break;
    }

    // A character typed on a keyboard - the field puts it in place itself,
    // so the same character typed over itself moves on too. What phone
    // keyboards type comes as a change.
    if (key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    event.preventDefault();
    const digit =
      type === "numeric" && !NUMERIC.test(key) ? digitOfKey(event) : undefined;
    insert(index, digit ?? key);
  };

  const changeText = (
    cellIndex: number,
    text: string,
    replacesCell = false,
  ) => {
    const index = targetIndex(cellIndex);
    const current = code[index] ?? "";

    // Emptied - by the Backspace of a phone keyboard, or cut
    if (!text) {
      if (current) remove(index);
      return;
    }

    // Typed next to the character of the cell instead of over it
    const typed =
      !replacesCell && current && text.length === 2
        ? text.startsWith(current)
          ? text.slice(1)
          : text.endsWith(current)
            ? text.slice(0, -1)
            : text
        : text;
    insert(index, typed);
  };

  const startComposition = (cellIndex: number, element: HTMLInputElement) => {
    const composing: CellComposition = {
      code,
      element,
      index: targetIndex(cellIndex),
      initialText: element.value,
      length,
      replacesCell:
        element.selectionStart === 0 &&
        element.selectionEnd === element.value.length,
      type,
    };
    composition.current = composing;
    canceledComposition.current = null;
    completedComposition.current = null;
    setComposingText({
      code,
      index: composing.index,
      length,
      text: element.value,
      type,
    });
    return composing;
  };

  const handleChange = (
    cellIndex: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const element = event.currentTarget;
    if (readOnly || disabled || element.matches(":disabled")) return;

    const text = element.value;
    const completed = completedComposition.current;
    completedComposition.current = null;
    if (completed?.element === element && completed.text === text) return;

    const nativeComposing = (event.nativeEvent as InputEvent).isComposing;
    if (
      !composition.current &&
      canceledComposition.current?.element === element &&
      nativeComposing
    ) {
      return;
    }

    if (composition.current?.element === element || nativeComposing) {
      const composing =
        composition.current ?? startComposition(cellIndex, element);
      if (
        composing.code !== code ||
        composing.length !== length ||
        composing.type !== type
      ) {
        cancelComposition();
        setComposingText(null);
        return;
      }
      setComposingText({ code, index: composing.index, length, text, type });
      return;
    }

    changeText(cellIndex, text);
  };

  const endComposition = (event: React.CompositionEvent<HTMLInputElement>) => {
    const element = event.currentTarget;
    const active = composition.current;
    const composing =
      active?.element === element
        ? active
        : canceledComposition.current?.element === element
          ? canceledComposition.current
          : null;
    if (!composing) return;

    const text = element.value;
    composition.current = null;
    canceledComposition.current = null;
    completedComposition.current = { element, text };
    setComposingText(null);
    if (
      composing !== active ||
      composing.code !== code ||
      composing.length !== length ||
      composing.type !== type ||
      disabled ||
      readOnly ||
      element.matches(":disabled") ||
      (event.data === "" && text === composing.initialText)
    ) {
      return;
    }

    changeText(composing.index, text, composing.replacesCell);
  };

  const handleFocus = (
    index: number,
    event: React.FocusEvent<HTMLInputElement>,
  ) => {
    if (
      !movingFocus.current &&
      completedComposition.current?.element === event.currentTarget
    ) {
      completedComposition.current = null;
    }
    if (!groupRef.current?.contains(event.relatedTarget)) onFocus?.(event);

    // A click on a cell after the first empty one fills the empty one
    if (!movingFocus.current && index > activeIndex) {
      focusCell(activeIndex);
      return;
    }

    event.currentTarget.select();
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (!groupRef.current?.contains(event.relatedTarget)) onBlur?.(event);
  };

  const cellName =
    type === "numeric" ? messages.pinInput.digit : messages.pinInput.character;

  return (
    <div className="flex flex-col gap-1.5" ref={formResetRef}>
      {label && (
        // Points at the cell the next character goes to
        <label
          className="block text-sm font-medium"
          htmlFor={cellId(activeIndex)}
          id={labelId}
        >
          {label}
          {messages.form.labelSuffix}{" "}
          {/* The star is for the eye - `required` tells assistive technology */}
          {required && <RequiredMark />}
        </label>
      )}

      <div
        {...props}
        aria-label={label || ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={label ? labelId : ariaLabelledBy}
        className={cn("grid items-center gap-2", className)}
        data-disabled={disabled ? "" : undefined}
        data-invalid={error ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        ref={groupRef}
        role="group"
        // Columns that shrink - a row wider than the screen of a phone does
        // not stretch the page. A separator between the groups takes the
        // width it needs.
        style={{
          ...props.style,
          gridTemplateColumns: Array.from(
            { length },
            (_, index) =>
              `minmax(0, ${cellWidths[dim]})${separatorAfter.has(index) ? " auto" : ""}`,
          ).join(" "),
        }}
      >
        {Array.from({ length }, (_, index) => index).flatMap((index) => [
          <input
            // On the cells, which take the focus - not on the group, whose
            // description would be read once more on entering it
            aria-describedby={
              joinTokens(errorId, descriptionId, ariaDescribedBy) || undefined
            }
            aria-invalid={error ? "true" : undefined}
            aria-label={formatMessage(cellName, { index: index + 1, length })}
            autoCapitalize="off"
            // The code a phone offers from a text message goes into one
            // cell - the field spreads it over the others
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoCorrect="off"
            autoFocus={autoFocus && index === activeIndex}
            className={cn(
              // The ring of the focus is a shadow - forced colors (Windows
              // High Contrast) show the outline of `outline-hidden` instead
              "w-full min-w-0 rounded-md border border-neutral-300 bg-surface p-0 text-center font-medium transition-colors placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500 focus:outline-hidden motion-reduce:transition-none dark:border-neutral-700 dark:bg-surface-dark dark:placeholder:text-neutral-400",
              cellSizeStyles[dim],
              // Forced colors draw every border in one color - an outline
              // makes the border of an invalid cell thicker
              error &&
                "border-danger-500! focus:ring-danger-500! forced-colors:outline-1",
              // Also for a disabled fieldset around, which no prop tells
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={disabled}
            form={form}
            data-disabled={disabled ? "" : undefined}
            data-invalid={error ? "" : undefined}
            data-readonly={readOnly ? "" : undefined}
            id={cellId(index)}
            inputMode={type === "numeric" ? "numeric" : "text"}
            key={index}
            onBlur={handleBlur}
            onChange={(event) => handleChange(index, event)}
            onCompositionEnd={endComposition}
            onCompositionStart={(event) => {
              if (
                readOnly ||
                disabled ||
                event.currentTarget.matches(":disabled")
              )
                return;
              startComposition(index, event.currentTarget);
            }}
            onFocus={(event) => handleFocus(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPointerDown={() => {
              completedComposition.current = null;
            }}
            onPaste={(event) => {
              if (composition.current) return;
              event.preventDefault();
              if (readOnly) return;
              completedComposition.current = null;
              insert(targetIndex(index), event.clipboardData.getData("text"));
            }}
            placeholder={placeholder}
            readOnly={readOnly}
            ref={index === 0 ? firstCellRef : undefined}
            required={required}
            spellCheck={false}
            // One tab stop - the arrow keys move between the cells
            tabIndex={index === activeIndex ? 0 : -1}
            type={mask ? "password" : "text"}
            value={
              composingText?.index === index
                ? composingText.text
                : (code[index] ?? "")
            }
          />,
          separatorAfter.has(index) && (
            <span
              aria-hidden="true"
              className={cn(
                "flex items-center justify-center text-neutral-500 select-none dark:text-neutral-400",
                separatorSizes[dim],
              )}
              key={`separator-${index}`}
            >
              {separator ?? "–"}
            </span>
          ),
        ])}
      </div>

      {name && (
        <input
          disabled={disabled}
          form={form}
          name={name}
          type="hidden"
          value={code}
        />
      )}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
