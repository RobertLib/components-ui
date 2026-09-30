import {
  attachRef,
  checkedState,
  useCheckedControl,
  useFormReset,
} from "../hooks/use-form-control";
import { useCallback, useId, useRef, useState } from "react";
import useCustomValidity from "../hooks/use-custom-validity";
import cn, { joinTokens } from "../utils/cn";
import {
  cardClassName,
  cardDescriptionClassName,
  cardInputClassName,
  optionBoxSizes,
  optionIconClassName,
  optionListClassName,
  optionListStyle,
  optionTextSizes,
  type ChoiceDim,
} from "./choice-options";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { formatPlural } from "../i18n/format";
import { ignoreChange, keepCheckboxState } from "./read-only-choice";
import { useLocale } from "../providers/ui-context";
import RequiredMark from "./required-mark";

export interface CheckboxOption<T extends string | number = string | number> {
  /** Content next to the checkbox - its accessible name. */
  label: React.ReactNode;
  /**
   * Reported by `onChange` and submitted with the form - as a string, like
   * the value of any checkbox.
   */
  value: T;
  /** Secondary text under the label - it describes the checkbox. */
  description?: React.ReactNode;
  /** The option cannot be changed - it keeps its state, checked or not. */
  disabled?: boolean;
  /**
   * An icon before the label - at the start of the card with
   * `variant="card"`, e.g. `<Mail size={20} />`. Decorative: the label
   * names the option.
   */
  icon?: React.ReactNode;
}

type Dim = ChoiceDim;

/**
 * The attributes of an HTML element not listed here - `data-*`, `style`,
 * `title`, event handlers - go to the group element, as `id` and `ref` do.
 */
export interface CheckboxGroupProps<
  T extends string | number = string | number,
> extends Omit<
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
   * Id of the element describing the group - the error message and the
   * description describe it too.
   */
  "aria-describedby"?: string;
  /** Accessible name of a group without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a group without `label`. */
  "aria-labelledby"?: string;
  /**
   * Classes of the element around the options (below the legend) - not of
   * the group element, the checkboxes or the messages under them.
   */
  className?: string;
  /**
   * Lays the options out in a grid of this many columns - from the `sm`
   * breakpoint on, in one column on phones. Wins over `orientation`.
   */
  columns?: number;
  /** Initially picked values of an uncontrolled group. */
  defaultValue?: readonly T[];
  /** Help text under the options - it describes the group. */
  description?: React.ReactNode;
  /** Size of the options. */
  dim?: Dim;
  /** Disables all options - like disabled native checkboxes, they are then neither submitted nor validated. */
  disabled?: boolean;
  /** Validation message - also marks the checkboxes as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the checkboxes belong to, when the group is not
   * inside it - like the `form` attribute of a native field. A reset of
   * that form resets the group too.
   */
  form?: string;
  /**
   * Id of the group element - the `<fieldset>` with `label`, otherwise the
   * `role="group"` element. The ids of the error message and the
   * description derive from it.
   */
  id?: string;
  /** Rendered as the `<legend>` of a fieldset - the name of the group. */
  label?: React.ReactNode;
  /**
   * The most options that can be picked. Once reached, the other options
   * are disabled and the group says so. More of them in `value` make the
   * form invalid, with a message the browser shows on submit. Only the
   * values of `options` count - see `onChange` - and not those of
   * `disabled` options, which are not submitted.
   */
  max?: number;
  /**
   * The fewest options that must be picked - the browser refuses to submit
   * the form with fewer, and says so. `required` is `min={1}`. Only the
   * values of `options` count: a value no option has (one of a deleted
   * record) is not submitted, so it picks nothing - nor does a picked
   * `disabled` option, which is not submitted either.
   */
  min?: number;
  /**
   * Shared `name` of the checkboxes - the form submits each picked value
   * under it, so `formData.getAll(name)` returns them. Without a `name` the
   * group is not submitted.
   */
  name?: string;
  /** Called when a checkbox loses the focus - also when it moves to another one. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /**
   * Called with the picked values - in the order of the options, followed by
   * the values of `value` that no option has.
   */
  onChange?: (values: T[]) => void;
  /** Called when a checkbox gets the focus. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** The choices. */
  options: CheckboxOption<T>[];
  /**
   * `horizontal` puts the options on one line, wrapping when they do not
   * fit - cards share the width in columns at least 12rem wide.
   */
  orientation?: "horizontal" | "vertical";
  /**
   * The checkboxes show what is picked and take the focus, but a click or
   * Space changes nothing (`onChange` is not called) - unlike disabled
   * ones, the picked values are submitted with the form. As a native
   * read-only field, the group is not validated: `required`, `min` and
   * `max` only mark it.
   */
  readOnly?: boolean;
  /** Ref to the group element (see `id`). */
  ref?: React.Ref<HTMLElement>;
  /**
   * At least one option must be picked before the form can be submitted -
   * the browser says so. The checkboxes are not `required` one by one.
   */
  required?: boolean;
  /**
   * Adds a checkbox above the options that picks all of them (those not
   * `disabled`) - checked when all are picked, partly checked when some
   * are. `true` labels it "Select all" in the language of the locale, a
   * text labels it with that text. It is not submitted, and not shown when
   * `max` would not let all options be picked.
   */
  selectAll?: boolean | string;
  /** Picked values of a controlled group. */
  value?: readonly T[];
  /**
   * `card` shows each option as a bordered card - its icon, label and
   * description, the checkbox at its end; the whole card toggles it, and a
   * picked card is outlined in the primary color.
   */
  variant?: "default" | "card";
}

