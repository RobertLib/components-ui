import { useId } from "react";
import cn from "../../utils/cn";
import DatePicker from "./date-picker";
import DateTimePanelPicker from "./date-time-picker";
import FormError from "../form-error";
import MonthPicker from "./month-picker";
import TimePicker from "./time-picker";
import WeekPicker from "./week-picker";
import { useFormControl } from "../../hooks/use-form-control";
import { useLocale } from "../../providers/ui-context";
import type { CustomPickerProps, PickerDim } from "./types";

export type DateTimePickerType =
  "date" | "time" | "datetime-local" | "month" | "week";

export interface DateTimePickerProps extends Omit<
  React.ComponentProps<"input">,
  "type"
> {
  /** Size of the field. */
  dim?: PickerDim;
  /** Validation message - also marks the field as invalid. */
  error?: string;
  label?: string;
  /**
   * `custom` (default) - the library's popup, formatted by the locale;
   * `native` - the browser's own `<input type="date">` & co.
   */
  mode?: "native" | "custom";
  /** Minutes offered by the time columns, e.g. 5 or 15. Default 1. */
  minuteStep?: number;
  /** Shorthand for `minuteStep={15}`. */
  quarterMinutesOnly?: boolean;
  /**
   * The value format is that of the native input: `YYYY-MM-DD` (date),
   * `HH:mm` (time), `YYYY-MM-DDTHH:mm` (datetime-local), `YYYY-MM` (month),
   * `YYYY-Www` (week).
   */
  type?: DateTimePickerType;
}

/**
 * Date, time, date-time, month and week picker. The value is always in the
 * format of the matching native input, whatever the display format - so it
 * can be sent to an API as it is. `onChange` gets an event-like object with
 * `target.name` and `target.value`, like a native input would.
 */
export default function DateTimePicker({
  className,
  defaultValue,
  dim = "md",
  error,
  id,
  label,
  max,
  min,
  minuteStep,
  mode = "custom",
  name,
  quarterMinutesOnly = false,
  required,
  type = "date",
  ...props
}: DateTimePickerProps) {
  const locale = useLocale();
  const { fieldRef, handleChange, value } = useFormControl({
    ...props,
    defaultValue,
  });

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  // Placeholder based on the display pattern of the locale
  const getPlaceholder = () => {
    if (props.placeholder) return props.placeholder;

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
      sm: "px-2 py-1 text-sm",
      md: "px-2 py-1 text-base",
      lg: "px-3 py-2 text-lg",
    };

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            className="block truncate text-sm font-medium"
            htmlFor={inputId}
          >
            {label}: {required && <span className="text-danger-500">*</span>}
          </label>
        )}

        <input
          {...props}
          className={cn(
            "form-control",
            dimStyles[dim],
            error && "border-danger-500! focus:ring-danger-300!",
            props.disabled && "cursor-not-allowed opacity-60",
            className,
          )}
          aria-describedby={errorId}
          aria-invalid={error ? "true" : undefined}
          aria-required={required ? "true" : undefined}
          id={inputId}
          max={max}
          min={min}
          name={name}
          onChange={handleChange}
          placeholder={getPlaceholder()}
          ref={fieldRef}
          required={required}
          type={type}
          value={value}
        />

        {error && <FormError id={errorId}>{error}</FormError>}
      </div>
    );
  }

  const pickerProps: CustomPickerProps = {
    ariaLabel: props["aria-label"],
    className,
    dim,
    disabled: props.disabled,
    error,
    errorId,
    fieldRef,
    inputId,
    label,
    max: max === undefined ? undefined : String(max),
    min: min === undefined ? undefined : String(min),
    minuteStep: minuteStep ?? (quarterMinutesOnly ? 15 : 1),
    name,
    onBlur: props.onBlur,
    onFocus: props.onFocus,
    onValueChange: (newValue) =>
      handleChange({
        target: { name, value: newValue },
      } as React.ChangeEvent<HTMLInputElement>),
    placeholder: getPlaceholder(),
    readOnly: props.readOnly,
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
