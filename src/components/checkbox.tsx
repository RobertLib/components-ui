import { useId } from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { ignoreChange, keepCheckboxState } from "./read-only-choice";
import {
  checkedState,
  isAriaInvalid,
  useCheckedControl,
} from "../hooks/use-form-control";
import RequiredMark from "./required-mark";

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
  /**
   * Size of the checkbox and its label - the boxes of `CheckboxGroup` and
   * `RadioGroup` of the same `dim` are as big.
   */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Validation message - also marks the checkbox as invalid. */
  error?: string;
  /**
   * Shows the checkbox as partly checked - e.g. a "select all" of a partly
   * selected list; assistive technology announces it as "mixed". A click
   * clears it like on a native checkbox: the checkbox turns checked or
   * unchecked, and the next render with `indeterminate` brings it back.
   * `false` - or `undefined` after `true` - clears it; otherwise `undefined`
   * leaves the DOM property to the page.
   */
  indeterminate?: boolean;
  /** Content of the `<label>` next to the checkbox - its accessible name. */
  label?: React.ReactNode;
  /**
   * The checkbox shows its state and takes the focus, but a click or Space
   * does not change it (`onChange` is not called) - unlike a disabled one,
   * a checked read-only checkbox is submitted with the form. As a native
   * read-only field, it is not validated: `required` only marks it.
   */
  readOnly?: boolean;
}

// The box - as big as those of CheckboxGroup and RadioGroup
const boxSizes = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

// Centers the box on the first line of the label
const boxOffsets = {
  xs: "mt-1",
  sm: "mt-0.75",
  md: "mt-0.5",
  lg: "mt-0.5",
};

const labelSizes = {
  xs: "text-sm",
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

const gaps = {
  xs: "gap-1.5",
  sm: "gap-2",
  md: "gap-2",
  lg: "gap-2.5",
};

/**
 * A checkbox with a label and an optional description. Works controlled
 * (`checked` + `onChange`) and uncontrolled (`defaultChecked`) like a native
 * one - `form.reset()` brings back `defaultChecked` and leaves a controlled
 * checkbox as `checked` says. `indeterminate` shows a partly checked state.
 */
export default function Checkbox({
  className,
  description,
  dim = "md",
  error,
  id,
  indeterminate,
  label,
  onChange,
  onClick,
  readOnly = false,
  ref,
  required,
  ...props
}: CheckboxProps) {
  const checkboxRef = useCheckedControl({
    checked: props.checked,
    form: props.form,
    indeterminate,
    ref,
  });
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const errorId = error ? `${checkboxId}-error` : undefined;
  const descriptionId = description ? `${checkboxId}-description` : undefined;
  const hasText = !!label || !!description;
  const invalid = !!error || isAriaInvalid(props["aria-invalid"]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("flex items-start", gaps[dim])}>
        <input
          {...props}
          className={cn(
            "shrink-0 accent-primary-500",
            boxSizes[dim],
            hasText && boxOffsets[dim],
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "accent-danger-500!",
            className,
          )}
          aria-describedby={joinTokens(
            errorId,
            descriptionId,
            props["aria-describedby"],
          )}
          aria-invalid={error ? "true" : props["aria-invalid"]}
          aria-readonly={readOnly ? "true" : props["aria-readonly"]}
          aria-required={required ? "true" : props["aria-required"]}
          data-disabled={props.disabled ? "" : undefined}
          data-invalid={invalid ? "" : undefined}
          data-readonly={readOnly ? "" : undefined}
          // Kept telling what the checkbox shows - also after a click on an
          // uncontrolled one, a reset or a script setting `checked`
          data-state={checkedState(
            props.checked ?? props.defaultChecked,
            indeterminate,
          )}
          id={checkboxId}
          onChange={readOnly ? ignoreChange : onChange}
          onClick={(event) => {
            onClick?.(event);
            if (readOnly) keepCheckboxState(event, indeterminate);
          }}
          ref={checkboxRef}
          // A read-only field is not validated - it could not be fixed
          required={required && !readOnly}
          type="checkbox"
        />

        {hasText && (
          <div className="flex flex-col">
            {label && (
              <label
                className={cn(
                  "font-medium",
                  labelSizes[dim],
                  readOnly ? "cursor-default" : "cursor-pointer",
                )}
                htmlFor={checkboxId}
              >
                {label}
                {/* The star is for the eye - `required` tells assistive technology */}
                {required && <RequiredMark className="ms-1" />}
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
