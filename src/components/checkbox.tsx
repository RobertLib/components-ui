import { useId } from "react";
import cn from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { useCheckedControl } from "../hooks/use-form-control";

export interface CheckboxProps extends Omit<
  React.ComponentProps<"input">,
  "type"
> {
  /**
   * Classes of the checkbox `<input>` itself - not of the wrapper around it,
   * its label, description or error message.
   */
  className?: string;
  /** Secondary text under the label. */
  description?: React.ReactNode;
  /** Validation message - also marks the checkbox as invalid. */
  error?: string;
  /**
   * Shows the checkbox as partly checked - e.g. a "select all" of a partly
   * selected list; assistive technology announces it as "mixed". A click
   * clears it like on a native checkbox: the checkbox turns checked or
   * unchecked, and the next render with `indeterminate` brings it back.
   */
  indeterminate?: boolean;
  /** Text of the `<label>` next to the checkbox. */
  label?: string;
}

/**
 * A checkbox with a label and an optional description. Works controlled
 * (`checked` + `onChange`) and uncontrolled (`defaultChecked`) like a native
 * one - `form.reset()` brings back `defaultChecked` and leaves a controlled
 * checkbox as `checked` says. `indeterminate` shows a partly checked state.
 */
export default function Checkbox({
  className,
  description,
  error,
  id,
  indeterminate,
  label,
  ref,
  required,
  ...props
}: CheckboxProps) {
  const checkboxRef = useCheckedControl({
    checked: props.checked,
    indeterminate,
    ref,
  });
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
          aria-invalid={error ? "true" : props["aria-invalid"]}
          aria-required={required ? "true" : props["aria-required"]}
          id={checkboxId}
          ref={checkboxRef}
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
                {/* The star is for the eye - `required` tells assistive technology */}
                {required && (
                  <span
                    aria-hidden="true"
                    className="ml-1 text-danger-700 dark:text-danger-400"
                  >
                    *
                  </span>
                )}
              </label>
            )}
            <FormDescription className="mt-0.5" id={descriptionId}>
              {description}
            </FormDescription>
          </div>
        )}
      </div>

      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
