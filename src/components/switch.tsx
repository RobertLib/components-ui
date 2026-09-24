import { useId } from "react";
import cn from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { useCheckedControl } from "../hooks/use-form-control";

export interface SwitchProps extends Omit<
  React.ComponentProps<"input">,
  "type"
> {
  /**
   * Id of the element naming the switch - with `label`, both name it, the
   * label first.
   */
  "aria-labelledby"?: string;
  /**
   * Classes of the `<label>` around the track and the text - not of the
   * visually hidden checkbox, the description or the error message.
   */
  className?: string;
  /** Secondary text under the label - it describes the switch. */
  description?: React.ReactNode;
  /** Validation message - also marks the switch as invalid. */
  error?: string;
  /** Text next to the switch - its accessible name. */
  label?: React.ReactNode;
}

/**
 * An on/off toggle - a checkbox underneath, so it works in forms and with
 * `checked` / `defaultChecked` / `onChange` like one.
 */
export default function Switch({
  className,
  description,
  error,
  id,
  label,
  name,
  ref,
  required,
  ...props
}: SwitchProps) {
  const checkboxRef = useCheckedControl({ checked: props.checked, ref });
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={cn("inline-flex cursor-pointer items-center", className)}
      >
        <input
          {...props}
          aria-describedby={cn(
            errorId,
            descriptionId,
            props["aria-describedby"],
          )}
          aria-invalid={error ? "true" : props["aria-invalid"]}
          // Merged like `aria-describedby` - the consumer's name is kept
          aria-labelledby={cn(
            label ? labelId : undefined,
            props["aria-labelledby"],
          )}
          className="peer sr-only"
          id={inputId}
          name={name}
          ref={checkboxRef}
          required={required}
          role="switch"
          type="checkbox"
        />
        <div
          aria-hidden="true"
          className={cn(
            "peer relative h-5 w-9 shrink-0 rounded-full bg-neutral-200 peer-checked:bg-primary-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white motion-reduce:after:transition-none rtl:peer-checked:after:-translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-primary-600 dark:after:border-neutral-700",
            // A ring marks the error - a border would move the knob. The
            // keyboard focus then shows as an outline apart from it, not as
            // the same ring grown by a pixel.
            error
              ? "ring-1 ring-danger-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-danger-500"
              : "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500",
          )}
        />
        {label && (
          <span
            className={cn(
              "ms-3 text-sm font-medium",
              // One color or the other - with both, the CSS order decides
              error
                ? "text-danger-700 dark:text-danger-400"
                : "text-neutral-900 dark:text-neutral-300",
            )}
            id={labelId}
          >
            {label}{" "}
            {/* The star is for the eye - `required` tells assistive technology */}
            {required && (
              <span
                aria-hidden="true"
                className="text-danger-700 dark:text-danger-400"
              >
                *
              </span>
            )}
          </span>
        )}
      </label>

      {/* Under the text of the label - past the track and its margin */}
      <FormDescription
        className={cn("-mt-1", !!label && "ms-12")}
        id={descriptionId}
      >
        {description}
      </FormDescription>
      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
