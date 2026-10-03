import { isAriaInvalid, useFormControl } from "../../hooks/use-form-control";
import { useId } from "react";
import cn, { joinTokens } from "../../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import RequiredMark from "./required-mark";
import { useMessages } from "../../providers/ui-context";

export interface SelectOption<T = string | number> {
  /** Shown in the list, but cannot be picked. */
  disabled?: boolean;
  /** Text of the option. */
  label: string;
  /** Submitted with the form - `event.target.value` is its string form. */
  value: T;
}

/** Options under a heading - an `<optgroup>`. */
export interface SelectOptionGroup<T = string | number> {
  /** Disables all options of the group. */
  disabled?: boolean;
  /** The heading of the group - it cannot be picked. */
  label: string;
  /** The options of the group. */
  options: SelectOption<T>[];
}

export interface SelectProps extends React.ComponentProps<"select"> {
  /**
   * Classes of the `<select>` itself - not of the wrapper around it, its
   * label, description or error message.
   */
  className?: string;
  /** Help text under the field - it describes the field for screen readers. */
  description?: React.ReactNode;
  /** Size of the field. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /** Adds an empty first option, so "nothing selected" can be chosen. */
  hasEmpty?: boolean;
  /**
   * The `<label>` above the field - a text, or content like a text with an
   * icon. Without a label give the field an `aria-label`.
   */
  label?: React.ReactNode;
  /** The choices - options, and groups of options under a heading. */
  options: (SelectOption | SelectOptionGroup)[];
  /**
   * Shows the value, which cannot be changed - a native select has no
   * `readonly`, so the field keeps its list closed and refuses changes by
   * the mouse, the keyboard and assistive technology, and says so with
   * `aria-readonly`. Unlike a `disabled` one it keeps the focus and is
   * submitted with its form. Like a read-only input it is not checked by
   * `required`, whose value the user could not fix. The arrow is hidden.
   */
  readOnly?: boolean;
}

// All the padding lives here - base padding next to it would win over the
// smaller sizes, as the CSS order decides between two utilities. The
// paddings and the text of `Input`.
const dimStyles = {
  xs: "px-1 py-0 text-sm",
  sm: "px-1 py-0.5 text-sm",
  md: "px-2 py-1 text-base",
  lg: "px-3 py-2 text-lg",
};

// The keys that open a closed select or change its value - also the typed
// characters, which pick the option they start
const OPERATING_KEYS = new Set([
  " ",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Enter",
  "F4",
  "Home",
  "PageDown",
  "PageUp",
]);

/** Whether a key would open a closed select or change its value. */
const operatesSelect = (event: React.KeyboardEvent) =>
  OPERATING_KEYS.has(event.key) ||
  (event.key.length === 1 && !event.ctrlKey && !event.metaKey);

/** Whether a slot renders anything - the `false` of a condition does not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

const isGroup = (
  item: SelectOption | SelectOptionGroup,
): item is SelectOptionGroup => "options" in item;

const renderOption = (option: SelectOption) => (
  <option disabled={option.disabled} key={option.value} value={option.value}>
    {option.label}
  </option>
);

/** A native `<select>` styled like the other fields. */
export default function Select({
  className,
  defaultValue,
  description,
  dim = "md",
  disabled,
  error,
  hasEmpty,
  id,
  label,
  name,
  onKeyDown,
  onMouseDown,
  options,
  readOnly = false,
  ref,
  required,
  ...props
}: SelectProps) {
  const messages = useMessages();
  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    ref,
    // The value of a multiple select is an array - also an empty one
    defaultValue: defaultValue ?? (props.multiple ? [] : undefined),
    // A value a script writes into the select stays - `register()`
    followScriptWrites: true,
  });

  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const descriptionId = description ? `${selectId}-description` : undefined;
  const invalid = !!error || isAriaInvalid(props["aria-invalid"]);

  // A list box - a multiple select, or one of several rows - opens nothing
  const isListBox = !!props.multiple || Number(props.size) > 1;
  const hasArrow = !isListBox && !readOnly;

  return (
    <div
      className="flex flex-col gap-1.5"
      // A press on a read-only select, which the pointer passes through,
      // lands here - it focuses the select, as it would a read-only input
      onMouseDown={(event) => {
        if (readOnly && event.target === event.currentTarget) {
          event.preventDefault();
          event.currentTarget.querySelector("select")?.focus();
        }
      }}
    >
      {hasContent(label) && (
        <label
          className="block truncate text-sm font-medium"
          htmlFor={selectId}
        >
          {label}
          {messages.form.labelSuffix}{" "}
          {/* The star is for the eye - `required` tells assistive technology */}
          {required && <RequiredMark />}
        </label>
      )}

      <select
        {...props}
        aria-describedby={joinTokens(
          errorId,
          descriptionId,
          props["aria-describedby"],
        )}
        aria-invalid={error ? "true" : props["aria-invalid"]}
        aria-readonly={readOnly ? "true" : props["aria-readonly"]}
        // Still required for assistive technology - see `required` below
        aria-required={readOnly && required ? "true" : props["aria-required"]}
        className={cn(
          "form-control appearance-none",
          // The arrow is a background of the select, at its end - on the
          // left in a right-to-left page (see the stylesheet)
          hasArrow && "cui-select-arrow",
          dimStyles[dim],
          disabled && "cursor-not-allowed opacity-50",
          // Forced colors (Windows High Contrast) draw every border in one
          // color - an outline makes the border of an invalid field thicker
          error &&
            "border-danger-500! focus:ring-danger-500! forced-colors:outline-1",
          // The popup of the browser, the picker of a phone, opens at a
          // touch - a read-only select lets the pointer through
          readOnly && !isListBox && "pointer-events-none",
          className,
          // Last - the room for the arrow stays with any padding
          hasArrow && "pe-8",
        )}
        data-disabled={disabled ? "" : undefined}
        data-invalid={invalid ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        disabled={disabled}
        id={selectId}
        name={name}
        onChange={(event) => {
          // A change that got through - assistive technology picking an
          // option: React puts the value back
          if (readOnly) return;
          handleChange(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (readOnly && !event.defaultPrevented && operatesSelect(event)) {
            event.preventDefault();
          }
        }}
        // The options of a read-only list box cannot be picked by a click -
        // it still scrolls
        onMouseDown={(event) => {
          onMouseDown?.(event);
          if (readOnly && !event.defaultPrevented) {
            event.preventDefault();
            event.currentTarget.focus();
          }
        }}
        ref={fieldRef}
        // The browser does not check a read-only field, whose value the user
        // cannot fix - nor this one
        required={required && !readOnly}
        value={value}
      >
        {/* Blank to the eye, named for screen readers */}
        {hasEmpty && (
          <option aria-label={messages.select.emptyOption} value="" />
        )}
        {options.map((item, index) =>
          isGroup(item) ? (
            <optgroup
              disabled={item.disabled}
              // Headings may repeat - the position tells the groups apart
              key={`${index}\u0000${item.label}`}
              label={item.label}
            >
              {item.options.map(renderOption)}
            </optgroup>
          ) : (
            renderOption(item)
          ),
        )}
      </select>

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
