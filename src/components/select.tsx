import { useFormControl } from "../hooks/use-form-control";
import { useId } from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { useMessages } from "../providers/ui-context";

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
  /** Text of the `<label>` above the field. */
  label?: string;
  /** The choices - options, and groups of options under a heading. */
  options: (SelectOption | SelectOptionGroup)[];
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
  options,
  required,
  ...props
}: SelectProps) {
  const messages = useMessages();
  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    // The value of a multiple select is an array - also an empty one
    defaultValue: defaultValue ?? (props.multiple ? [] : undefined),
    // A value a script writes into the select stays - `register()`
    followScriptWrites: true,
  });

  const dimStyles = {
    xs: "px-1 py-0.5 text-sm",
    sm: "px-1 py-0 text-sm",
    md: "px-2 py-1 text-base",
    lg: "px-3 py-2 text-lg",
  };

  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const descriptionId = description ? `${selectId}-description` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          className="block truncate text-sm font-medium"
          htmlFor={selectId}
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

      <select
        {...props}
        aria-describedby={joinTokens(
          errorId,
          descriptionId,
          props["aria-describedby"],
        )}
        aria-invalid={error ? "true" : props["aria-invalid"]}
        className={cn(
          "form-control appearance-none",
          dimStyles[dim],
          disabled && "cursor-not-allowed opacity-50",
          error && "border-danger-500! focus:ring-danger-500!",
          className,
          // Last - the room for the arrow stays with any padding
          "pr-8",
        )}
        disabled={disabled}
        id={selectId}
        name={name}
        onChange={handleChange}
        ref={fieldRef}
        required={required}
        style={{
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.5rem center",
          backgroundSize: "0.99rem 0.99rem",
          ...props.style,
        }}
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
