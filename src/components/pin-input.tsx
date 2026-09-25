import { attachRef, useFormReset } from "../hooks/use-form-control";
import { useCallback, useId, useRef, useState } from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../providers/ui-context";

type PinType = "numeric" | "alphanumeric";

export interface PinInputProps {
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
   * Id of the first cell - the ids of the other cells and of the messages
   * derive from it.
   */
  id?: string;
  /** Text of the `<label>` above the cells - the name of the group of cells. */
  label?: string;
  /** Number of cells - of characters of the code. */
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
  /** Ref to the first cell - e.g. for `focus()`. */
  ref?: React.Ref<HTMLInputElement>;
  /** All cells must be filled before the form can be submitted. */
  required?: boolean;
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
 * like of a pasted "123 456" are left out.
 */
function sanitize(text: string, type: PinType) {
  const allowed = type === "numeric" ? NUMERIC : ALPHANUMERIC;
  return Array.from(text)
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
  id,
  label,
  length = 6,
  mask = false,
  name,
  onBlur,
  onChange,
  onComplete,
  onFocus,
  placeholder,
  ref,
  required = false,
  type = "numeric",
  value,
}: PinInputProps) {
  const messages = useMessages();

  // What the user entered into an uncontrolled field. Until then, and again
  // after a reset, it shows `defaultValue` - also one that arrived late.
  const [enteredValue, setEnteredValue] = useState<string>();
  const isControlled = value !== undefined;
  const code = (
    isControlled ? value : (enteredValue ?? defaultValue ?? "")
  ).slice(0, length);

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
  const formResetRef = useFormReset(() => setEnteredValue(undefined), form);

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

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    // The keys of an input method editor (IME) composing text
    if (event.nativeEvent.isComposing) return;

    const { key } = event;

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

  const handleChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const text = event.target.value;
    const current = code[index] ?? "";

    // Emptied - by the Backspace of a phone keyboard, or cut
    if (!text) {
      if (current) remove(index);
      return;
    }

    // Typed next to the character of the cell instead of over it
    const typed =
      current && text.length === 2
        ? text.startsWith(current)
          ? text.slice(1)
          : text.endsWith(current)
            ? text.slice(0, -1)
            : text
        : text;
    insert(index, typed);
  };

  const handleFocus = (
    index: number,
    event: React.FocusEvent<HTMLInputElement>,
  ) => {
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

      <div
        aria-label={label || ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={label ? labelId : ariaLabelledBy}
        className={cn("grid gap-2", className)}
        ref={groupRef}
        role="group"
        // Columns that shrink - a row wider than the screen of a phone does
        // not stretch the page
        style={{
          gridTemplateColumns: `repeat(${length}, minmax(0, ${cellWidths[dim]}))`,
        }}
      >
        {Array.from({ length }, (_, index) => (
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
              "w-full min-w-0 rounded-md border border-neutral-300 bg-surface p-0 text-center font-medium transition-colors placeholder:text-neutral-500 focus:ring-2 focus:ring-primary-500 focus:outline-none motion-reduce:transition-none dark:border-neutral-700 dark:bg-surface-dark dark:placeholder:text-neutral-400",
              cellSizeStyles[dim],
              error && "border-danger-500! focus:ring-danger-500!",
              // Also for a disabled fieldset around, which no prop tells
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={disabled}
            form={form}
            id={cellId(index)}
            inputMode={type === "numeric" ? "numeric" : "text"}
            key={index}
            onBlur={handleBlur}
            onChange={(event) => handleChange(index, event)}
            onFocus={(event) => handleFocus(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => {
              event.preventDefault();
              insert(index, event.clipboardData.getData("text"));
            }}
            placeholder={placeholder}
            ref={index === 0 ? firstCellRef : undefined}
            required={required}
            spellCheck={false}
            // One tab stop - the arrow keys move between the cells
            tabIndex={index === activeIndex ? 0 : -1}
            type={mask ? "password" : "text"}
            value={code[index] ?? ""}
          />
        ))}
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
