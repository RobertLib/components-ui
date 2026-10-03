import { useCallback, useId, useRef } from "react";
import useCustomValidity from "../../../hooks/use-custom-validity";
import cn, { joinTokens } from "../../../utils/cn";
import DatePicker from "./date-picker";
import DateTimePanelPicker from "./date-time-picker";
import FormDescription from "../form-description";
import FormError from "../form-error";
import hasLabel from "./has-label";
import MonthPicker from "./month-picker";
import TimePicker from "./time-picker";
import WeekPicker from "./week-picker";
import { isValueUnavailable, type DateDisabledPredicate } from "./availability";
import { parseTime, sanitizePickerLimit, sanitizePickerValue } from "./parse";
import { isAriaInvalid, useFormControl } from "../../../hooks/use-form-control";
import { formatMessage } from "../../../i18n/format";
import {
  formatDate,
  formatPattern,
  formatPlaceholder,
  getDayPeriods,
  parseISODate,
} from "../../../utils/date";
import { useLocale } from "../../../providers/ui-context";
import type { CustomPickerProps, DateTimePickerPreset } from "./types";
import type { Locale } from "../../../i18n/types";
import RequiredMark from "../required-mark";

export type { DateTimePickerPreset } from "./types";

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
 * works, and so do form libraries that read it (the `onChange` of React Hook
 * Form's `register()` and `Controller`, Formik's `handleChange`). No DOM
 * element or DOM event stands behind it. In `native` mode it is the input's
 * own change event.
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
  /** Size of the field - the heights of `Input`. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /**
   * Days that cannot be picked, e.g. weekends or booked days - called with
   * the local midnight of a day. The popup shows them struck through; the
   * keys move over them, but they cannot be picked. A month or a week
   * without another day cannot be picked either. A value on such a day -
   * typed, a default one or one of the parent - makes the field invalid (a
   * submit is blocked, the browser says `messages.dateTimePicker.unavailable`),
   * also in `native` mode, whose popup offers every day. Not for `time`.
   */
  isDateDisabled?: DateDisabledPredicate;
  /** The label above the field - also its accessible name. */
  label?: React.ReactNode;
  /**
   * The latest value, in the value format (see `type`) - the popup offers
   * nothing after it, and a later value makes the field invalid, like a
   * native input (a submit is blocked).
   */
  max?: number | string;
  /**
   * The earliest value, in the value format - see `max`. A time range whose
   * `min` comes after its `max` (`22:00` - `06:00`) spans midnight.
   */
  min?: number | string;
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
  /**
   * `type="date"`: the Today button (and Clear, when the value is not
   * `required` or `clearable` allows it) under the days of the popup.
   * Today is disabled when it cannot be picked. Default `true`.
   */
  popupActions?: boolean;
  /**
   * `type="date"`: days offered next to the calendar (above it on phones),
   * e.g. `{ label: "In a week", value: "2026-10-06" }` - a click picks the
   * day. A preset out of `min` / `max` or on a disabled day is disabled,
   * the preset of the value marked.
   */
  presets?: DateTimePickerPreset[];
  /** Shorthand for `minuteStep={15}`. */
  quarterMinutesOnly?: boolean;
  /**
   * The `step` of the native input, only in `native` mode (in seconds for a
   * time) - it overrides `minuteStep` there. The custom pickers leave it
   * out: their minutes come from `minuteStep`.
   */
  step?: number | string;
  /**
   * The visible text field - e.g. for `focus()`. Its `value` is the text it
   * shows (`24.09.2026`); the value itself comes with `onChange` and, with a
   * `name`, in a hidden input. In `native` mode the native input.
   */
  ref?: React.Ref<HTMLInputElement>;
  /**
   * The value format is that of the native input: `YYYY-MM-DD` (date),
   * `HH:mm` (time), `YYYY-MM-DDTHH:mm` (datetime-local), `YYYY-MM` (month),
   * `YYYY-Www` (week). Malformed `value` / `defaultValue` is shown and
   * submitted as empty, like a native input, so `required` blocks it.
   */
  type?: DateTimePickerType;
}

/** The display pattern of the locale for a type of picker. */
const getPattern = (locale: Locale, type: DateTimePickerType) =>
  ({
    date: locale.formats.date,
    "datetime-local": locale.formats.dateTime,
    month: locale.formats.month,
    time: locale.formats.time,
    week: locale.formats.week,
  })[type];

