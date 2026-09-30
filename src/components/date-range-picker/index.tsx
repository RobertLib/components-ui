import { useId } from "react";
import PickerField from "../datetime-picker/picker-field";
import RangePanel from "./range-panel";
import { getRangeMessage, parseDisplayRange } from "../datetime-picker/parse";
import usePickerPopup from "../datetime-picker/use-picker-popup";
import useIsMobile from "../../hooks/use-is-mobile";
import { useFormControl } from "../../hooks/use-form-control";
import { formatMessage } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";
import {
  formatDate,
  formatPlaceholder,
  parseISODate,
  toISODate,
} from "../../utils/date";
import {
  decodeRange,
  DEFAULT_PRESETS,
  encodeRange,
  findUnavailableDay,
  formatRange,
  getRangeLengthMessage,
  isAllowedRange,
  RANGE_SEPARATOR,
  toDateRange,
  toDayLimit,
  toDayRange,
  type RangeLimits,
} from "./range";
import type { DateDisabledPredicate } from "../datetime-picker/availability";
import type { DayRange } from "../datetime-picker/day-grid";

/** A range of days - both in the `YYYY-MM-DD` format of `<input type="date">`. */
export interface DateRange {
  /** The last day - part of the range. */
  end: string;
  /** The first day. */
  start: string;
}

/**
 * A built-in preset: `today`, `yesterday`, `last7Days` and `last30Days`
 * (ending today), `thisWeek` / `lastWeek` (from the first day of the week of
 * the locale), `thisMonth` / `lastMonth` and `thisYear` / `lastYear` - the
 * whole periods, cut to `min` / `max`.
 */
export type DateRangePresetKey =
  | "today"
  | "yesterday"
  | "last7Days"
  | "last30Days"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear";

/** A preset of your own, e.g. a quarter. */
export interface DateRangePreset {
  /** Text of the button. */
  label: string;
  /** The range the button picks - cut to `min` / `max`. */
  range: DateRange;
}

export interface DateRangePickerProps extends Omit<
  React.ComponentProps<"input">,
  | "defaultValue"
  | "max"
  | "min"
  | "onBlur"
  | "onChange"
  | "onFocus"
  | "step"
  | "type"
  | "value"
