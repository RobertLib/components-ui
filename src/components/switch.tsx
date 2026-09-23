import { useId } from "react";
import cn from "../utils/cn";
import FormError from "./form-error";

export interface SwitchProps extends Omit<
  React.ComponentProps<"input">,
  "type"
> {
  /** Validation message - also marks the switch as invalid. */
  error?: string;
  label?: React.ReactNode;
}

/**
 * An on/off toggle - a checkbox underneath, so it works in forms and with
 * `checked` / `defaultChecked` / `onChange` like one.
 */
export default function Switch({
  className,
  error,
  id,
  label,
  name,
  required,
  ...props
}: SwitchProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={cn("inline-flex cursor-pointer items-center", className)}
      >
        <input
          {...props}
          aria-describedby={cn(errorId, props["aria-describedby"])}
          aria-invalid={error ? "true" : undefined}
          aria-labelledby={label ? labelId : props["aria-labelledby"]}
          className="peer sr-only"
          id={inputId}
          name={name}
          required={required}
          role="switch"
          type="checkbox"
        />
        <div
          aria-hidden="true"
          className={cn(
            "peer relative h-5 w-9 shrink-0 rounded-full border-neutral-600 bg-neutral-200 peer-checked:bg-primary-600 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full dark:border-neutral-400 dark:bg-neutral-700 dark:peer-checked:bg-primary-600 dark:peer-focus-visible:ring-primary-800 dark:after:border-neutral-700",
            error &&
              "border-danger-500 peer-focus-visible:ring-danger-300 dark:peer-focus-visible:ring-danger-800",
          )}
        />
        {label && (
          <span
            className={cn(
              "ms-3 text-sm font-medium text-neutral-900 dark:text-neutral-300",
              error && "text-danger-500",
            )}
            id={labelId}
          >
            {label} {required && <span className="text-danger-500">*</span>}
          </span>
        )}
      </label>

      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
