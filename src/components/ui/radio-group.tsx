import {
  attachRef,
  checkedState,
  useFormControl,
  useOmitFormValue,
} from "../../hooks/use-form-control";
import { useCallback, useId, useRef } from "react";
import cn, { joinTokens } from "../../utils/cn";
import {
  cardClassName,
  cardDescriptionClassName,
  cardInputClassName,
  optionBoxSizes,
  optionIconClassName,
  optionListClassName,
  optionListStyle,
  optionTextSizes,
} from "./choice-options";
import FormDescription from "./form-description";
import FormError from "./form-error";
import {
  ignoreChange,
  keepRadioState,
  moveReadOnlyRadioFocus,
} from "./read-only-choice";
import { useMessages } from "../../providers/ui-context";
import RequiredMark from "./required-mark";

export interface RadioOption<T = string | number> {
  /** Secondary text under the label - it describes the radio. */
  description?: React.ReactNode;
  /** Shown, but cannot be picked. */
  disabled?: boolean;
  /**
   * An icon before the label - at the start of the card with
   * `variant="card"`, e.g. `<Truck size={20} />`. Decorative: the label
   * names the option.
   */
  icon?: React.ReactNode;
  /** Content next to the radio - its accessible name. */
  label: React.ReactNode;
  /** Submitted with the form - `event.target.value` is its string form. */
  value: T;
}

/**
 * The attributes of an HTML element not listed here - `data-*`, `style`,
 * `title`, event handlers - go to the group element, as `id` and `ref` do.
 */
export interface RadioGroupProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  | "children"
  | "dangerouslySetInnerHTML"
  | "defaultChecked"
  | "defaultValue"
  | "onBlur"
  | "onChange"
  | "onFocus"
> {
  /**
   * Id of the element describing the group - the error message describes
   * it too.
   */
  "aria-describedby"?: string;
  /** Accessible name of a group without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a group without `label`. */
  "aria-labelledby"?: string;
  /**
   * Classes of the element around the options (below the legend) - not of
   * the group element, the radios, the description or the error message.
   */
  className?: string;
  /**
   * Lays the options out in a grid of this many columns - from the `sm`
   * breakpoint on, in one column on phones. Wins over `orientation`.
   */
  columns?: number;
  /** Initially selected value of an uncontrolled group. */
  defaultValue?: string | number;
  /**
   * Help text under the options - it describes the group for screen
   * readers.
   */
  description?: React.ReactNode;
  /** Size of the options. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Disables all options. */
  disabled?: boolean;
  /** Validation message - also marks the group as invalid. */
  error?: string;
  /**
   * Id of a form elsewhere in the page - the radios belong to it, and its
   * reset resets the group.
   */
  form?: string;
  /**
   * Id of the group element - the `<fieldset>` with `label`, otherwise the
   * `role="radiogroup"` element. The ids of the description and the error
   * message derive from it.
   */
  id?: string;
  /** Rendered as the `<legend>` of a fieldset - the name of the group. */
  label?: React.ReactNode;
  /**
   * Shared `name` of the radio inputs - the form submits the picked value
   * under it. Without a `name` the options still form one group (the arrow
   * keys, one pick, `required`), but the form does not submit it.
   */
  name?: string;
  /** Called when a radio loses the focus - also when it moves to another one. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Called with the change event of the picked radio - `event.target.value` is always a string. */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Called when a radio gets the focus. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** The choices. */
  options: RadioOption[];
  /**
   * `vertical` - the options under each other, `horizontal` - in a row,
   * wrapping when it is full (cards share the width in columns at least
   * 12rem wide). The arrow keys move through them either way.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * The group shows the pick and takes the focus, but a click, Space or an
   * arrow key does not change it (`onChange` is not called) - the arrow keys
   * move the focus through the options. Unlike a disabled group, the pick
   * is submitted with the form. As a native read-only field, it is not
   * validated: `required` only marks it.
   */
  readOnly?: boolean;
  /** Ref to the group element (see `id`). */
  ref?: React.Ref<HTMLElement>;
  /** An option must be picked before the form can be submitted. */
  required?: boolean;
  /** Selected value of a controlled group. */
  value?: string | number;
  /**
   * `card` shows each option as a bordered card - its icon, label and
   * description, the radio at its end; the whole card picks it, and the
   * picked card is outlined in the primary color.
   */
  variant?: "default" | "card";
}

