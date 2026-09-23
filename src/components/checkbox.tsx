import { useId } from "react";
import cn from "../utils/cn";
import FormError from "./form-error";

export interface CheckboxProps extends Omit<
  React.ComponentProps<"input">,
  "type"
> {
  /** Secondary text under the label. */
  description?: string;
  /** Validation message - also marks the checkbox as invalid. */
  error?: string;
  label?: string;
}

/**
 * A checkbox with a label and an optional description. Works controlled
 * (`checked` + `onChange`) and uncontrolled (`defaultChecked`) like a native
 * one - `form.reset()` brings back `defaultChecked`.
 */
export default function Checkbox({
  className,
  description,
  error,
  id,
  label,
  required,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const errorId = error ? `${checkboxId}-error` : undefined;
  const descriptionId = description ? `${checkboxId}-description` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <input
          {...props}
          className={cn(
            "mt-1 accent-primary-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "accent-danger-500!",
            className,
          )}
          aria-describedby={cn(
            errorId,
            descriptionId,
            props["aria-describedby"],
          )}
          aria-invalid={error ? "true" : undefined}
          aria-required={required ? "true" : undefined}
          id={checkboxId}
          required={required}
          type="checkbox"
        />

        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label
                className="cursor-pointer text-sm font-medium"
                htmlFor={checkboxId}
              >
                {label}
                {required && <span className="ml-1 text-danger-500">*</span>}
              </label>
            )}
            {description && (
              <p
                className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400"
                id={descriptionId}
              >
                {description}
              </p>
            )}
          </div>
        )}
      </div>

      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
