import { useId, useState } from "react";
import { flushSync } from "react-dom";
import cn from "../../../utils/cn";
import CalendarField from "../date-calendar/calendar-field";
import RangePanel from "../date-range-picker/range-panel";
import useCalendarField from "../date-calendar/use-calendar-field";
import useIsMobile from "../../../hooks/use-is-mobile";
import { getRangeMessage } from "../datetime-picker/parse";
import { formatMessage } from "../../../i18n/ui/format";
import { formatDate, parseISODate, toISODate } from "../../../utils/date";
import { useLocale } from "../../../providers/ui-context";
import {
  DEFAULT_PRESETS,
  encodeRange,
  findUnavailableDay,
  getRangeLengthMessage,
  toDateRange,
  toDayLimit,
  toDayRange,
  type RangeLimits,
} from "../date-range-picker/range";
import type { DateDisabledPredicate } from "../datetime-picker/availability";
import type {
  DateRange,
  DateRangePreset,
  DateRangePresetKey,
} from "../date-range-picker";

/**
 * The attributes of an HTML element not listed here - `data-*`, `style`,
 * `title`, event handlers - go to the group of the calendar, as `id`, `ref`
 * and `className` do.
 */
export interface RangeCalendarProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "children"
  | "dangerouslySetInnerHTML"
  | "defaultChecked"
  | "defaultValue"
  | "onChange"