> {
  /**
   * A range may have days of `isDateDisabled` between its first and its
   * last day - e.g. weekends in a range of working days. Its first and last
   * day can never be disabled ones. By default a range stops before the
   * nearest disabled day, like a booking before a booked night.
   */
  allowDisabledInRange?: boolean;
  /**
   * Whether the field has a clear button - by default when it is not
   * `required`.
   */
  clearable?: boolean;
  /** The range at first, and again after `form.reset()` - uncontrolled. */
  defaultValue?: DateRange | null;
  /**
   * Help text under the field, e.g. what may be picked - the field is
   * described by it (after the error message).
   */
  description?: React.ReactNode;
  /** Size of the field - the heights of `Input`. */
  dim?: "xs" | "sm" | "md" | "lg";
  /**
   * Name of a hidden input submitting the last day (`YYYY-MM-DD`, `""`
   * without a range) - see `startName`.
   */
  endName?: string;
  /** Validation message - also marks the field as invalid. */
  error?: string;
  /**
   * Days that cannot be picked, e.g. booked days - called with the local
   * midnight of a day. The calendar shows them struck through; the keys
   * move over them, but they cannot start or end a range, nor lie in one
   * (see `allowDisabledInRange`). A range over such a day - typed, a
   * default one or one of the parent - makes the field invalid (a submit
   * is blocked, the browser says `messages.dateRangePicker.unavailableInRange`).
   */
  isDateDisabled?: DateDisabledPredicate;
  /** The label above the field - also its accessible name. */
  label?: React.ReactNode;
  /**
   * The latest day that can be picked, `YYYY-MM-DD` - a range ending after
   * it makes the field invalid, like a native input (a submit is blocked).
   */
  max?: string;
  /**
   * The most days a range may have - a week is 7 days. A longer value,
   * including a default or controlled one, keeps the form from being submitted.
   */
  maxDays?: number;
  /**
   * The earliest day that can be picked, `YYYY-MM-DD` - a range starting
   * before it makes the field invalid, like a native input.
   */
  min?: string;
  /**
   * The fewest days a range may have - e.g. 2 for a stay of at least one
   * night. A shorter value keeps the form from being submitted.
   */
  minDays?: number;
  /**
   * Name of a hidden input submitting the range as one ISO 8601 interval -
   * `2026-09-24/2026-09-30`, `""` without one. `startName` / `endName`
   * submit the days separately.
   */
  name?: string;
  /**
   * The focus left the picker. Its field, clear button and popup count as
   * one - the focus moving between them is no blur. `event.target` is the
   * field.
   */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Called with the new range - `null` when cleared. */
  onChange?: (range: DateRange | null) => void;
  /** The focus entered the picker - see `onBlur`. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /**
   * Ranges offered next to the calendar - built-in ones by their key (see
   * `DateRangePresetKey`) and your own. `true` offers today, yesterday,
   * the last 7 and 30 days, this month and last month. A preset is cut to
   * [`min`, `max`] and to days that are not disabled at its ends; one with
   * no day left, not as long as `minDays` / `maxDays` allow, or over a
   * disabled day, is disabled.
   */
  presets?: boolean | (DateRangePresetKey | DateRangePreset)[];
  /**
   * The visible text field - e.g. for `focus()`. Its `value` is the text it
   * shows (`24.09.2026 – 30.09.2026`); the range itself comes with
   * `onChange` and, with the names, in hidden inputs.
   */
  ref?: React.Ref<HTMLInputElement>;
  /**
   * Name of a hidden input submitting the first day (`YYYY-MM-DD`, `""`
   * without a range) - with `endName`, a form submits e.g.
   * `from=2026-09-24&to=2026-09-30`.
   */
  startName?: string;
  /** The range - controlled; `null` for none. */
  value?: DateRange | null;
}

/**
 * A from - to range of days: typed into the field in the date format of the
 * locale (`24.09.2026 – 30.09.2026`, also with the years left out or of two
 * digits, or the month written once: `24.–30.9.`), or picked in a calendar of
 * two months (one on phones) - the first click picks the first day, the
 * second the last, with the range previewed in between - or by a preset. The value is `{ start, end }` in the
 * `YYYY-MM-DD` format, so it can be sent to an API as it is.
 */