// Lines the description up with the label: the padding of the row, the
// checkbox and the space after it
const descriptionIndentStyles = {
  xs: "ps-6",
  sm: "ps-6.5",
  md: "ps-7",
  lg: "ps-8",
};

const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

interface CheckboxRowProps {
  checked: boolean;
  description?: React.ReactNode;
  dim: Dim;
  disabled: boolean;
  form?: string;
  icon?: React.ReactNode;
  /** Base of the ids of the label and the description. */
  id: string;
  indeterminate?: boolean;
  invalid: boolean;
  label: React.ReactNode;
  name?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onChange: (checked: boolean) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  readOnly: boolean;
  /** The message the browser shows for the group - "" when it is valid. */
  validationMessage: string;
  value?: string;
  variant: "default" | "card";
}

/**
 * A checkbox of the group, laid out like an option of `RadioGroup`. A
 * component of its own for the hooks every checkbox needs: a form reset
 * leaves it showing `checked`, and it carries the validity of the group.
 */
function CheckboxRow({
  checked,
  description,
  dim,
  disabled,
  form,
  icon,
  id,
  indeterminate,
  invalid,
  label,
  name,
  onBlur,
  onChange,
  onFocus,
  readOnly,
  validationMessage,
  value,
  variant,
}: CheckboxRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const checkboxRef = useCheckedControl({
    checked,
    form,
    indeterminate,
    ref: inputRef,
  });

  // The browser shows the message when the form is submitted, at this
  // checkbox, and does not submit it
  useCustomValidity(inputRef, validationMessage);

  const card = variant === "card";
  // Only a description that renders describes the checkbox - not the
  // `false` of `isPro && "Pro only"`. FormDescription renders no falsy one.
  const hasDescription = Boolean(description);
  const labelId = `${id}-label`;
  const descriptionId = hasDescription ? `${id}-description` : undefined;

  const input = (
    <input
      aria-describedby={descriptionId}
      aria-invalid={invalid ? "true" : undefined}
      // A card holds its description too - named by the label alone
      aria-labelledby={card ? labelId : undefined}
      aria-readonly={readOnly ? "true" : undefined}
      checked={checked}
      className={cn(
        card
          ? cardInputClassName(dim)
          : cn("shrink-0 accent-primary-500", optionBoxSizes[dim]),
        invalid && "accent-danger-500!",
      )}
      data-disabled={disabled ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
      data-state={checkedState(checked, indeterminate)}
      disabled={disabled}
      form={form}
      name={name}
      onBlur={onBlur}
      onChange={
        readOnly
          ? ignoreChange
          : (event) => {
              onChange(event.target.checked);
              // The click cleared it - a parent refusing the change renders
              // nothing that would bring it back
              if (indeterminate) event.target.indeterminate = true;
            }
      }
      onClick={
        readOnly
          ? (event) => keepCheckboxState(event, indeterminate)
          : undefined
      }
      onFocus={onFocus}
      ref={checkboxRef}
      type="checkbox"
      value={value}
    />
  );

  const iconElement = icon && (
    <span
      aria-hidden="true"
      className={cn(optionIconClassName, !card && "ms-2")}
    >
      {icon}
    </span>
  );

  if (card) {
    return (
      <label
        className={cardClassName({ dim, disabled, invalid, readOnly })}
        data-selected={checked ? "" : undefined}
      >
        {input}
        {iconElement}
        {/* Spans - a label holds no paragraphs */}
        <span className="flex min-w-0 flex-1 flex-col select-none">
          <span className="font-medium" id={labelId}>
            {label}
          </span>
          {hasDescription && (
            <span className={cardDescriptionClassName(dim)} id={descriptionId}>
              {description}
            </span>
          )}
        </span>
      </label>
    );
  }

  return (
    <div
      className={cn(
        disabled && "opacity-60",
        // Disabled by a disabled fieldset around, which no prop tells
        "has-disabled:opacity-60",
      )}
    >
      <label
        className={cn(
          "flex items-center rounded p-1 transition-colors",
          disabled
            ? "cursor-not-allowed"
            : readOnly
              ? "cursor-default"
              : "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800",
          "has-disabled:cursor-not-allowed has-disabled:hover:bg-transparent dark:has-disabled:hover:bg-transparent",
        )}
      >
        {input}
        {iconElement}
        <span className="ms-2 select-none" id={labelId}>
          {label}
        </span>
      </label>
      <FormDescription
        className={cn("-mt-0.5 pe-1 pb-0.5", descriptionIndentStyles[dim])}
        id={descriptionId}
      >
        {description}
      </FormDescription>
    </div>
  );
}

/**
 * A group of checkboxes - any number of a few options. The counterpart of
 * `RadioGroup`: a `<fieldset>` with a `<legend>`, the checkboxes share a
 * `name`, and `required`, `min` and `max` count the picked options.
 */
export default function CheckboxGroup<
  T extends string | number = string | number,
>({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  columns,
  defaultValue,
  description,
  dim = "md",
  disabled = false,
  error,
  form,
  id,
  label,
  max,
  min,
  name,
  onBlur,
  onChange,
  onFocus,
  options,
  orientation = "vertical",
  readOnly = false,
  ref,
  required = false,
  selectAll = false,
  value,
  variant = "default",
  ...props
}: CheckboxGroupProps<T>) {
  const locale = useLocale();
  const { messages } = locale;

  // What the user picked in an uncontrolled group. Until then, and again
  // after a reset, it shows `defaultValue` - also one that arrived late.
  const [pickedValues, setPickedValues] = useState<readonly T[]>();
  const isControlled = value !== undefined;
  const selected = isControlled ? value : (pickedValues ?? defaultValue ?? []);

  // Values come from inputs (strings) as often as from data (numbers)
  const selectedKeys = new Set(selected.map(String));
  const optionKeys = new Set(options.map((option) => String(option.value)));
  const isPicked = (option: CheckboxOption<T>) =>
    selectedKeys.has(String(option.value));

  const generatedId = useId();
  const groupId = id ?? generatedId;
  const errorId = error ? `${groupId}-error` : undefined;
  const descriptionId = description ? `${groupId}-description` : undefined;

  // `form.reset()` - also the one after a React form action - brings back
  // the `defaultValue`, like it does for native checkboxes
  const formResetRef = useFormReset(() => setPickedValues(undefined), form);

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

  // What the form submits counts for `min` and `max` - the values the
  // options have, not those of disabled options
  const pickedCount = disabled
    ? 0
    : options.filter((option) => isPicked(option) && !option.disabled).length;
  // Nothing changes in a read-only group - no option is disabled for it
  const limitReached = !readOnly && max !== undefined && pickedCount >= max;
  const isOptionDisabled = (option: CheckboxOption<T>) =>
    disabled || !!option.disabled || (limitReached && !isPicked(option));

  // The group is invalid with too few or too many picked - the first
  // checkbox that can be changed carries the message (a disabled one is not
  // validated, nor is a read-only group)
  const minCount = min ?? (required ? 1 : 0);
  const validationMessage = readOnly
    ? ""
    : pickedCount < minCount
      ? formatPlural(locale.code, messages.checkboxGroup.min, minCount)
      : max !== undefined && pickedCount > max
        ? formatPlural(locale.code, messages.checkboxGroup.max, max)
        : "";
  const validationIndex = options.findIndex(
    (option) => !isOptionDisabled(option),
  );
  // An empty list, or one with only disabled options, still has to satisfy
  // the group's minimum. No option can carry its validation message then.
  const needsValidationInput =
    !disabled && validationIndex === -1 && validationMessage !== "";
  const validationRef = useRef<HTMLInputElement | null>(null);
  useCustomValidity(
    validationRef,
    needsValidationInput ? validationMessage : "",
  );

  const commit = (nextKeys: ReadonlySet<string>) => {
    // In the order of the options - the values no option has stay, at the end
    const next = [
      ...options
        .filter((option) => nextKeys.has(String(option.value)))
        .map((option) => option.value),
      ...selected.filter((picked) => !optionKeys.has(String(picked))),
    ];

    if (!isControlled) setPickedValues(next);
    onChange?.(next);
  };

  const toggle = (option: CheckboxOption<T>, checked: boolean) => {
    const nextKeys = new Set(selectedKeys);
    if (checked) nextKeys.add(String(option.value));
    else nextKeys.delete(String(option.value));
    commit(nextKeys);
  };

  // "Select all" changes the options that can be changed - a disabled one
  // keeps its state
  const changeableOptions = options.filter(
    (option) => !disabled && !option.disabled,
  );
  const changeablePicked = changeableOptions.filter(isPicked).length;
  const allPicked =
    changeableOptions.length > 0 &&
    changeablePicked === changeableOptions.length;
  // With all of them picked, the changeable options are what counts
  const showSelectAll =
    selectAll !== false &&
    (max === undefined || changeableOptions.length <= max);

  const toggleAll = (checked: boolean) => {
    const nextKeys = new Set(selectedKeys);
    for (const option of changeableOptions) {
      if (checked) nextKeys.add(String(option.value));
      else nextKeys.delete(String(option.value));
    }
    commit(nextKeys);
  };

  const rowProps = {
    dim,
    form,
    invalid: !!error,
    onBlur,
    onFocus,
    readOnly,
  };

  const optionList = (
    <div className={cn(!!label && "mt-2", optionTextSizes[dim], className)}>
      {needsValidationInput && (
        <input
          aria-hidden="true"
          disabled={disabled}
          form={form}
          onChange={() => {}}
          onFocus={(event) => {
            const input = event.currentTarget;
            // Let native validation finish focusing its input first.
            // Moving focus synchronously prevents Firefox from focusing
            // this same invalid control on subsequent submit attempts.
            queueMicrotask(() => {
              const group = groupElement.current;
              if (
                validationRef.current === input &&
                input.isConnected &&
                input.ownerDocument.activeElement === input &&
                group?.isConnected
              ) {
                group.focus();
              }
            });
          }}
          readOnly={readOnly}
          ref={validationRef}
          // Native required also works if Activity mounts the input while
          // hidden, before its ref and custom validity can attach.
          required
          style={hiddenValidationStyle}
          tabIndex={-1}
          type="text"
          value=""
        />
      )}
      {showSelectAll && (
        <CheckboxRow
          {...rowProps}
          checked={allPicked}
          disabled={changeableOptions.length === 0}
          id={`${groupId}-select-all`}
          indeterminate={changeablePicked > 0 && !allPicked}
          // No value of the group - the error is about the options
          invalid={false}
          label={
            typeof selectAll === "string"
              ? selectAll
              : messages.checkboxGroup.selectAll
          }
          onChange={toggleAll}
          validationMessage=""
          // A plain row above the cards
          variant="default"
        />
      )}
      <div
        className={cn(
          optionListClassName(variant, orientation, columns),
          // The options belong to "Select all" - indented under it, or below
          // it in a grid of cards
          showSelectAll &&
            (variant === "card"
              ? "mt-2"
              : columns === undefined && orientation === "vertical" && "ps-5"),
        )}
        style={optionListStyle(columns)}
      >
        {options.map((option, index) => (
          <CheckboxRow
            {...rowProps}
            checked={isPicked(option)}
            description={option.description}
            disabled={isOptionDisabled(option)}
            icon={option.icon}
            id={`${groupId}-option-${index}`}
            key={option.value}
            label={option.label}
            name={name}
            onChange={(checked) => toggle(option, checked)}
            validationMessage={
              index === validationIndex ? validationMessage : ""
            }
            value={String(option.value)}
            variant={variant}
          />
        ))}
      </div>
      {/* Present before it has something to say, so that it is announced */}
      <p
        className={cn(
          "text-xs text-neutral-600 dark:text-neutral-400",
          limitReached && "mt-1",
        )}
        role="status"
      >
        {limitReached &&
          max !== undefined &&
          formatPlural(locale.code, messages.checkboxGroup.max, max)}
      </p>
    </div>
  );

  // A fieldset is a `group`, which has no invalid or required state - the
  // checkboxes are marked invalid, the browser tells what is missing
  const groupProps = {
    ...props,
    "aria-describedby": joinTokens(errorId, descriptionId, ariaDescribedBy),
    "data-disabled": disabled ? "" : undefined,
    "data-invalid": error ? "" : undefined,
    "data-orientation": orientation,
    "data-readonly": readOnly ? "" : undefined,
    id,
    ref: groupElementRef,
    tabIndex: props.tabIndex ?? (needsValidationInput ? -1 : undefined),
  };

  return (
    <div className="flex flex-col gap-1.5" ref={formResetRef}>
      {label ? (
        <fieldset {...groupProps}>
          <legend className="block text-sm font-medium">
            {label}
            {messages.form.labelSuffix}{" "}
            {/* The star is for the eye - the browser tells what is missing */}
            {minCount > 0 && <RequiredMark />}
          </legend>
          {optionList}
        </fieldset>
      ) : (
        <div
          {...groupProps}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          role="group"
        >
          {optionList}
        </div>
      )}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
