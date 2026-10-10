import {
  attachRef,
  isAriaInvalid,
  useFormControl,
} from "../../hooks/use-form-control";
import { useCallback, useId, useRef } from "react";
import cn, { joinTokens } from "../../utils/cn";
import { isControlTarget } from "./control-target";
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

// `prefix` of RDFa gives way to the adornment
export interface SelectProps extends Omit<
  React.ComponentProps<"select">,
  "prefix"
> {
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
   * Content before the value, inside the border of the field - an icon, or
   * a short caption of a filter or a sort ("Sort by:") in place of a label
   * above it. A click on it opens the list, as a click on the field does -
   * a button in it does what it does. Screen readers do not tie it to the
   * field - name the field with a `label` or an `aria-label`.
   */
  prefix?: React.ReactNode;
  /**
   * Shows the value, which cannot be changed - a native select has no
   * `readonly`, so the field keeps its list closed and refuses changes by
   * the mouse, the keyboard and assistive technology, and says so with
   * `aria-readonly`. Unlike a `disabled` one it keeps the focus and is
   * submitted with its form. Like a read-only input it is not checked by
   * `required`, whose value the user could not fix. The arrow is hidden.
   */
  readOnly?: boolean;
  /**
   * Content after the value and its arrow, inside the border of the field -
   * a unit, an icon, a spinner while the options load (the field keeps its
   * focus as it comes and goes). A click on it opens the list - a button in
   * it does what it does. Screen readers do not tie it to the field - say
   * what matters in the label or the `description`.
   */
  suffix?: React.ReactNode;
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

// The adornments of `prefix` and `suffix` - as those of `Input`
const adornmentStyles = {
  xs: "text-sm",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};
const prefixPaddings = { xs: "ps-1", sm: "ps-1", md: "ps-2", lg: "ps-3" };
const suffixPaddings = { xs: "pe-1", sm: "pe-1", md: "pe-2", lg: "pe-3" };

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

/** Opens the list of a select, where the browser lets a script do it. */
function showPicker(select: HTMLSelectElement) {
  try {
    select.showPicker();
  } catch {
    // Not there (an older browser) or not allowed here (a cross-origin
    // frame) - the select has the focus at least
  }
}

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
  prefix,
  readOnly = false,
  ref,
  required,
  suffix,
  ...props
}: SelectProps) {
  const messages = useMessages().ui;
  const selectRef = useRef<HTMLSelectElement | null>(null);

  // The select is needed here too - for a press beside it, which focuses
  // it. Not looked up in the DOM: an adornment may hold a select of its own
  // (a unit, a currency) before it.
  const ownRef = useCallback(
    (element: HTMLSelectElement | null) => {
      selectRef.current = element;
      const detachRef = attachRef(ref, element);

      return () => {
        selectRef.current = null;
        detachRef();
      };
    },
    [ref],
  );

  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    ref: ownRef,
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
  const hasPrefix = hasContent(prefix);
  const hasSuffix = hasContent(suffix);
  // In a frame with the adornments - the frame draws the border and the ring
  const isFramed = hasPrefix || hasSuffix;

  const select = (
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
        isFramed
          ? "min-w-0 flex-1 appearance-none self-stretch bg-transparent focus:outline-hidden"
          : "form-control appearance-none",
        // The arrow is a background of the select, at its end - on the
        // left in a right-to-left page (see the stylesheet)
        hasArrow && "cui-select-arrow",
        dimStyles[dim],
        disabled && "cursor-not-allowed",
        disabled && !isFramed && "opacity-50",
        // Forced colors (Windows High Contrast) draw every border in one
        // color - an outline makes the border of an invalid field thicker
        error &&
          !isFramed &&
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
      {hasEmpty && <option aria-label={messages.select.emptyOption} value="" />}
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
  );

  return (
    <div
      className="flex flex-col gap-1.5"
      // A press on a read-only select, which the pointer passes through,
      // lands here - it focuses the select, as it would a read-only input
      onMouseDown={(event) => {
        if (readOnly && event.target === event.currentTarget) {
          event.preventDefault();
          selectRef.current?.focus();
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

      {/* The same element framed or not: the select keeps its place while an
          adornment comes and goes (a spinner while the options load) -
          moved into another element it would be a new select, without the
          focus. Unframed it has no box: the select lays out as before. */}
      <div
        className={cn(
          isFramed
            ? "relative flex w-full items-center rounded-md border border-neutral-300 bg-surface transition-colors focus-within:ring-2 focus-within:ring-primary-500 dark:border-neutral-700 dark:bg-surface-dark"
            : "contents",
          isFramed &&
            error &&
            "border-danger-500! focus-within:ring-danger-500! forced-colors:outline-1",
          // Also for a disabled fieldset around, which no prop tells - the
          // select itself, a child of the frame, not one in an adornment
          isFramed &&
            "has-[>select:disabled]:cursor-not-allowed has-[>select:disabled]:opacity-50",
        )}
        // The frame acts as the select: a press on an adornment keeps the
        // focus where it is, a click focuses the select and opens its list -
        // not one on a control in it (an option, a button of an adornment)
        onClick={(event) => {
          const select = selectRef.current;
          if (
            !isFramed ||
            !select ||
            isControlTarget(event.target, event.currentTarget)
          ) {
            return;
          }
          select.focus();
          if (!select.disabled && !readOnly && !isListBox) {
            showPicker(select);
          }
        }}
        onMouseDown={(event) => {
          if (isFramed && !isControlTarget(event.target, event.currentTarget)) {
            event.preventDefault();
          }
        }}
      >
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
        {select}
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
      </div>

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
