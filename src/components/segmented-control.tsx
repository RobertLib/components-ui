import { attachRef, useFormControl } from "../hooks/use-form-control";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { useMessages } from "../providers/ui-context";

export interface SegmentedControlOption<
  T extends string | number = string | number,
> {
  /**
   * Text of the option. Leave it out for an icon-only option - and name it
   * with `aria-label`.
   */
  label?: React.ReactNode;
  /**
   * Reported by `onChange` and submitted with the form - as a string, like
   * the value of any radio.
   */
  value: T;
  /** Accessible name - required for an icon-only option, whose tooltip it also is. */
  "aria-label"?: string;
  /** The option cannot be picked. */
  disabled?: boolean;
  /** An icon before the label, e.g. `<List size={16} />`. */
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<
  T extends string | number = string | number,
> {
  /**
   * Id of the element describing the control - the error message and the
   * description describe it too.
   */
  "aria-describedby"?: string;
  /** Accessible name of a control without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a control without `label`. */
  "aria-labelledby"?: string;
  /** Classes of the bar of options - not of the label or the messages. */
  className?: string;
  /** Initially picked value of an uncontrolled control. */
  defaultValue?: T;
  /** Help text under the control - it describes it. */
  description?: React.ReactNode;
  /** Disables all options. */
  disabled?: boolean;
  /** Validation message - also marks the control as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the control belongs to, when it is not inside it -
   * like the `form` attribute of a native field.
   */
  form?: string;
  /** Stretches the bar over the full width, the options sharing it equally. */
  fullWidth?: boolean;
  /**
   * Id of the group element - the `<fieldset>` with `label`, otherwise the
   * `role="radiogroup"` element. The ids of the messages derive from it.
   */
  id?: string;
  /** Rendered as the `<legend>` of a fieldset above the bar. */
  label?: string;
  /**
   * `name` of the radios underneath - the form submits the picked value
   * under it. Without a `name` the control is not submitted.
   */
  name?: string;
  /** Called when an option loses the focus - also when it moves to another one. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Called with the value of the picked option. */
  onChange?: (value: T) => void;
  /** Called when an option gets the focus. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** The choices - a few short ones. */
  options: SegmentedControlOption<T>[];
  /** Ref to the group element (see `id`). */
  ref?: React.Ref<HTMLElement>;
  /** An option must be picked before the form can be submitted. */
  required?: boolean;
  /** Height and text size of the options. */
  size?: "sm" | "md" | "lg";
  /** Picked value of a controlled control. */
  value?: T;
}

const barSizeStyles = {
  sm: "p-0.5",
  md: "p-1",
  lg: "p-1.5",
};

const optionSizeStyles = {
  sm: "px-2.5 py-0.5 text-[13px]",
  md: "px-3 py-0.5 text-sm",
  lg: "px-4 py-1 text-base",
};

// An icon alone - about as wide as the option is high
const iconOptionSizeStyles = {
  sm: "px-1.5 py-0.5 text-[13px]",
  md: "px-2 py-0.5 text-sm",
  lg: "px-2.5 py-1 text-base",
};

// The indicator keeps the padding of the bar around it
const indicatorInset = {
  sm: "2px",
  md: "4px",
  lg: "6px",
};

/**
 * A compact choice of one of a few options - a view switcher, a period.
 * Radios underneath: one tab stop, the arrow keys move and pick, and the
 * form submits the picked value. The selection slides between the options
 * (at once for users who prefer reduced motion).
 */
export default function SegmentedControl<
  T extends string | number = string | number,
>({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  description,
  disabled = false,
  error,
  form,
  fullWidth = false,
  id,
  label,
  name,
  onBlur,
  onChange,
  onFocus,
  options,
  ref,
  required,
  size = "md",
  value: controlledValue,
}: SegmentedControlProps<T>) {
  const messages = useMessages();
  const { fieldRef, handleChange, value } = useFormControl<HTMLInputElement>({
    defaultValue,
    // The value of a radio is a string - the option has the original one
    onChange: (event) => {
      const option = options.find(
        (candidate) => String(candidate.value) === event.target.value,
      );
      if (option) onChange?.(option.value);
    },
    value: controlledValue,
  });

  // Without a name the options of two controls would form one radio group
  const generatedName = useId();
  const groupName = name ?? generatedName;
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const errorId = error ? `${groupId}-error` : undefined;
  const descriptionId = description ? `${groupId}-description` : undefined;

  const selectedIndex = options.findIndex(
    (option) => String(option.value) === String(value),
  );

  // Where the indicator is - measured in the browser. Until then (on the
  // server, before hydration) the picked option has a background of its own.
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const option =
      selectedIndex === -1
        ? undefined
        : bar?.querySelectorAll<HTMLElement>("[data-option]")[selectedIndex];

    if (!bar || !option) {
      setIndicator(null);
      return;
    }

    const measure = () => {
      const barRect = bar.getBoundingClientRect();
      const optionRect = option.getBoundingClientRect();
      // Also when the bar scrolls sideways on a narrow screen
      const left =
        optionRect.left - barRect.left - bar.clientLeft + bar.scrollLeft;
      const width = optionRect.width;

      setIndicator((previous) =>
        previous?.left === left && previous.width === width
          ? previous
          : { left, width },
      );
    };

    measure();

    // The options change size after the first measurement - a web font that
    // loads later, a label that changes, a container that narrows. Not in
    // every environment (jsdom) - measured once then.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(option);
    return () => observer.disconnect();
  }, [options, selectedIndex, size]);

  const groupElementRef = useCallback(
    (element: HTMLElement | null) => attachRef(ref, element),
    [ref],
  );

  // The generated name only groups the radios - the form leaves it out of
  // its data, as it leaves out radios without a name
  const wrapperRef = useCallback(
    (element: HTMLElement | null) => {
      const formElement = !element
        ? null
        : form
          ? element.ownerDocument.getElementById(form)
          : element.closest("form");
      if (!(formElement instanceof HTMLFormElement) || name !== undefined) {
        return;
      }

      const dropGeneratedName = (event: FormDataEvent) =>
        event.formData.delete(generatedName);
      formElement.addEventListener("formdata", dropGeneratedName);

      return () =>
        formElement.removeEventListener("formdata", dropGeneratedName);
    },
    [form, generatedName, name],
  );

  const bar = (
    <div
      className={cn(
        "relative max-w-full overflow-x-auto rounded-lg bg-neutral-100 dark:bg-neutral-800",
        fullWidth ? "flex w-full" : "inline-flex",
        barSizeStyles[size],
        // A ring marks the error - a border would change the size
        error && "ring-1 ring-danger-500",
        disabled && "opacity-60",
        // Also in a disabled fieldset around, which no prop tells
        "[fieldset:disabled_&]:opacity-60",
        className,
      )}
      ref={barRef}
    >
      {indicator && (
        <div
          aria-hidden="true"
          className="absolute rounded-md bg-surface shadow-sm transition-all duration-200 ease-out motion-reduce:transition-none dark:bg-neutral-600"
          style={{
            bottom: indicatorInset[size],
            left: indicator.left,
            top: indicatorInset[size],
            width: indicator.width,
          }}
        />
      )}
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        const optionDisabled = disabled || !!option.disabled;
        const iconOnly = option.label === undefined || option.label === null;

        return (
          <label
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors select-none has-focus-visible:ring-2 has-focus-visible:ring-primary-500 motion-reduce:transition-none",
              iconOnly ? iconOptionSizeStyles[size] : optionSizeStyles[size],
              fullWidth && "flex-1",
              checked
                ? "text-neutral-900 dark:text-white"
                : "text-neutral-600 dark:text-neutral-300",
              !checked &&
                !optionDisabled &&
                "hover:text-neutral-900 has-disabled:hover:text-neutral-600 dark:hover:text-white dark:has-disabled:hover:text-neutral-300",
              // Until the indicator is measured
              checked &&
                !indicator &&
                "bg-surface shadow-sm dark:bg-neutral-600",
              optionDisabled ? "cursor-not-allowed" : "cursor-pointer",
              "has-disabled:cursor-not-allowed",
              // A disabled control is dimmed as a whole
              option.disabled && !disabled && "opacity-50",
            )}
            data-option=""
            key={option.value}
            title={iconOnly ? option["aria-label"] : undefined}
          >
            <input
              aria-label={option["aria-label"]}
              checked={checked}
              className="sr-only"
              disabled={optionDisabled}
              form={form}
              name={groupName}
              onBlur={onBlur}
              onChange={handleChange}
              onFocus={onFocus}
              ref={fieldRef}
              required={required}
              type="radio"
              value={String(option.value)}
            />
            {option.icon && (
              <span aria-hidden="true" className="inline-flex shrink-0">
                {option.icon}
              </span>
            )}
            {option.label}
          </label>
        );
      })}
    </div>
  );

  // The group carries the error and `required` - the radios keep `required`
  // for the browser's validation
  const groupProps = {
    "aria-describedby": joinTokens(errorId, descriptionId, ariaDescribedBy),
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-required": required ? ("true" as const) : undefined,
    id,
    ref: groupElementRef,
    role: "radiogroup",
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5" ref={wrapperRef}>
      {label ? (
        // A fieldset is a `group`, which has no invalid or required state
        <fieldset {...groupProps} className="min-w-0">
          <legend className="mb-1.5 block text-sm font-medium">
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
          </legend>
          {bar}
        </fieldset>
      ) : (
        <div
          {...groupProps}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="min-w-0"
        >
          {bar}
        </div>
      )}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