export default function DateRangePicker({
  "aria-label": ariaLabel,
  allowDisabledInRange = false,
  className,
  clearable,
  defaultValue,
  description,
  dim = "md",
  disabled,
  endName,
  error,
  id,
  isDateDisabled,
  label,
  max,
  maxDays,
  min,
  minDays,
  name,
  onBlur,
  onChange,
  onFocus,
  placeholder,
  presets,
  readOnly,
  ref,
  required,
  startName,
  value: valueProp,
  ...inputProps
}: DateRangePickerProps) {
  const locale = useLocale();
  const messages = locale.messages.dateRangePicker;
  const isMobile = useIsMobile();

  // The range as one string - `start/end` - which the form control and the
  // field of the pickers work with
  const { fieldRef, handleChange, value } = useFormControl({
    defaultValue: encodeRange(defaultValue),
    form: inputProps.form,
    onChange: (event) => onChange?.(decodeRange(event.target.value)),
    ref,
    value: valueProp === undefined ? undefined : encodeRange(valueProp),
  });
  const {
    close,
    contentRef,
    inputRef,
    isOpen,
    markPicked,
    onOpenChange,
    openedByKeyboard,
    pickCount,
  } = usePickerPopup(!disabled && !readOnly);

  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;

  const pattern = locale.formats.date;
  // In order, and without the days that do not exist
  const range = toDayRange(decodeRange(String(value)));
  const days = range && toDateRange(range);
  const fieldValue = encodeRange(days);
  const limits: RangeLimits = {
    allowDisabledInRange,
    isDateDisabled,
    max: parseISODate(max),
    maxDays: toDayLimit(maxDays),
    min: parseISODate(min),
    minDays: toDayLimit(minDays),
  };

  const changeValue = (newValue: string) => {
    // The form control reads just `target.value` of it
    handleChange({
      target: { value: newValue },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const pickRange = (picked: DayRange) => {
    markPicked();
    const newValue = encodeRange(toDateRange(picked));
    if (newValue !== fieldValue) changeValue(newValue);
    close();
  };

  // "DD.MM.RRRR – DD.MM.RRRR" - as the locale writes the tokens
  const datePlaceholder = formatPlaceholder(
    pattern,
    locale.messages.dateTimePicker.placeholderTokens,
  );
  const rangePlaceholder = `${datePlaceholder}${RANGE_SEPARATOR}${datePlaceholder}`;

  // A range reaching out of `min` / `max` makes the form invalid, like a
  // native date input - its first day before `min`, or its last after `max`
  const dayLimit = (day: Date | null) => (day ? toISODate(day) : undefined);
  const formatDay = (day: string) => {
    const date = parseISODate(day);
    return date ? formatDate(date, pattern) : day;
  };
  // So does a range over a disabled day - one typed too, which is kept
  const getUnavailableMessage = (range: DayRange | null) => {
    const unavailableDay = range && findUnavailableDay(range, limits);
    return unavailableDay
      ? formatMessage(messages.unavailableInRange, {
          date: formatDate(unavailableDay, pattern),
        })
      : "";
  };
  const validityMessage =
    getRangeMessage(
      locale.messages.dateTimePicker,
      days?.start,
      { min: dayLimit(limits.min) },
      formatDay,
    ) ||
    getRangeMessage(
      locale.messages.dateTimePicker,
      days?.end,
      { max: dayLimit(limits.max) },
      formatDay,
    ) ||
    getRangeLengthMessage(
      range,
      limits,
      pattern,
      locale.messages.dateTimePicker.outOfRangeText,
    ) ||
    getUnavailableMessage(range);

  return (
    <PickerField
      ariaLabel={ariaLabel ?? messages.selectRange}
      className={className}
      clearable={clearable}
      contentRef={contentRef}
      description={description}
      descriptionId={descriptionId}
      dim={dim}
      disabled={disabled}
      displayValue={range ? formatRange(range, pattern) : ""}
      error={error}
      errorId={errorId}
      fieldRef={fieldRef}
      format={rangePlaceholder}
      hiddenFields={[
        { name: startName, value: (value) => decodeRange(value)?.start ?? "" },
        { name: endName, value: (value) => decodeRange(value)?.end ?? "" },
      ]}
      icon="calendar"
      inputId={inputId}
      inputProps={inputProps}
      inputRef={inputRef}
      isOpen={isOpen}
      label={label}
      name={name}
      onBlur={onBlur}
      onClear={() => changeValue("")}
      onFocus={onFocus}
      onOpenChange={onOpenChange}
      onValueChange={changeValue}
      // One month on phones - the width of the date popup
      panelClassName={isMobile ? "w-72" : undefined}
      parseText={(text) => {
        const typed = toDayRange(parseDisplayRange(text, pattern));
        if (!typed) return { error: "format" };
        return isAllowedRange(typed, limits)
          ? {
              value: encodeRange(toDateRange(typed)),
              validityMessage: getUnavailableMessage(typed),
            }
          : { error: "range" };
      }}
      pickCount={pickCount}
      placeholder={placeholder ?? rangePlaceholder}
      popupLabel={messages.selectRange}
      readOnly={readOnly}
      required={required}
      validityMessage={validityMessage}
      value={fieldValue}
    >
      <RangePanel
        autoFocus={openedByKeyboard}
        compact={isMobile}
        limits={limits}
        months={isMobile ? 1 : 2}
        onEscape={close}
        onPick={pickRange}
        presets={presets === true ? DEFAULT_PRESETS : presets || []}
        value={range}
      />
    </PickerField>
  );
}
