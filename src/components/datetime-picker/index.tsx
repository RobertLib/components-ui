import { useId } from "react";
import cn from "../../utils/cn";
import DatePicker from "./date-picker";
import DateTimePanelPicker from "./date-time-picker";
import FormDescription from "../form-description";
import FormError from "../form-error";
import MonthPicker from "./month-picker";
import TimePicker from "./time-picker";
import WeekPicker from "./week-picker";
import { useFormControl } from "../../hooks/use-form-control";
import { useLocale } from "../../providers/ui-context";
import type { CustomPickerProps } from "./types";

export type DateTimePickerType =
  "date" | "time" | "datetime-local" | "month" | "week";

/** `target` and `currentTarget` of a `DateTimePickerChangeEvent`. */
export interface DateTimePickerChangeTarget {
  /** The `name` of the picker - `""` without one. */
  name: string;
  /** The new value in the format of the native input - `""` when cleared. */
  value: string;
}

/**
 * What `onChange` gets: the picker's `name` and new value in `target` (and
 * `currentTarget`), like from a native input - so `event.target.value`
 * works, and so do form libraries that read it (React Hook Form's
 * `register()` and `Controller`, Formik's `handleChange`). No DOM element
 * or DOM event stands behind it. In `native` mode it is the input's own
 * change event.
 */
export interface DateTimePickerChangeEvent {
  /** The same as `target`. */
  currentTarget: DateTimePickerChangeTarget;
  /** Does nothing - a picked value has no default action to prevent. */
  preventDefault: () => void;
  /** Does nothing - the event does not bubble. */
  stopPropagation: () => void;
  /** The picker's `name` and new value. */
  target: DateTimePickerChangeTarget;
  /** `"change"` */
  type: string;
}

export interface DateTimePickerProps extends Omit<
  React.ComponentProps<"input">,
  "onChange" | "type"
> {
  /**
   * Whether the custom field has a clear button - by default when it is not
   * `required`, like the native date inputs.
   */
  clearable?: boolean;
  /**
   * Help text under the field, e.g. what may be picked - the field is
   * described by it (after the error message).
   */
  description?: React.ReactNode;
  /** Size of the field. */
  dim?: "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /** Text of the label above the field - also its accessible name. */
  label?: string;
  /**
   * `custom` (default) - the library's popup, formatted by the locale;
   * `native` - the browser's own `<input type="date">` & co.
   */
  mode?: "native" | "custom";
  /**
   * Minutes offered by the time columns, e.g. 5 or 15 - a picked, typed or
   * clamped time is moved onto the nearest of them: for `datetime-local`
   * also the midnight of the next day (23:58 → 00:00 with 5), for `time`
   * one of the same day (23:58 → 23:55). Default 1. The step of the native
   * input in `native` mode.
   */
  minuteStep?: number;
  /**
   * The focus left the picker. Its field, clear button and popup count as
   * one - the focus moving between them is no blur. `event.target` is the
   * field.
   */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  // A method, so that handlers typed for native change events are accepted
  // too - React types its own event handlers the same way
  /**
   * Called with the new value in `event.target.value` (see
   * `DateTimePickerChangeEvent`).
   */
  onChange?(event: DateTimePickerChangeEvent): void;
  /** The focus entered the picker - see `onBlur`. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Shorthand for `minuteStep={15}`. */
  quarterMinutesOnly?: boolean;
  /**
   * The visible text field - e.g. for `focus()`. Its `value` is the text it
   * shows (`24.09.2026`); the value itself comes with `onChange` and, with a
   * `name`, in a hidden input. In `native` mode the native input.
   */
  ref?: React.Ref<HTMLInputElement>;
  /**
   * The value format is that of the native input: `YYYY-MM-DD` (date),
   * `HH:mm` (time), `YYYY-MM-DDTHH:mm` (datetime-local), `YYYY-MM` (month),
   * `YYYY-Www` (week).
   */
  type?: DateTimePickerType;
}

/** A whole number of minutes from 1 to 60. */
const toMinuteStep = (step: number) =>
  Number.isFinite(step) ? Math.min(60, Math.max(1, Math.round(step))) : 1;

/**
 * Date, time, date-time, month and week picker. The value is always in the
 * format of the matching native input, whatever the display format - so it
 * can be sent to an API as it is. It can be typed in the display format of
 * the locale, also with the year left out (the current one) or of two digits
 * (`24.9.26`). `onChange` gets an event-like object with `target.name` and
 * `target.value`, like a native input would.
 */