> {
  /**
   * Id of the element describing the calendar - the error message and the
   * description describe it too.
   */
  "aria-describedby"?: string;
  /**
   * Accessible name of a calendar without `label` - "Select date range" by
   * default.
   */
  "aria-label"?: string;
  /** Id of the element naming a calendar without `label`. */
  "aria-labelledby"?: string;
  /**
   * A range may have days of `isDateDisabled` between its first and its
   * last day - e.g. weekends in a range of working days. By default a range
   * stops before the nearest disabled day.
   */
  allowDisabledInRange?: boolean;
  /** Classes of the box around the days. */
  className?: string;
  /** The range at first, and again after `form.reset()` - uncontrolled. */
  defaultValue?: DateRange | null;
  /** Help text under the calendar - it describes it. */
  description?: React.ReactNode;
  /**
   * Nothing can be focused or picked, and the range is not submitted. A
   * disabled `<fieldset>` around the calendar disables it too.
   */
  disabled?: boolean;
  /**
   * Name of a hidden input submitting the last day (`YYYY-MM-DD`, `""`
   * without a range) - see `startName`.
   */
  endName?: string;
  /** Validation message - also marks the calendar as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the hidden inputs belong to, when the calendar is
   * not inside it. A reset of that form resets the calendar too.
   */
  form?: string;
  /** Id of the group of the calendar - the ids of the messages derive from it. */
  id?: string;
  /**
   * Days that cannot be picked, e.g. booked days - called with the local
   * midnight of a day. They are struck through; the arrow keys move over
   * them, but they cannot start or end a range, nor lie in one (see
   * `allowDisabledInRange`). A range over such a day (a default one or one
   * of the parent) keeps the form from being submitted.
   */
  isDateDisabled?: DateDisabledPredicate;
  /** The label above the calendar - also its accessible name. */
  label?: React.ReactNode;
  /**
   * The latest day that can be picked, `YYYY-MM-DD` - a range ending after
   * it keeps the form from being submitted.
   */
  max?: string;
  /**
   * The most days a range may have - a week is 7 days. A longer value,
   * including a default or controlled one, keeps the form from being submitted.
   */
  maxDays?: number;
  /** The earliest day that can be picked, `YYYY-MM-DD` - see `max`. */
  min?: string;
  /**
   * The fewest days a range may have - e.g. 2 for at least one night.
   * A shorter value keeps the form from being submitted.
   */
  minDays?: number;
  /**
   * Months shown side by side - the arrow keys move on from one to the
   * next. One by default; two need about 34rem.
   */
  months?: 1 | 2;
  /**
   * Name of a hidden input submitting the range as one ISO 8601 interval -
   * `2026-09-24/2026-09-30`, `""` without one.
   */
  name?: string;
  /** The focus left the calendar - moving within it is no blur. */
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  /**
   * Called with the new range once its last day is picked - and the form
   * has it, so it may submit the form (`form.requestSubmit()`).
   */
  onChange?: (range: DateRange) => void;
  /** The focus entered the calendar - see `onBlur`. */
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  /**
   * Ranges offered beside the days (above them on phones) - as for
   * `DateRangePicker`: the keys of built-in ones and ranges of your own,
   * `true` for the default set.
   */
  presets?: boolean | (DateRangePresetKey | DateRangePreset)[];
  /**
   * The range is shown and submitted, and the days can be browsed - but
   * nothing picked. The grids are `aria-readonly`.
   */
  readOnly?: boolean;
  /** Ref to the group of the calendar - the element of `id`. */
  ref?: React.Ref<HTMLDivElement>;
  /** A range must be picked before the form can be submitted. */
  required?: boolean;
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
 * An always visible calendar of a from - to range for a form: the first
 * click (or Enter) picks the first day, the second the last - with the
 * range previewed in between - or a preset picks both. Escape drops a
 * range picked halfway. The value is `{ start, end }` in the `YYYY-MM-DD`
 * format, as of `DateRangePicker`.
 */
export default function RangeCalendar({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  allowDisabledInRange = false,
  className,
  defaultValue,
  description,
  disabled: disabledProp = false,
  endName,
  error,
  form,
  id,
  isDateDisabled,
  label,
  max,
  maxDays,
  min,
  minDays,
  months = 1,
  name,
  onBlur,
  onChange,
  onFocus,
  presets,
  readOnly = false,
  ref,
  required,
  startName,
  value,
  ...props
}: RangeCalendarProps) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const isMobile = useIsMobile();
  const generatedId = useId();
  const groupId = id ?? generatedId;

  // The range picked in an uncontrolled calendar - until then, and again
  // after a reset, it shows `defaultValue`
  const [entered, setEntered] = useState<DateRange>();
  const [resetCount, setResetCount] = useState(0);
  const isControlled = value !== undefined;
  // In order, and without the days that do not exist
  const range = toDayRange(
    isControlled ? value : (entered ?? defaultValue ?? null),
  );
  const days = range && toDateRange(range);

  const { disabled, wrapperRef } = useCalendarField({
    disabled: disabledProp,
    form,
    onReset: () => {
      setEntered(undefined);
      // A draft also resets when the committed range stays the same.
      setResetCount((count) => count + 1);
    },
  });

  const limits: RangeLimits = {
    allowDisabledInRange,
    isDateDisabled,
    max: parseISODate(max),
    maxDays: toDayLimit(maxDays),
    min: parseISODate(min),
    minDays: toDayLimit(minDays),
  };

  // A range reaching out of `min` / `max`, or over a disabled day, keeps
  // the form from being submitted
  const formatDay = (day: string) => {
    const date = parseISODate(day);
    return date ? formatDate(date, locale.formats.date) : day;
  };
  const minDay = limits.min ? toISODate(limits.min) : undefined;
  const maxDay = limits.max ? toISODate(limits.max) : undefined;
  const unavailableDay = range && findUnavailableDay(range, limits);
  const unavailableMessage = unavailableDay
    ? formatMessage(messages.dateRangePicker.unavailableInRange, {
        date: formatDate(unavailableDay, locale.formats.date),
      })
    : "";
  const validityMessage =
    getRangeMessage(
      messages.dateTimePicker,
      days?.start,
      { min: minDay },
      formatDay,
    ) ||
    getRangeMessage(
      messages.dateTimePicker,
      days?.end,
      { max: maxDay },
      formatDay,
    ) ||
    getRangeLengthMessage(
      range,
      limits,
      locale.formats.date,
      messages.dateTimePicker.outOfRangeText,
    ) ||
    unavailableMessage;

  return (
    <CalendarField
      ariaDescribedBy={ariaDescribedBy}
      ariaLabel={ariaLabel ?? messages.dateRangePicker.selectRange}
      ariaLabelledBy={ariaLabelledBy}
      className={cn("w-fit", className)}
      description={description}
      disabled={disabled}
      error={error}
      form={form}
      groupProps={props}
      hasValue={!!days}
      hiddenFields={[
        { name, value: encodeRange(days) },
        { name: startName, value: days?.start ?? "" },
        { name: endName, value: days?.end ?? "" },
      ]}
      id={groupId}
      label={label}
      onBlur={onBlur}
      onFocus={onFocus}
      readOnly={readOnly}
      ref={ref}
      required={required}
      validityMessage={validityMessage}
      wrapperRef={wrapperRef}
    >
      <RangePanel
        compact={isMobile}
        disabled={disabled}
        inline
        limits={limits}
        months={months}
        onPick={(picked) => {
          const next = toDateRange(picked);
          if (encodeRange(next) === encodeRange(days)) return;
          // The hidden inputs hold the range before `onChange`, which may
          // submit the form or read its `FormData`
          if (!isControlled) flushSync(() => setEntered(next));
          onChange?.(next);
        }}
        presets={presets === true ? DEFAULT_PRESETS : presets || []}
        readOnly={readOnly}
        resetCount={resetCount}
        value={range}
      />
    </CalendarField>
  );
}
