import { attachRef, useFormControl } from "../hooks/use-form-control";
import { useCallback, useId } from "react";
import cn from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { useMessages } from "../providers/ui-context";

export interface RadioOption<T = string | number> {
  /** Secondary text under the label - it describes the radio. */
  description?: React.ReactNode;
  /** Shown, but cannot be picked. */
  disabled?: boolean;
  /** Text next to the radio. */
  label: string;
  /** Submitted with the form - `event.target.value` is its string form. */
  value: T;
}

export interface RadioGroupProps {
  /**
   * Id of the element describing the group - the error message describes
   * it too.
   */
  "aria-describedby"?: string;
  /** Accessible name of a group without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a group without `label`. */
  "aria-labelledby"?: string;
  /**
   * Classes of the element around the options (below the legend) - not of
   * the group element, the radios, the description or the error message.
   */
  className?: string;
  /** Initially selected value of an uncontrolled group. */
  defaultValue?: string | number;
  /**
   * Help text under the options - it describes the group for screen
   * readers.
   */
  description?: React.ReactNode;
  /** Size of the options. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Disables all options. */
  disabled?: boolean;
  /** Validation message - also marks the group as invalid. */
  error?: string;
  /**
   * Id of a form elsewhere in the page - the radios belong to it, and its
   * reset resets the group.
   */
  form?: string;
  /**
   * Id of the group element - the `<fieldset>` with `label`, otherwise the
   * `role="radiogroup"` element. The ids of the description and the error
   * message derive from it.
   */
  id?: string;
  /** Rendered as the `<legend>` of a fieldset. */
  label?: string;
  /**
   * Shared `name` of the radio inputs - the form submits the picked value
   * under it. Without a `name` the options still form one group (the arrow
   * keys, one pick, `required`), but the form does not submit it.
   */
  name?: string;
  /** Called when a radio loses the focus - also when it moves to another one. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Called with the change event of the picked radio - `event.target.value` is always a string. */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Called when a radio gets the focus. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** The choices. */
  options: RadioOption[];
  /**
   * `vertical` - the options under each other, `horizontal` - in a row,
   * wrapping when it is full. The arrow keys move through them either way.
   */
  orientation?: "vertical" | "horizontal";
  /** Ref to the group element (see `id`). */
  ref?: React.Ref<HTMLElement>;
  /** An option must be picked before the form can be submitted. */
  required?: boolean;
  /** Selected value of a controlled group. */
  value?: string | number;
}

/** A group of radio buttons - one of a few options. */
export default function RadioGroup({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  description,
  disabled = false,
  dim = "md",
  error,
  form,
  id,
  label,
  name,
  onBlur,
  onChange,
  onFocus,
  options,
  orientation = "vertical",
  ref,
  required,
  value: controlledValue,
}: RadioGroupProps) {
  const messages = useMessages();
  const { fieldRef, handleChange, value } = useFormControl({
    defaultValue,
    onChange,
    value: controlledValue,
  });

  // Without a name the options of two groups would form one radio group
  const generatedName = useId();
  const groupName = name ?? generatedName;
  // From the id, not the name - two groups may share a name (in two forms)
  const idBase = id ?? generatedName;
  const errorId = error ? `${idBase}-error` : undefined;
  const descriptionId = description ? `${idBase}-description` : undefined;

  const groupElementRef = useCallback(
    (element: HTMLElement | null) => attachRef(ref, element),
    [ref],
  );

  // The generated name only groups the radios - the form leaves it out of
  // its data, as it leaves out radios without a name. The form of the
  // radios: the one `form` names, or the one around them.
  const groupRef = useCallback(
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

  const dimStyles = {
    xs: "text-sm",
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const radioSizeStyles = {
    xs: "w-3 h-3",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const optionList = (
    <div
      className={cn(
        orientation === "horizontal"
          ? "flex flex-row flex-wrap gap-x-4 gap-y-1"
          : "flex flex-col gap-1",
        label && "mt-2",
        dimStyles[dim],
        className,
      )}
    >
      {options.map((option, index) => {
        const optionDisabled = disabled || !!option.disabled;
        // A described option is named by its label alone - the label
        // element wraps the description too
        const optionId = `${idBase}-option-${index}`;
        const described = !!option.description;

        return (
          <label
            className={cn(
              "flex rounded p-1 transition-colors",
              // The radio stays on the first line of a described option
              described ? "items-start" : "items-center",
              optionDisabled
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800",
            )}
            key={option.value}
          >
            <input
              className={cn(
                "shrink-0 border-neutral-300 accent-primary-500",
                radioSizeStyles[dim],
                described && "mt-1",
                error && "accent-danger-500!",
              )}
              aria-describedby={
                described ? `${optionId}-description` : undefined
              }
              aria-labelledby={described ? `${optionId}-label` : undefined}
              // The value of an input is always a string - compare as such, so
              // numeric option values stay checked after a change
              checked={String(value) === String(option.value)}
              disabled={optionDisabled}
              form={form}
              name={groupName}
              onBlur={onBlur}
              onChange={handleChange}
              onFocus={onFocus}
              ref={fieldRef}
              required={required}
              type="radio"
              value={option.value}
            />
            {described ? (
              // Spans - a label holds no paragraphs
              <span className="ml-2 flex flex-col select-none">
                <span id={`${optionId}-label`}>{option.label}</span>
                <span
                  className="text-xs text-neutral-600 dark:text-neutral-400"
                  id={`${optionId}-description`}
                >
                  {option.description}
                </span>
              </span>
            ) : (
              <span className="ml-2 select-none">{option.label}</span>
            )}
          </label>
        );
      })}
    </div>
  );

  // The group carries the error and `required` - the radios keep `required`
  // for the browser's validation
  const groupProps = {
    "aria-describedby": cn(errorId, descriptionId, ariaDescribedBy),
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-required": required ? ("true" as const) : undefined,
    id,
    ref: groupElementRef,
    role: "radiogroup",
  };

  return (
    <div className="flex flex-col gap-1.5" ref={groupRef}>
      {label ? (
        // A fieldset is a `group`, which has no invalid or required state
        <fieldset {...groupProps}>
          <legend className="block text-sm font-medium">
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
          {optionList}
        </fieldset>
      ) : (
        <div
          {...groupProps}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
        >
          {optionList}
        </div>
      )}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