export default function DateTimePicker({
  "aria-label": ariaLabel,
  className,
  clearable,
  defaultValue,
  description,
  dim = "md",
  disabled,
  error,
  id,
  label,
  max,
  min,
  minuteStep,
  mode = "custom",
  name,
  onBlur,
  onChange,
  onFocus,
  placeholder,
  quarterMinutesOnly = false,
  readOnly,
  ref,
  required,
  step,
  type = "date",
  value: valueProp,
  ...inputProps
}: DateTimePickerProps) {
  const locale = useLocale();
  const { fieldRef, handleChange, value } = useFormControl({
    defaultValue,
    onChange,
    ref,
    value: valueProp,
  });

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const pickerMinuteStep = toMinuteStep(
    minuteStep ?? (quarterMinutesOnly ? 15 : 1),
  );

  // Placeholder based on the display pattern of the locale
  const getPlaceholder = () => {
    if (placeholder) return placeholder;

    const pattern = {
      date: locale.formats.date,
      "datetime-local": locale.formats.dateTime,
      month: locale.formats.month,
      time: locale.formats.time,
      week: locale.formats.week,
    }[type];

    // "[W]WW.YYYY" -> "WW.YYYY"
    return pattern.replace(/\[[^\]]*]/g, "");
  };

  if (mode === "native") {
    const dimStyles = {
      sm: "px-1 py-0 text-sm",
      md: "px-2 py-1 text-base",
      lg: "px-3 py-2 text-lg",
    };
    // The step of a time is in seconds
    const minuteStepSeconds =
      (type === "time" || type === "datetime-local") && pickerMinuteStep > 1
        ? pickerMinuteStep * 60
        : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            className="block truncate text-sm font-medium"
            htmlFor={inputId}
          >
            {label}
            {locale.messages.form.labelSuffix}{" "}
            {required && (
              <span
                aria-hidden="true"
                className="text-danger-700 dark:text-danger-400"
              >
                *
              </span>
            )}
          </label>
        )}

        <input
          {...inputProps}
          className={cn(
            "form-control",
            dimStyles[dim],
            error && "border-danger-500! focus:ring-danger-500!",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
          aria-describedby={cn(
            errorId,
            descriptionId,
            inputProps["aria-describedby"],
          )}
          aria-invalid={error ? "true" : undefined}
          aria-label={ariaLabel}
          aria-required={required ? "true" : undefined}
          disabled={disabled}
          id={inputId}
          max={max}
          min={min}
          name={name}
          onBlur={onBlur}
          onChange={handleChange}
          onFocus={onFocus}
          placeholder={getPlaceholder()}
          readOnly={readOnly}
          ref={fieldRef}
          required={required}
          step={step ?? minuteStepSeconds}
          type={type}
          value={value}
        />

        <FormDescription id={descriptionId}>{description}</FormDescription>
        {error && <FormError id={errorId}>{error}</FormError>}
      </div>
    );
  }

  const pickerProps: CustomPickerProps = {
    ariaLabel,
    className,
    clearable,
    description,
    descriptionId,
    dim,
    disabled,
    error,
    errorId,
    fieldRef,
    inputId,
    inputProps,
    label,
    max: max === undefined ? undefined : String(max),
    min: min === undefined ? undefined : String(min),
    minuteStep: pickerMinuteStep,
    name,
    onBlur,
    onFocus,
    onValueChange: (newValue) => {
      const target = { name: name ?? "", value: newValue };
      const event: DateTimePickerChangeEvent = {
        currentTarget: target,
        preventDefault: () => {},
        stopPropagation: () => {},
        target,
        type: "change",
      };
      // The form control reads just `target.value` of it
      handleChange(event as unknown as React.ChangeEvent<HTMLInputElement>);
    },
    placeholder: getPlaceholder(),
    readOnly,
    required,
    value: String(value ?? ""),
  };

  switch (type) {
    case "time":
      return <TimePicker {...pickerProps} />;
    case "datetime-local":
      return <DateTimePanelPicker {...pickerProps} />;
    case "month":
      return <MonthPicker {...pickerProps} />;
    case "week":
      return <WeekPicker {...pickerProps} />;
    case "date":
    default:
      return <DatePicker {...pickerProps} />;
  }
}
