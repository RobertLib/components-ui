import { Eye, EyeOff, X } from "lucide-react";
import {
  attachRef,
  isAriaInvalid,
  useFormControl,
} from "../hooks/use-form-control";
import {
  conformToMask,
  editMasked,
  parseMask,
  type MaskedValue,
  type MaskTokens,
} from "./input-mask";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Button from "./button";
import cn, { joinTokens } from "../utils/cn";
import { formatMessage } from "../i18n/format";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { getPasswordStrength } from "./password-strength";
import RequiredMark from "./required-mark";
import { useMessages } from "../providers/ui-context";
import useCustomValidity from "../hooks/use-custom-validity";

// Types the browser draws a format hint in (dd.mm.yyyy, --:--) while empty -
// a floating label must not cover it
const HINTED_TYPES = new Set([
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

// A password is not cleared at a click, and a number field has spin buttons
const UNCLEARABLE_TYPES = new Set(["number", "password"]);

// The types whose text has a caret a mask can place - not `email` or
// `number`, which give no selection to scripts
const MASKABLE_TYPES = new Set(["password", "search", "tel", "text", "url"]);

// The strength of a password is told to screen readers this long after
// the typing pauses
const ANNOUNCE_DELAY = 750;

// The segments of the strength meter - a score fills as many as it is
// plus one - and their color by the score
const STRENGTH_SEGMENTS = [0, 1, 2, 3, 4];
const strengthColors = [
  "bg-danger-600 dark:bg-danger-500",
  "bg-danger-500 dark:bg-danger-400",
  "bg-warning-500 dark:bg-warning-400",
  "bg-success-500 dark:bg-success-600",
  "bg-success-600 dark:bg-success-400",
];

// What a press inside the border of the field leaves alone: the input, and
// the controls of an adornment (a currency select, a button)
const CONTROL_SELECTOR =
  "a[href], button, input, select, textarea, [contenteditable], [tabindex]";

// All the padding lives here - base padding next to it would win over the
// smaller sizes, as the CSS order decides between two utilities. With the
// border the field is 22, 26 (a `sm` Button), 34 and 46 px high - the
// fields of the library that look like an Input take these sizes.
const dimStyles = {
  xs: "px-1 py-0 text-sm",
  sm: "px-1 py-0.5 text-sm",
  md: "px-2 py-1 text-base",
  lg: "px-3 py-2 text-lg",
};

// The adornments - their inner side is the padding of the input
const adornmentStyles = {
  xs: "text-sm",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};
const prefixPaddings = { xs: "ps-1", sm: "ps-1", md: "ps-2", lg: "ps-3" };
const suffixPaddings = { xs: "pe-1", sm: "pe-1", md: "pe-2", lg: "pe-3" };

// The clear button at the end - a target of 24 × 24 px (WCAG 2.5.8), its
// icon about as far from the border as the text
const clearMargins = {
  xs: "me-0",
  sm: "me-0",
  md: "me-1",
  lg: "me-2",
};
const clearIconSizes = { xs: 14, sm: 14, md: 16, lg: 18 };

// The show / hide button of a password - as high as the field: a `sm`
// Button is 26 px high, one without its vertical padding 22 px
const toggleSizes = { xs: "sm", sm: "sm", md: "md", lg: "lg" } as const;
const toggleIconSizes = { xs: 16, sm: 16, md: 20, lg: 20 };

/** Whether a slot renders anything - the `false` of a condition does not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

/**
 * Whether a press on `target` belongs to a control inside the frame of a
 * field - the input itself, or a button of an adornment - rather than to
 * the frame around them.
 */
function isControlTarget(target: EventTarget, frame: Element) {
  for (
    let node = target instanceof Element ? target : null;
    node && node !== frame;
    node = node.parentElement
  ) {
    if (node.matches(CONTROL_SELECTOR)) return true;
  }
  return false;
}

/** A score of a password scorer as one of the five strengths. */
const toStrength = (score: number) =>
  Number.isFinite(score) ? Math.min(4, Math.max(0, Math.round(score))) : 0;

/**
 * Sets the value of an input past the tracking React does of it - the next
 * input event then reaches `onChange` as if the user had typed.
 */
function setNativeValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(input, value);
}

/**
 * React clears `currentTarget` after dispatch. An IME change reported later
 * needs the input bound again for its handler, like a regular change.
 */
function reportMaskedChange(
  input: HTMLInputElement,
  event: React.ChangeEvent<HTMLInputElement>,
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
) {
  const currentTarget = event.currentTarget;
  event.currentTarget = input;
  try {
    onChange(event);
  } finally {
    event.currentTarget = currentTarget;
  }
}

export interface InputProps extends Omit<
  React.ComponentProps<"input">,
  "prefix"
> {
  /**
   * Classes of the `<input>` itself - not of the wrapper around it, its
   * label, description or error message.
   */
  className?: string;
  /**
   * Adds a button that clears the field while it has a value - not in a
   * password or number field, nor in a disabled or read-only one. The clear
   * is a change like typing: `onChange` gets an event with an empty value,
   * and the focus moves into the field.
   */
  clearable?: boolean;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /**
   * Places the label inside the field, floating up once it has a value -
   * also one the browser autofilled, and always for the date and time
   * types, whose empty field shows the format, and with a `prefix`.
   */
  floating?: boolean;
  /**
   * The `<label>` of the field - a text, or content like a text with an
   * icon. Without a label give the field an `aria-label`.
   */
  label?: React.ReactNode;
  /**
   * Formats the text as it is typed: `#` stands for a digit, `@` for a
   * letter, `*` for a letter or a digit, and any other character is written
   * as it is (a backslash before `#`, `@` or `*` writes that one too) -
   * `"### ##"` makes "12345" the Czech postal code "123 45",
   * `"+420 ### ### ###"` formats a phone number, `"CZ## #### #### #### ####
   * ####"` an IBAN. Typed and pasted text goes into the placeholders, with
   * or without the literals; characters no placeholder takes are refused.
   * The field shows, submits and gives `onChange` the formatted text - see
   * `unmask` and `onMaskChange` for the characters alone. A value of the
   * parent is formatted too. A value filled in only in part is invalid, the
   * browser refuses to submit it. For the types `text`, `tel`, `search`,
   * `url` and `password`.
   */
  mask?: string;
  /**
   * Placeholders of your own for `mask`, by the character that stands for
   * them - `{ H: /[0-9a-f]/i }` for a hex digit, or with a `transform`:
   * `{ A: { pattern: /[A-Z]/, transform: (char) => char.toUpperCase() } }`.
   */
  maskTokens?: MaskTokens;
  /**
   * With a `mask`, called whenever the user changes the value - with the
   * text as shown (`formatted`), the characters of the placeholders alone
   * (`raw`) and whether all of them are filled (`complete`).
   */
  onMaskChange?: (value: MaskedValue) => void;
  /**
   * With `type="password"`, shows how strong the typed password is - a
   * meter and a text under the field ("Password strength: weak"), told to
   * screen readers once the typing pauses. `true` scores the password with
   * `getPasswordStrength`; a function is a scorer of your own that returns
   * 0 (very weak) to 4 (strong).
   */
  passwordStrength?: boolean | ((password: string) => number);
  /**
   * Content before the text, inside the border of the field - an icon,
   * `https://`, a currency symbol. A click on it focuses the field.
   * Screen readers do not tie it to the field - say what matters (a unit)
   * in the label or the `description`.
   */
  prefix?: React.ReactNode;
  /**
   * Content after the text, inside the border of the field - a unit like
   * `Kč` or `%`, an icon. A click on it focuses the field. Screen readers
   * do not tie it to the field - say what matters in the label or the
   * `description`.
   */
  suffix?: React.ReactNode;
  /**
   * With a `mask` and a `name`, the form gets the characters of the
   * placeholders alone (`12345` for `123 45`) - from a hidden input, as
   * `NumberInput` submits its number. The field still shows the formatted
   * text and gives it to `onChange`. Not for React Hook Form's
   * `register()`, which reads the field itself - convert its value with
   * `setValueAs: (text) => applyMask(mask, text).raw` instead.
   */
  unmask?: boolean;
}

/** The props of `InputBase` - those of `Input` and what the library adds. */
interface InputBaseProps extends InputProps {
  /**
   * Controls at the end of the field, inside its border and flush with it -
   * the step buttons of `NumberInput`.
   */
  controls?: React.ReactNode;
}

/**
 * `Input`, with the extras the fields of the library build on it need - see
 * `NumberInput`.
 */
export function InputBase({
  className,
  clearable = false,
  controls,
  defaultValue,
  description,
  dim = "md",
  disabled,
  error,
  floating = false,
  id,
  label,
  mask,
  maskTokens,
  name,
  onCompositionEnd,
  onMaskChange,
  passwordStrength = false,
  prefix,
  ref,
  required,
  suffix,
  unmask = false,
  ...props
}: InputBaseProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const messages = useMessages();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // The input is needed here too - for the clear button and a click on an
  // adornment
  const ownRef = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      const detachRef = attachRef(ref, element);

      return () => {
        inputRef.current = null;
        detachRef();
      };
    },
    [ref],
  );

  // A value a script writes into the input - React Hook Form's
  // `register()`, `setValue()` - stays, and the clear button follows it
  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    defaultValue,
    followScriptWrites: true,
    ref: ownRef,
  });

  const type = props.type ?? "text";
  const isPassword = type === "password";
  const inputType = isPassword ? (passwordVisible ? "text" : "password") : type;

  // The field shows its value laid into the mask - also one of the parent,
  // `defaultValue` or a script written without the literals
  const parsedMask =
    mask !== undefined && MASKABLE_TYPES.has(type)
      ? parseMask(mask, maskTokens)
      : null;
  // The value the field reported last, while a parent that keeps the raw
  // characters gives them back: they need not read as what was typed - the
  // raw "070" of `07### ######` is also its own text "070", and the typed
  // "+42" of `+420` has none. Given the formatted text, or another value,
  // the field reads it again.
  const [reported, setReported] = useState<MaskedValue | null>(null);
  const text = String(value);
  const keepsReported =
    !!reported && text === reported.raw && text !== reported.formatted;
  if (reported && !keepsReported) setReported(null);
  const masked = parsedMask
    ? keepsReported &&
      conformToMask(parsedMask, reported.formatted).raw === reported.raw
      ? reported
      : conformToMask(parsedMask, text)
    : null;
  // The text an input method (IME) is composing - the mask waits for it
  const [composingText, setComposingText] = useState<string | null>(null);
  // The last change event of the composition - reported once it ends
  const compositionEvent = useRef<React.ChangeEvent<HTMLInputElement> | null>(
    null,
  );
  const shownValue = masked ? (composingText ?? masked.formatted) : value;

  // A numeric 0 is a value too
  const hasValue = String(shownValue) !== "";
  const hasLabel = hasContent(label);
  const hasPrefix = hasContent(prefix);
  const hasSuffix = hasContent(suffix);
  const canClear = clearable && !UNCLEARABLE_TYPES.has(type);
  const showClear = canClear && hasValue && !disabled && !props.readOnly;

  // With content next to the text the border goes to a frame around them. A
  // password with a floating label is framed too: as the first child of the
  // button group the label took the rounded corners of the input.
  const isFramed =
    hasPrefix ||
    hasSuffix ||
    canClear ||
    hasContent(controls) ||
    (isPassword && floating && hasLabel);

  // A value the browser autofilled - without an event React would see -
  // floats the label by CSS (`:autofill`). A prefix takes the place of the
  // resting label.
  const isLabelFloating =
    isFocused || hasValue || HINTED_TYPES.has(inputType) || hasPrefix;

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const invalid = !!error || isAriaInvalid(props["aria-invalid"]);
  const descriptionId = description ? `${inputId}-description` : undefined;

  // The star is for the eye - `required` tells assistive technology
  const requiredMark = required && <RequiredMark />;

  // A value filled in part - also literals typed alone, the `+42` of `+420` -
  // is invalid, as one that misses a `pattern`: the message the field set
  // last is taken back, one the page set stays
  const maskMessage =
    masked && masked.formatted !== "" && !masked.complete
      ? messages.input.maskIncomplete
      : "";
  useCustomValidity(inputRef, maskMessage);

  /**
   * Makes what the browser did to a masked field - `input.value` with the
   * caret - an edit of its value: written into the input, and reported as
   * a change when it changed the value.
   */
  const applyMaskedEdit = (
    input: HTMLInputElement,
    event: React.ChangeEvent<HTMLInputElement>,
    editType: string,
  ) => {
    if (!parsedMask || !masked) return;

    const edit = editMasked(
      parsedMask,
      masked.formatted,
      input.value,
      input.selectionEnd ?? input.value.length,
      editType,
    );
    // Through the `value` property - React keeps track of it, and so sees
    // the next edit as a change
    if (input.value !== edit.value) input.value = edit.value;
    if (input.ownerDocument.activeElement === input) {
      input.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    }
    if (!edit.changed) return;

    const editedValue = conformToMask(parsedMask, edit.value);
    // Only a parent can give the raw characters back
    if (
      props.value !== undefined &&
      editedValue.raw !== editedValue.formatted
    ) {
      setReported(editedValue);
    }
    reportMaskedChange(input, event, handleChange);
    onMaskChange?.(editedValue);
  };

  // How strong the password is - while there is one
  const scorePassword =
    passwordStrength === true
      ? getPasswordStrength
      : typeof passwordStrength === "function"
        ? passwordStrength
        : null;
  const showsStrength = isPassword && scorePassword !== null;
  const strength =
    showsStrength && hasValue ? toStrength(scorePassword(String(value))) : null;
  const strengthText =
    strength === null
      ? ""
      : formatMessage(messages.input.passwordStrength, {
          strength: messages.input.passwordStrengths[strength],
        });
  const strengthId = strength === null ? undefined : `${inputId}-strength`;

  // Told to screen readers when the typing pauses, not at every keystroke -
  // and a strength only when it changed
  const [strengthAnnouncement, setStrengthAnnouncement] = useState("");

  useEffect(() => {
    if (!showsStrength || !isFocused) return;

    const timeout = setTimeout(
      () => setStrengthAnnouncement(strengthText),
      ANNOUNCE_DELAY,
    );
    return () => clearTimeout(timeout);
  }, [isFocused, showsStrength, strengthText]);

  // The clear is a change like typing - React calls `onChange` with the
  // input's event, and an uncontrolled field empties itself. The button goes
  // away with the value, so the focus moves into the input first.
  const clear = () => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    setNativeValue(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // A sibling of the input, so that `:has(~input:autofill)` finds it
  const floatingLabel = hasLabel && floating && (
    <label
      className={cn(
        "pointer-events-none absolute transition-all duration-200 motion-reduce:transition-none",
        // At the corner of the border - inside a frame it would sit where
        // the flex layout puts it. On the start side, moved in by a margin
        // - the right side of a right-to-left page.
        isFramed ? "-inset-s-px -top-px" : "inset-s-0 top-0",
        isLabelFloating
          ? "ms-1 translate-y-[-0.7rem] bg-surface px-1 text-xs dark:bg-surface-dark"
          : "ms-2 translate-y-[0.4rem] [&:has(~input:autofill)]:ms-1 [&:has(~input:autofill)]:translate-y-[-0.7rem] [&:has(~input:autofill)]:bg-surface [&:has(~input:autofill)]:px-1 [&:has(~input:autofill)]:text-xs dark:[&:has(~input:autofill)]:bg-surface-dark",
        // One color or the other - with both, the CSS order decides
        error
          ? "text-danger-700 dark:text-danger-400"
          : !isLabelFloating && "text-neutral-500 dark:text-neutral-400",
      )}
      htmlFor={inputId}
    >
      {label} {requiredMark}
    </label>
  );

  const input = (
    <input
      {...props}
      className={cn(
        // In a frame the frame draws the border, the background and the ring
        isFramed
          ? "min-w-0 flex-1 self-stretch bg-transparent focus:outline-hidden"
          : "form-control",
        // The password toggle joins it - the button group rounds its children,
        // and the input is a child of the element around it
        isPassword && !isFramed && "rounded-e-none!",
        dimStyles[dim],
        disabled && "cursor-not-allowed",
        disabled && !isFramed && "opacity-50",
        // Forced colors (Windows High Contrast) draw every border in one
        // color - an outline makes the border of an invalid field thicker
        error &&
          !isFramed &&
          "border-danger-500! focus:ring-danger-500! forced-colors:outline-1",
        // The browser's own clear button of a search field would be a second one
        canClear && "[&::-webkit-search-cancel-button]:hidden",
        className,
        // Last - the room for the floating label stays with any padding
        floating && "pt-2",
      )}
      aria-describedby={joinTokens(
        errorId,
        descriptionId,
        strengthId,
        props["aria-describedby"],
      )}
      aria-invalid={error ? "true" : props["aria-invalid"]}
      aria-required={required ? "true" : props["aria-required"]}
      // A code or a number, not words - no corrections of the keyboard, no
      // spelling marks
      autoCorrect={props.autoCorrect ?? (parsedMask ? "off" : undefined)}
      data-disabled={disabled ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      data-readonly={props.readOnly ? "" : undefined}
      disabled={disabled}
      id={inputId}
      // The numeric keyboard of phones for a mask of digits
      inputMode={
        props.inputMode ?? (parsedMask?.numeric ? "numeric" : undefined)
      }
      // With `unmask` the hidden input has the name
      name={masked && unmask ? undefined : name}
      onBlur={(event) => {
        setIsFocused(false);
        setStrengthAnnouncement("");
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        if (!masked) {
          handleChange(event);
          return;
        }

        // An input method composing text (Japanese, the word suggestions
        // of Android keyboards) gets its way until it is done - the text
        // shows as it is
        const nativeEvent = event.nativeEvent as Partial<InputEvent>;
        if (nativeEvent.isComposing) {
          compositionEvent.current = event;
          setComposingText(event.currentTarget.value);
          return;
        }

        compositionEvent.current = null;
        setComposingText(null);
        applyMaskedEdit(
          event.currentTarget,
          event,
          nativeEvent.inputType ?? "",
        );
      }}
      onCompositionEnd={(event) => {
        onCompositionEnd?.(event);

        // A browser that ends the composition after its last input event -
        // the composed text is an edit of the value now
        const changeEvent = compositionEvent.current;
        compositionEvent.current = null;
        if (!masked || composingText === null || !changeEvent) return;

        setComposingText(null);
        applyMaskedEdit(
          event.currentTarget,
          changeEvent,
          "insertCompositionText",
        );
      }}
      placeholder={floating ? "" : props.placeholder}
      ref={fieldRef}
      required={required}
      spellCheck={props.spellCheck ?? (parsedMask ? false : undefined)}
      type={inputType}
      value={shownValue}
    />
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* The form gets the characters of the placeholders alone */}
      {masked && unmask && name && (
        <input
          disabled={disabled}
          form={props.form}
          name={name}
          readOnly
          type="hidden"
          value={masked.raw}
        />
      )}
      {hasLabel && !floating && (
        <label className="block truncate text-sm font-medium" htmlFor={inputId}>
          {label}
          {messages.form.labelSuffix} {requiredMark}
        </label>
      )}

      <div className={cn("relative", isPassword && "btn-group")}>
        {/* The same element framed or not: the input keeps its place while an
            adornment comes and goes (a check mark once the value is valid) -
            moved into another element it would be a new input, without the
            focus and the typed text on its way */}
        <div
          className={cn(
            "relative flex w-full items-center",
            isFramed &&
              "rounded-md border border-neutral-300 bg-surface transition-colors focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700 dark:bg-surface-dark",
            isFramed &&
              error &&
              "border-danger-500! focus-within:ring-danger-500! forced-colors:outline-1",
            isFramed && disabled && "cursor-not-allowed opacity-50",
            // Also for a disabled fieldset around, which no prop tells - an
            // input without a frame looks so by `form-control`
            isFramed &&
              "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
          )}
          // The frame acts as the input: a press on an adornment or the
          // padding keeps the focus where it is (and selects no text), a
          // click focuses the input
          onClick={(event) => {
            if (
              isFramed &&
              !isControlTarget(event.target, event.currentTarget)
            ) {
              inputRef.current?.focus();
            }
          }}
          onMouseDown={(event) => {
            if (
              isFramed &&
              !isControlTarget(event.target, event.currentTarget)
            ) {
              event.preventDefault();
            }
          }}
        >
          {floatingLabel}
          {hasPrefix && (
            <span
              className={cn(
                "flex shrink-0 items-center text-neutral-500 select-none dark:text-neutral-400",
                adornmentStyles[dim],
                prefixPaddings[dim],
              )}
            >
              {prefix}
            </span>
          )}
          {input}
          {showClear && (
            <button
              aria-label={messages.input.clear}
              className={cn(
                "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-500 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 enabled:hover:text-neutral-700 disabled:cursor-not-allowed dark:text-neutral-400 dark:enabled:hover:text-neutral-300",
                hasSuffix ? "me-0.5" : clearMargins[dim],
                // Over the padding of the extra small field, which it would
                // make taller
                dim === "xs" && "-my-0.5",
              )}
              onClick={clear}
              // A press keeps the focus in the field
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <X aria-hidden="true" size={clearIconSizes[dim]} />
            </button>
          )}
          {hasSuffix && (
            <span
              className={cn(
                "flex shrink-0 items-center text-neutral-500 select-none dark:text-neutral-400",
                adornmentStyles[dim],
                suffixPaddings[dim],
              )}
            >
              {suffix}
            </span>
          )}
          {controls}
        </div>
        {isPassword && (
          <Button
            // A constant name - the pressed state tells whether it is shown
            aria-label={messages.input.showPassword}
            aria-pressed={inputType === "text"}
            className={dim === "xs" ? "py-0" : undefined}
            color="default"
            disabled={disabled}
            onClick={() => {
              setPasswordVisible((prev) => !prev);
            }}
            size={toggleSizes[dim]}
          >
            {inputType === "password" ? (
              <Eye size={toggleIconSizes[dim]} />
            ) : (
              <EyeOff size={toggleIconSizes[dim]} />
            )}
          </Button>
        )}
      </div>

      {strength !== null && (
        <div className="flex items-center gap-2">
          <div aria-hidden="true" className="flex flex-1 gap-1">
            {STRENGTH_SEGMENTS.map((segment) => (
              <span
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none",
                  // Forced colors draw no background - the system's colors
                  segment <= strength
                    ? cn(
                        strengthColors[strength],
                        "forced-colors:bg-[CanvasText]",
                      )
                    : "bg-neutral-200 dark:bg-neutral-700 forced-colors:bg-[GrayText]",
                )}
                key={segment}
              />
            ))}
          </div>
          <p
            className="shrink-0 text-xs text-neutral-600 dark:text-neutral-400"
            id={strengthId}
          >
            {strengthText}
          </p>
        </div>
      )}
      {/* In the page before it has something to say - a live region added
          with its text is not read */}
      {showsStrength && (
        <span className="sr-only" role="status">
          {strengthAnnouncement}
        </span>
      )}
      <FormDescription id={descriptionId}>{description}</FormDescription>
      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}

/**
 * A text field. Works controlled (`value` + `onChange`) and uncontrolled
 * (`defaultValue`); `type="password"` adds a show/hide toggle, and
 * `passwordStrength` a strength meter. `prefix` and `suffix` put an icon or
 * a unit inside the field, `clearable` a clear button, and `mask` formats
 * the text as it is typed (`"### ##"`).
 */
export default function Input({
  clearable = false,
  dim = "md",
  floating = false,
  ...props
}: InputProps) {
  return (
    <InputBase {...props} clearable={clearable} dim={dim} floating={floating} />
  );
}