/** A whole number of minutes from 1 to 60. */
const toMinuteStep = (step: number) =>
  Number.isFinite(step) ? Math.min(60, Math.max(1, Math.round(step))) : 1;

// The sizes of `Input`
const nativeDimStyles = {
  xs: "px-1 py-0 text-sm",
  sm: "px-1 py-0.5 text-sm",
  md: "px-2 py-1 text-base",
  lg: "px-3 py-2 text-lg",
};

/** A value of a picker of `type` in the display format of the locale. */
function formatValue(value: string, type: DateTimePickerType, locale: Locale) {
  const [, year = 0, month = 0, day = 0] =
    /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value)?.map(Number) ?? [];

  switch (type) {
    case "date": {
      const date = parseISODate(value);
      return date ? formatDate(date, locale.formats.date) : value;
    }
    case "datetime-local": {
      const time = parseTime(value.slice(11));
      return formatPattern(
        locale.formats.dateTime,
        {
          day,
          hours: Number(time?.hours ?? 0),
          minutes: Number(time?.minutes ?? 0),
          month,
          year,
        },
        getDayPeriods(locale.code),
      );
    }
    case "month":
      return formatPattern(locale.formats.month, { month, year });
    case "week":
      return formatPattern(locale.formats.week, {
        week: Number(value.slice(6)),
        year: Number(value.slice(0, 4)),
      });
    default:
      return value;
  }
}

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
  isDateDisabled,
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
  popupActions = true,
  presets,
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
    // A value a script writes into the native input stays - `register()`.
    // The custom pickers' `fieldRef` is on a field showing formatted text.
    followScriptWrites: mode === "native",
    form: inputProps.form,
    onChange,
    ref,
    value: valueProp,
  });

  // The native input - which says itself when the value is out of `min` /
  // `max`, but not when it is a disabled day
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const nativeInputRef = useCallback(
    (element: HTMLInputElement | null) => {
      nativeRef.current = element;
      const detach = fieldRef(element);
      return () => {
        nativeRef.current = null;
        detach();
      };
    },
    [fieldRef],
  );
  const nativeMessage =
    mode === "native" &&
    isValueUnavailable(String(value ?? ""), type, isDateDisabled)
      ? formatMessage(locale.messages.dateTimePicker.unavailable, {
          value: formatValue(String(value), type, locale),
        })
      : "";
  useCustomValidity(nativeRef, nativeMessage);

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const pickerMinuteStep = toMinuteStep(
    minuteStep ?? (quarterMinutesOnly ? 15 : 1),
  );

  // Placeholder based on the display pattern of the locale - "DD.MM.RRRR"
  const getPlaceholder = () =>
    placeholder ||
    formatPlaceholder(
      getPattern(locale, type),
      locale.messages.dateTimePicker.placeholderTokens,
    );

  if (mode === "native") {
    // The step of a time is in seconds
    const minuteStepSeconds =
      (type === "time" || type === "datetime-local") && pickerMinuteStep > 1
        ? pickerMinuteStep * 60
        : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {hasLabel(label) && (
          <label
            className="block truncate text-sm font-medium"
            htmlFor={inputId}
          >
            {label}
            {locale.messages.form.labelSuffix} {required && <RequiredMark />}
          </label>
        )}

        <input
          {...inputProps}
          className={cn(
            "form-control",
            nativeDimStyles[dim],
            // Forced colors (Windows High Contrast) draw every border in
            // one color - an outline makes the border of an invalid field
            // thicker
            error &&
              "border-danger-500! focus:ring-danger-500! forced-colors:outline-1",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
          aria-describedby={joinTokens(
            errorId,
            descriptionId,
            inputProps["aria-describedby"],
          )}
          aria-invalid={error ? "true" : inputProps["aria-invalid"]}
          aria-label={ariaLabel}
          aria-required={required ? "true" : undefined}
          data-disabled={disabled ? "" : undefined}
          // Also a disabled day - the browser refuses to submit it
          data-invalid={
            error || nativeMessage || isAriaInvalid(inputProps["aria-invalid"])
              ? ""
              : undefined
          }
          data-readonly={readOnly ? "" : undefined}
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
          ref={nativeInputRef}
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
    isDateDisabled,
    label,
    max: sanitizePickerLimit(max === undefined ? undefined : String(max), type),
    min: sanitizePickerLimit(min === undefined ? undefined : String(min), type),
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
    popupActions,
    presets,
    readOnly,
    required,
    sourceValue: String(value ?? ""),
    value: sanitizePickerValue(String(value ?? ""), type),
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
