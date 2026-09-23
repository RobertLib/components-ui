import { useFormControl } from "../hooks/use-form-control";
import { useId } from "react";
import cn from "../utils/cn";
import FormError from "./form-error";

export interface RadioOption<T = string | number> {
  label: string;
  value: T;
}

export interface RadioGroupProps {
  /** Accessible name of a group without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a group without `label`. */
  "aria-labelledby"?: string;
  className?: string;
  /** Initially selected value of an uncontrolled group. */
  defaultValue?: string | number;
  /** Size of the options. */
  dim?: "xs" | "sm" | "md" | "lg";
  disabled?: boolean;
  /** Validation message - also marks the group as invalid. */
  error?: string;
  /** Rendered as the `<legend>` of a fieldset. */
  label?: string;
  /** Shared `name` of the radio inputs - required for form submission. */
  name?: string;
  /** Called with the change event of the picked radio - `event.target.value` is always a string. */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** The choices. */
  options: RadioOption[];
  required?: boolean;
  /** Selected value of a controlled group. */
  value?: string | number;
}

/** A group of radio buttons - one of a few options. */
export default function RadioGroup({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  disabled = false,
  dim = "md",
  error,
  label,
  name,
  options,
  required,
  ...props
}: RadioGroupProps) {
  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    defaultValue,
  });

  // Without a name the options of two groups would form one radio group
  const generatedName = useId();
  const groupName = name ?? generatedName;
  const errorId = error ? `${generatedName}-error` : undefined;

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
        "flex flex-col gap-1",
        label && "mt-2",
        dimStyles[dim],
        className,
      )}
    >
      {options.map((option) => (
        <label
          className={cn(
            "flex items-center rounded p-1 transition-colors",
            disabled
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800",
          )}
          key={option.value}
        >
          <input
            className={cn(
              "border-neutral-300 accent-primary-500",
              radioSizeStyles[dim],
              error && "accent-danger-500!",
            )}
            // The value of an input is always a string - compare as such, so
            // numeric option values stay checked after a change
            checked={String(value) === String(option.value)}
            disabled={disabled}
            name={groupName}
            onChange={handleChange}
            ref={fieldRef}
            required={required}
            type="radio"
            value={option.value}
          />
          <span className="ml-2 select-none">{option.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* The group carries the error - the radios keep `required` for the
          browser's validation */}
      {label ? (
        <fieldset
          aria-describedby={errorId}
          aria-invalid={error ? "true" : undefined}
        >
          <legend className="block text-sm font-medium">
            {label}: {required && <span className="text-danger-500">*</span>}
          </legend>
          {optionList}
        </fieldset>
      ) : (
        <div
          aria-describedby={errorId}
          aria-invalid={error ? "true" : undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-required={required ? "true" : undefined}
          role="radiogroup"
        >
          {optionList}
        </div>
      )}

      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
