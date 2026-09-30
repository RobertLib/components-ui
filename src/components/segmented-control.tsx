import {
  attachRef,
  checkedState,
  useFormControl,
  useOmitFormValue,
} from "../hooks/use-form-control";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import cn, { joinTokens } from "../utils/cn";
import FormDescription from "./form-description";
import FormError from "./form-error";
import {
  ignoreChange,
  keepRadioState,
  moveReadOnlyRadioFocus,
} from "./read-only-choice";
import { useMessages } from "../providers/ui-context";
import RequiredMark from "./required-mark";

type Dim = "xs" | "sm" | "md" | "lg";

export interface SegmentedControlOption<
  T extends string | number = string | number,
> {
  /**
   * Content of the option. Leave it out for an icon-only option - and name
   * it with `aria-label`.
   */
  label?: React.ReactNode;
  /**
   * Reported by `onChange` and submitted with the form - as a string, like
   * the value of any radio.
   */
  value: T;
  /** Accessible name - required for an icon-only option, whose tooltip it also is. */
  "aria-label"?: string;
  /** The option cannot be picked. */
  disabled?: boolean;
  /** An icon before the label, e.g. `<List size={16} />`. */
  icon?: React.ReactNode;
}

/**
 * The attributes of an HTML element not listed here - `data-*`, `style`,
 * `title`, event handlers - go to the group element, as `id` and `ref` do.
 */
export interface SegmentedControlProps<
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
   * Id of the element describing the control - the error message and the
   * description describe it too.
   */
  "aria-describedby"?: string;
  /** Accessible name of a control without `label`. */
  "aria-label"?: string;
  /** Id of the element naming a control without `label`. */
  "aria-labelledby"?: string;
  /** Classes of the bar of options - not of the label or the messages. */
  className?: string;
  /** Initially picked value of an uncontrolled control. */
  defaultValue?: T;
  /** Help text under the control - it describes it. */
  description?: React.ReactNode;
  /**
   * Size of the control - a horizontal bar is as high as an `Input` of the
   * same `dim`, with text as big.
   * @default "md"
   */
  dim?: Dim;
  /** Disables all options. */
  disabled?: boolean;
  /** Validation message - also marks the control as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the control belongs to, when it is not inside it -
   * like the `form` attribute of a native field.
   */
  form?: string;
  /**
   * Stretches the bar over the full width - the options share it equally
   * in a horizontal bar, and fill it in a vertical one.
   */
  fullWidth?: boolean;
  /**
   * Id of the group element - the `<fieldset>` with `label`, otherwise the
   * `role="radiogroup"` element. The ids of the messages derive from it.
   */
  id?: string;
  /** Rendered as the `<legend>` of a fieldset above the bar. */
  label?: React.ReactNode;
  /**
   * `name` of the radios underneath - the form submits the picked value
   * under it. Without a `name` the control is not submitted.
   */
  name?: string;
  /** Called when an option loses the focus - also when it moves to another one. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Called with the value of the picked option. */
  onChange?: (value: T) => void;
  /** Called when an option gets the focus. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** The choices - a few short ones. */
  options: SegmentedControlOption<T>[];
  /**
   * `vertical` stacks the options - e.g. a view switcher in a side panel.
   * The arrow keys move through them either way.
   */
  orientation?: "horizontal" | "vertical";
  /**
   * The control shows the pick and takes the focus, but a click, Space or
   * an arrow key does not change it (`onChange` is not called) - the arrow
   * keys move the focus through the options. Unlike a disabled control,
   * the pick is submitted with the form. As a native read-only field, it is
   * not validated: `required` only marks it.
   */
  readOnly?: boolean;
  /** Ref to the group element (see `id`). */
  ref?: React.Ref<HTMLElement>;
  /** An option must be picked before the form can be submitted. */
  required?: boolean;
  /**
   * Deprecated - use `dim`.
   * @deprecated Use `dim`.
   */
  size?: "sm" | "md" | "lg";
  /** Picked value of a controlled control. */
  value?: T;
}

