import { Eye, EyeOff, X } from "lucide-react";
import { attachRef, useFormControl } from "../hooks/use-form-control";
import { useCallback, useId, useRef, useState } from "react";
import Button from "./button";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { useMessages } from "../providers/ui-context";

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

// What a press inside the border of the field leaves alone: the input, and
// the controls of an adornment (a currency select, a button)
const CONTROL_SELECTOR =
  "a[href], button, input, select, textarea, [contenteditable], [tabindex]";

// All the padding lives here - base padding next to it would win over the
// smaller sizes, as the CSS order decides between two utilities
const dimStyles = {
  xs: "px-1 py-0.5 text-sm",
  sm: "px-1 py-0 text-sm",
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
  /** Text of the `<label>` of the field. */
  label?: string;
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
  name,
  prefix,
  ref,
  required,
  suffix,
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
  // A numeric 0 is a value too
  const hasValue = String(value) !== "";
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
    (isPassword && floating && !!label);

  // A value the browser autofilled - without an event React would see -
  // floats the label by CSS (`:autofill`). A prefix takes the place of the
  // resting label.
  const isLabelFloating =
    isFocused || hasValue || HINTED_TYPES.has(inputType) || hasPrefix;

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;

  // The star is for the eye - `required` tells assistive technology
  const requiredMark = required && (
    <span aria-hidden="true" className="text-danger-700 dark:text-danger-400">
      *
    </span>
  );

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
  const floatingLabel = label && floating && (
    <label
      className={cn(
        "pointer-events-none absolute transition-all duration-200 motion-reduce:transition-none",
        // At the corner of the border - inside a frame it would sit where
        // the flex layout puts it
        isFramed ? "-top-px -left-px" : "top-0 left-0",
        isLabelFloating
          ? "translate-x-1 translate-y-[-0.7rem] bg-surface px-1 text-xs dark:bg-surface-dark"
          : "translate-x-2 translate-y-[0.4rem] [&:has(~input:autofill)]:translate-x-1 [&:has(~input:autofill)]:translate-y-[-0.7rem] [&:has(~input:autofill)]:bg-surface [&:has(~input:autofill)]:px-1 [&:has(~input:autofill)]:text-xs dark:[&:has(~input:autofill)]:bg-surface-dark",
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
          ? "min-w-0 flex-1 self-stretch bg-transparent focus:outline-none"
          : "form-control",
        // The password toggle joins it - the button group rounds its children,
        // and the input is a child of the element around it
        isPassword && !isFramed && "rounded-e-none!",
        dimStyles[dim],
        disabled && "cursor-not-allowed",
        disabled && !isFramed && "opacity-50",
        error && !isFramed && "border-danger-500! focus:ring-danger-500!",
        // The browser's own clear button of a search field would be a second one
        canClear && "[&::-webkit-search-cancel-button]:hidden",
        className,
        // Last - the room for the floating label stays with any padding
        floating && "pt-2",
      )}
      aria-describedby={joinTokens(
        errorId,
        descriptionId,
        props["aria-describedby"],
      )}
      aria-invalid={error ? "true" : props["aria-invalid"]}
      aria-required={required ? "true" : props["aria-required"]}
      disabled={disabled}
      id={inputId}
      name={name}
      onBlur={(event) => {
        setIsFocused(false);
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        props.onFocus?.(event);
      }}
      onChange={handleChange}
      placeholder={floating ? "" : props.placeholder}
      ref={fieldRef}
      required={required}
      type={inputType}
      value={value}
    />
  );

  return (
    <div className="flex flex-col gap-1.5">
      {label && !floating && (
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
              "border-danger-500! focus-within:ring-danger-500!",
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
                "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 enabled:hover:text-neutral-700 disabled:cursor-not-allowed dark:text-neutral-400 dark:enabled:hover:text-neutral-300",
                hasSuffix ? "me-0.5" : clearMargins[dim],
                // Over the padding of the small field, which it would make
                // taller
                dim === "sm" && "-my-0.5",
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
            color="default"
            disabled={disabled}
            onClick={() => {
              setPasswordVisible((prev) => !prev);
            }}
          >
            {inputType === "password" ? (
              <Eye size={20} />
            ) : (
              <EyeOff size={20} />
            )}
          </Button>
        )}
      </div>

      <FormDescription id={descriptionId}>{description}</FormDescription>
      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}

/**
 * A text field. Works controlled (`value` + `onChange`) and uncontrolled
 * (`defaultValue`); `type="password"` adds a show/hide toggle. `prefix` and
 * `suffix` put an icon or a unit inside the field, `clearable` a clear
 * button.
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