/** A group of radio buttons - one of a few options. */
export default function RadioGroup({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  columns,
  defaultValue,
  description,
  disabled = false,
  dim = "md",
  error,
  form,
  id,
  label,
  name,
  onBlur,
  onChange,
  onFocus,
  options,
  orientation = "vertical",
  readOnly = false,
  ref,
  required,
  value: controlledValue,
  variant = "default",
  ...props
}: RadioGroupProps) {
  const messages = useMessages().ui;
  const { fieldRef, handleChange, hasValue, value } = useFormControl({
    defaultValue,
    form,
    onChange,
    value: controlledValue,
  });

  // Without a name the options of two groups would form one radio group
  const generatedName = useId();
  const groupName = name ?? generatedName;
  // From the id, not the name - two groups may share a name (in two forms)
  const idBase = id ?? generatedName;
  const errorId = error ? `${idBase}-error` : undefined;
  const descriptionId = description ? `${idBase}-description` : undefined;
  const card = variant === "card";

  const groupElement = useRef<HTMLElement | null>(null);
  const groupElementRef = useCallback(
    (element: HTMLElement | null) => {
      groupElement.current = element;
      const detachRef = attachRef(ref, element);

      return () => {
        groupElement.current = null;
        detachRef();
      };
    },
    [ref],
  );

  // The generated name only groups the radios - the form leaves it out of
  // its data, as it leaves out radios without a name. The form of the
  // radios: the one `form` names, or the one around them.
  const groupRef = useOmitFormValue(
    name === undefined ? generatedName : undefined,
    form,
  );

  const optionList = (
    <div
      className={cn(
        optionListClassName(variant, orientation, columns),
        !!label && "mt-2",
        optionTextSizes[dim],
        className,
      )}
      style={optionListStyle(columns)}
    >
      {options.map((option, index) => {
        const optionDisabled = disabled || !!option.disabled;
        // A described option - and every card, which holds its description
        // too - is named by its label alone
        const optionId = `${idBase}-option-${index}`;
        // Only a description that renders - not the `false` of `isPro &&
        // "Pro only"`, as in a CheckboxGroup
        const described = Boolean(option.description);
        const namedByLabel = described || card;

        const checked = hasValue && String(value) === String(option.value);
        const input = (
          <input
            className={cn(
              card
                ? cardInputClassName(dim)
                : cn(
                    "shrink-0 border-neutral-300 accent-primary-500",
                    optionBoxSizes[dim],
                    described && "mt-1",
                  ),
              error && "accent-danger-500!",
            )}
            aria-describedby={described ? `${optionId}-description` : undefined}
            aria-labelledby={namedByLabel ? `${optionId}-label` : undefined}
            // The value of an input is always a string - compare as such, so
            // numeric option values stay checked after a change
            checked={checked}
            data-disabled={optionDisabled ? "" : undefined}
            data-readonly={readOnly ? "" : undefined}
            data-state={checkedState(checked)}
            disabled={optionDisabled}
            form={form}
            name={groupName}
            onBlur={onBlur}
            onChange={readOnly ? ignoreChange : handleChange}
            onClick={readOnly ? keepRadioState : undefined}
            onFocus={onFocus}
            onKeyDown={
              readOnly
                ? (event) => moveReadOnlyRadioFocus(event, groupElement.current)
                : undefined
            }
            ref={fieldRef}
            // A read-only field is not validated - it could not be fixed
            required={required && !readOnly}
            type="radio"
            value={option.value}
          />
        );

        const icon = option.icon && (
          <span
            aria-hidden="true"
            className={cn(optionIconClassName, !card && "ms-2")}
          >
            {option.icon}
          </span>
        );

        if (card) {
          return (
            <label
              className={cardClassName({
                dim,
                disabled: optionDisabled,
                invalid: !!error,
                readOnly,
              })}
              data-selected={checked ? "" : undefined}
              key={option.value}
            >
              {input}
              {icon}
              {/* Spans - a label holds no paragraphs */}
              <span className="flex min-w-0 flex-1 flex-col select-none">
                <span className="font-medium" id={`${optionId}-label`}>
                  {option.label}
                </span>
                {described && (
                  <span
                    className={cardDescriptionClassName(dim)}
                    id={`${optionId}-description`}
                  >
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        }

        return (
          <label
            className={cn(
              "flex rounded p-1 transition-colors",
              // The radio stays on the first line of a described option
              described ? "items-start" : "items-center",
              optionDisabled
                ? "cursor-not-allowed opacity-60"
                : readOnly
                  ? "cursor-default"
                  : "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800",
              // Disabled by a disabled fieldset around, which no prop tells
              "has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:bg-transparent dark:has-disabled:hover:bg-transparent",
            )}
            key={option.value}
          >
            {input}
            {icon}
            {described ? (
              // Spans - a label holds no paragraphs
              <span className="ms-2 flex flex-col select-none">
                <span id={`${optionId}-label`}>{option.label}</span>
                <span
                  className="text-xs text-neutral-600 dark:text-neutral-400"
                  id={`${optionId}-description`}
                >
                  {option.description}
                </span>
              </span>
            ) : (
              <span className="ms-2 select-none">{option.label}</span>
            )}
          </label>
        );
      })}
    </div>
  );

  // The group carries the error and `required` - the radios keep `required`
  // for the browser's validation
  const groupProps = {
    ...props,
    "aria-describedby": joinTokens(errorId, descriptionId, ariaDescribedBy),
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-readonly": readOnly ? ("true" as const) : undefined,
    "aria-required": required ? ("true" as const) : undefined,
    "data-disabled": disabled ? "" : undefined,
    "data-invalid": error ? "" : undefined,
    "data-orientation": orientation,
    "data-readonly": readOnly ? "" : undefined,
    id,
    ref: groupElementRef,
    role: "radiogroup",
  };

  return (
    <div className="flex flex-col gap-1.5" ref={groupRef}>
      {label ? (
        // A fieldset is a `group`, which has no invalid or required state
        <fieldset {...groupProps}>
          <legend className="block text-sm font-medium">
            {label}
            {messages.form.labelSuffix}{" "}
            {/* The star is for the eye - `required` tells assistive technology */}
            {required && <RequiredMark />}
          </legend>
          {optionList}
        </fieldset>
      ) : (
        <div
          {...groupProps}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
        >
          {optionList}
        </div>
      )}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