// The bar is as high as an Input: its padding and the options fill it -
// 22, 26, 34 and 46 px
const barSizeStyles: Record<Dim, string> = {
  xs: "p-0.5",
  sm: "p-0.5",
  md: "p-1",
  lg: "p-1.5",
};

const optionHeights: Record<Dim, string> = {
  xs: "h-4.5",
  sm: "h-5.5",
  md: "h-6.5",
  lg: "h-8.5",
};

const optionSizeStyles: Record<Dim, string> = {
  xs: "px-2 text-sm",
  sm: "px-2 text-sm",
  md: "px-3 text-base",
  lg: "px-4 text-lg",
};

// An icon alone - about as wide as the option is high
const iconOptionSizeStyles: Record<Dim, string> = {
  xs: "px-1 text-sm",
  sm: "px-1 text-sm",
  md: "px-1.5 text-base",
  lg: "px-2 text-lg",
};

interface IndicatorBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

/**
 * A compact choice of one of a few options - a view switcher, a period.
 * Radios underneath: one tab stop, the arrow keys move and pick, and the
 * form submits the picked value. The selection slides between the options
 * (at once for users who prefer reduced motion).
 */
export default function SegmentedControl<
  T extends string | number = string | number,
>({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  description,
  dim: dimProp,
  disabled = false,
  error,
  form,
  fullWidth = false,
  id,
  label,
  name,
  onBlur,
  onChange,
  onFocus,
  options,
  orientation = "horizontal",
  readOnly = false,
  ref,
  required,
  size,
  value: controlledValue,
  ...props
}: SegmentedControlProps<T>) {
  const dim = dimProp ?? size ?? "md";
  const vertical = orientation === "vertical";
  const messages = useMessages();
  const { fieldRef, handleChange, hasValue, value } =
    useFormControl<HTMLInputElement>({
      defaultValue,
      form,
      // The value of a radio is a string - the option has the original one
      onChange: (event) => {
        const option = options.find(
          (candidate) => String(candidate.value) === event.target.value,
        );
        if (option) onChange?.(option.value);
      },
      value: controlledValue,
    });

  // Without a name the options of two controls would form one radio group
  const generatedName = useId();
  const groupName = name ?? generatedName;
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const errorId = error ? `${groupId}-error` : undefined;
  const descriptionId = description ? `${groupId}-description` : undefined;

  const selectedIndex = options.findIndex(
    (option) => hasValue && String(option.value) === String(value),
  );

  // Where the indicator is - measured in the browser. Until then (on the
  // server, before hydration) the picked option has a background of its own.
  const [indicator, setIndicator] = useState<IndicatorBox | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const option =
      selectedIndex === -1
        ? undefined
        : bar?.querySelectorAll<HTMLElement>("[data-option]")[selectedIndex];

    if (!bar || !option) {
      setIndicator(null);
      return;
    }

    const measure = () => {
      const barRect = bar.getBoundingClientRect();
      const optionRect = option.getBoundingClientRect();
      // Also when the bar scrolls sideways on a narrow screen
      const next = {
        height: optionRect.height,
        left: optionRect.left - barRect.left - bar.clientLeft + bar.scrollLeft,
        top: optionRect.top - barRect.top - bar.clientTop + bar.scrollTop,
        width: optionRect.width,
      };

      setIndicator((previous) =>
        previous?.left === next.left &&
        previous.top === next.top &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
    };

    measure();

    // The options change size after the first measurement - a web font that
    // loads later, a label that changes, a container that narrows. Not in
    // every environment (jsdom) - measured once then.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(option);
    return () => observer.disconnect();
  }, [dim, options, orientation, selectedIndex]);

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
  // its data, as it leaves out radios without a name
  const wrapperRef = useOmitFormValue(
    name === undefined ? generatedName : undefined,
    form,
  );

  const bar = (
    <div
      className={cn(
        "relative max-w-full rounded-lg bg-neutral-100 dark:bg-neutral-800",
        vertical ? "flex-col" : "overflow-x-auto",
        fullWidth ? "flex w-full" : "inline-flex",
        barSizeStyles[dim],
        // A ring marks the error - a border would change the size. Forced
        // colors (Windows High Contrast) draw no ring - an outline then.
        error && "ring-1 ring-danger-500 forced-colors:outline-1",
        disabled && "opacity-60",
        // Also in a disabled fieldset around, which no prop tells
        "[fieldset:disabled_&]:opacity-60",
        className,
      )}
      data-readonly={readOnly ? "" : undefined}
      ref={barRef}
    >
      {indicator && (
        <div
          aria-hidden="true"
          // Forced colors draw no background of their own and no shadow -
          // the system's highlight color marks the picked option then
          className="absolute rounded-md bg-surface shadow-sm transition-all duration-200 ease-out motion-reduce:transition-none dark:bg-neutral-600 forced-colors:bg-[Highlight]"
          style={indicator}
        />
      )}
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        const optionDisabled = disabled || !!option.disabled;
        const iconOnly = option.label === undefined || option.label === null;
        const interactive = !optionDisabled && !readOnly;

        return (
          <label
            className={cn(
              // The ring of the keyboard focus is a shadow - forced colors
              // show the outline of `outline-hidden` instead
              "relative z-10 inline-flex items-center gap-1.5 rounded-md leading-none font-medium whitespace-nowrap transition-colors select-none has-focus-visible:ring-2 has-focus-visible:ring-primary-500 has-focus-visible:outline-hidden motion-reduce:transition-none",
              optionHeights[dim],
              iconOnly ? iconOptionSizeStyles[dim] : optionSizeStyles[dim],
              // A vertical bar lines the texts up at the start
              vertical ? "justify-start" : "justify-center",
              fullWidth && !vertical && "flex-1",
              checked
                ? "text-neutral-900 dark:text-white forced-colors:text-[HighlightText]"
                : "text-neutral-600 dark:text-neutral-300",
              !checked &&
                interactive &&
                "hover:text-neutral-900 has-disabled:hover:text-neutral-600 dark:hover:text-white dark:has-disabled:hover:text-neutral-300",
              // Until the indicator is measured
              checked &&
                !indicator &&
                "bg-surface shadow-sm dark:bg-neutral-600 forced-colors:bg-[Highlight]",
              optionDisabled
                ? "cursor-not-allowed"
                : readOnly
                  ? "cursor-default"
                  : "cursor-pointer",
              "has-disabled:cursor-not-allowed",
              // A disabled control is dimmed as a whole
              option.disabled && !disabled && "opacity-50",
            )}
            data-disabled={optionDisabled ? "" : undefined}
            data-option=""
            data-selected={checked ? "" : undefined}
            key={option.value}
            title={iconOnly ? option["aria-label"] : undefined}
          >
            <input
              aria-label={option["aria-label"]}
              checked={checked}
              className="sr-only"
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
                  ? (event) =>
                      moveReadOnlyRadioFocus(event, groupElement.current)
                  : undefined
              }
              ref={fieldRef}
              // A read-only field is not validated - it could not be fixed
              required={required && !readOnly}
              type="radio"
              value={String(option.value)}
            />
            {option.icon && (
              <span aria-hidden="true" className="inline-flex shrink-0">
                {option.icon}
              </span>
            )}
            {option.label}
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
    "aria-orientation": orientation,
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
    <div className="flex min-w-0 flex-col gap-1.5" ref={wrapperRef}>
      {label ? (
        // A fieldset is a `group`, which has no invalid or required state
        <fieldset {...groupProps} className="min-w-0">
          <legend className="mb-1.5 block text-sm font-medium">
            {label}
            {messages.form.labelSuffix}{" "}
            {/* The star is for the eye - `required` tells assistive technology */}
            {required && <RequiredMark />}
          </legend>
          {bar}
        </fieldset>
      ) : (
        <div
          {...groupProps}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="min-w-0"
        >
          {bar}
        </div>
      )}

      <FormDescription id={descriptionId}>{description}</FormDescription>
      <FormError id={errorId}>{error}</FormError>
    </div>
  );
}
