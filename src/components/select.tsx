import { useFormControl } from "../hooks/use-form-control";
import { useId } from "react";
import cn from "../utils/cn";
import FormError from "./form-error";

export interface SelectOption<T = string | number> {
  label: string;
  value: T;
}

export interface SelectProps extends React.ComponentProps<"select"> {
  /** Size of the field. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /** Adds an empty first option, so "nothing selected" can be chosen. */
  hasEmpty?: boolean;
  label?: string;
  /** The choices. */
  options: SelectOption[];
}

/** A native `<select>` styled like the other fields. */
export default function Select({
  className,
  defaultValue,
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
  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    defaultValue,
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

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          className="block truncate text-sm font-medium"
          htmlFor={selectId}
        >
          {label}: {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      <select
        {...props}
        aria-describedby={cn(errorId, props["aria-describedby"])}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          "form-control appearance-none pr-8",
          dimStyles[dim],
          disabled && "cursor-not-allowed opacity-50",
          error && "border-danger-500! focus:ring-danger-300!",
          className,
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
        {hasEmpty && <option value="" />}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
