import { useId } from "react";
import cn, { joinTokens } from "../../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { ignoreChange, keepCheckboxState } from "./read-only-choice";
import {
  checkedState,
  isAriaInvalid,
  useCheckedControl,
} from "../../hooks/use-form-control";
import RequiredMark from "./required-mark";

type Dim = "xs" | "sm" | "md" | "lg";

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
   * visually hidden checkbox, the description or the error message. E.g.
   * `flex justify-between` puts a `labelPosition="start"` label and the
   * switch at the two ends of a row.
   */
  className?: string;
  /** Secondary text under the label - it describes the switch. */
  description?: React.ReactNode;
  /** Size of the track and the label. */
  dim?: Dim;
  /** Validation message - also marks the switch as invalid. */
  error?: string;
  /** Text next to the switch - its accessible name. */
  label?: React.ReactNode;
  /**
   * Side of the switch the label is on: `end` - after the track, `start` -
   * before it, as in a list of settings.
   */
  labelPosition?: "start" | "end";
  /**
   * The switch shows its state and takes the focus, but a click or Space
   * does not change it (`onChange` is not called) - unlike a disabled one,
   * a read-only switch that is on is submitted with the form. As a native
   * read-only field, it is not validated: `required` only marks it.
   */
  readOnly?: boolean;
}

// The knob is two pixels off the ends of the track and moves by its own
// width - the track is two knobs and four pixels wide
const trackSizes: Record<Dim, string> = {
  xs: "h-3.5 w-6 after:size-2.5",
  sm: "h-4 w-7 after:size-3",
  md: "h-5 w-9 after:size-4",
  lg: "h-6 w-11 after:size-5",
};

const labelSizes: Record<Dim, string> = {
  xs: "text-sm",
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

const labelGaps = {
  end: { xs: "ms-2", sm: "ms-2", md: "ms-3", lg: "ms-3" },
  start: { xs: "me-2", sm: "me-2", md: "me-3", lg: "me-3" },
};

// Under the text of a label at the end - past the track and its margin
const descriptionIndents: Record<Dim, string> = {
  xs: "ms-8",
  sm: "ms-9",
  md: "ms-12",
  lg: "ms-14",
};

/**
 * An on/off toggle - a checkbox underneath, so it works in forms and with
 * `checked` / `defaultChecked` / `onChange` like one.
 */
export default function Switch({
  className,
  description,
  dim = "md",
  error,
  id,
  label,
  labelPosition = "end",
  name,
  onChange,
  onClick,
  readOnly = false,
  ref,
  required,
  ...props
}: SwitchProps) {
  const checkboxRef = useCheckedControl({
    checked: props.checked,
    form: props.form,
    ref,
  });
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const invalid = !!error || isAriaInvalid(props["aria-invalid"]);

  const text = label && (
    <span
      className={cn(
        "font-medium",
        labelSizes[dim],
        labelGaps[labelPosition][dim],
        // One color or the other - with both, the CSS order decides
        error
          ? "text-danger-700 dark:text-danger-400"
          : "text-neutral-900 dark:text-neutral-300",
      )}
      id={labelId}
    >
      {label}{" "}
      {/* The star is for the eye - `required` tells assistive technology */}
      {required && <RequiredMark />}
    </span>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={cn(
          "inline-flex items-center",
          readOnly ? "cursor-default" : "cursor-pointer",
          className,
        )}
      >
        <input
          {...props}
          aria-describedby={joinTokens(
            errorId,
            descriptionId,
            props["aria-describedby"],
          )}
          aria-invalid={error ? "true" : props["aria-invalid"]}
          // Merged like `aria-describedby` - the consumer's name is kept
          aria-labelledby={joinTokens(
            label ? labelId : undefined,
            props["aria-labelledby"],
          )}
          aria-readonly={readOnly ? "true" : props["aria-readonly"]}
          className="peer sr-only"
          data-disabled={props.disabled ? "" : undefined}
          data-invalid={invalid ? "" : undefined}
          data-readonly={readOnly ? "" : undefined}
          // Kept telling what the switch shows - also after a click on an
          // uncontrolled one, a reset or a script setting `checked`
          data-state={checkedState(props.checked ?? props.defaultChecked)}
          id={inputId}
          name={name}
          onChange={readOnly ? ignoreChange : onChange}
          onClick={(event) => {
            onClick?.(event);
            if (readOnly) keepCheckboxState(event);
          }}
          ref={checkboxRef}
          // A read-only field is not validated - it could not be fixed
          required={required && !readOnly}
          role="switch"
          type="checkbox"
        />
        {labelPosition === "start" && text}
        <div
          aria-hidden="true"
          className={cn(
            "relative shrink-0 rounded-full bg-neutral-200 peer-checked:bg-primary-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:inset-s-0.5 after:top-0.5 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white motion-reduce:after:transition-none rtl:peer-checked:after:-translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-primary-600 dark:after:border-neutral-700",
            trackSizes[dim],
            // Forced colors (Windows High Contrast) draw no background and
            // no ring: the track gets an outline, the system's highlight
            // color when on, and the keyboard focus an outline around it
            "forced-colors:peer-checked:bg-[Highlight]",
            // A ring marks the error - a border would move the knob. The
            // keyboard focus then shows as an outline apart from it, not as
            // the same ring grown by a pixel. In forced colors the outline
            // of the track is thicker.
            error
              ? "ring-1 ring-danger-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-danger-500 forced-colors:outline-2"
              : "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 forced-colors:outline-1 forced-colors:peer-focus-visible:outline-2 forced-colors:peer-focus-visible:outline-offset-2",
          )}
        />
        {labelPosition === "end" && text}
      </label>

      <FormDescription
        className={cn(
          "-mt-1",
          !!label && labelPosition === "end" && descriptionIndents[dim],
        )}
        id={descriptionId}
      >
        {description}
      </FormDescription>
      {error && <FormError id={errorId}>{error}</FormError>}
    </div>
  );
}
