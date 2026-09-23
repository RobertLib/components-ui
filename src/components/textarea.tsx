import { useFormControl } from "../hooks/use-form-control";
import { useId, useState } from "react";
import cn from "../utils/cn";
import FormError from "./form-error";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Size of the field. */
  dim?: "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /** Places the label inside the field, floating up once it has a value. */
  floating?: boolean;
  label?: string;
}

/** A multi-line text field - the same API as `Input`. */
export default function Textarea({
  className,
  defaultValue,
  dim = "md",
  disabled,
  error,
  floating = false,
  id,
  label,
  name,
  required,
  ...props
}: TextareaProps) {
  const [isFocused, setIsFocused] = useState(false);

  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    defaultValue,
  });

  // A numeric 0 is a value too
  const isLabelFloating = isFocused || String(value) !== "";

  const dimStyles = {
    sm: "px-1 py-0 text-sm min-h-[60px]",
    md: "px-2 py-1 text-base min-h-[80px]",
    lg: "px-3 py-2 text-lg min-h-[100px]",
  };

  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && !floating && (
        <label
          className="block truncate text-sm font-medium"
          htmlFor={textareaId}
        >
          {label}: {required && <span className="text-danger-500">*</span>}
        </label>
      )}

      <span className="relative">
        {label && floating && (
          <label
            className={cn(
              "pointer-events-none absolute z-10 transition-all duration-200",
              isLabelFloating
                ? "translate-x-1 translate-y-[-0.7rem] bg-surface px-1 text-xs dark:bg-surface-dark"
                : "translate-x-2 translate-y-[0.4rem] text-neutral-500 dark:text-neutral-400",
              error && "text-danger-500",
            )}
            htmlFor={textareaId}
          >
            {label} {required && <span className="text-danger-500">*</span>}
          </label>
        )}
        <textarea
          {...props}
          className={cn(
            "form-control resize-y px-2 py-1",
            dimStyles[dim],
            disabled && "cursor-not-allowed opacity-50",
            floating && "pt-6",
            error && "border-danger-500! focus:ring-danger-300!",
            className,
          )}
          aria-describedby={cn(errorId, props["aria-describedby"])}
          aria-invalid={error ? "true" : undefined}
          aria-required={required ? "true" : undefined}
          disabled={disabled}
          id={textareaId}
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
          value={value}
        />
      </span>

      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
