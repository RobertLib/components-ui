import { useId, useState } from "react";
import { flushSync } from "react-dom";
import cn from "../../../utils/cn";
import CalendarField from "./calendar-field";
import DayGrid from "../datetime-picker/day-grid";
import useCalendarField from "./use-calendar-field";
import { getRangeMessage } from "../datetime-picker/parse";
import { formatMessage, formatPlural } from "../../../i18n/ui/format";
import { formatDate, parseISODate, toISODate } from "../../../utils/date";
import { useLocale } from "../../../providers/ui-context";
import type { DateDisabledPredicate } from "../datetime-picker/availability";

/**
 * The attributes of an HTML element not listed here - `data-*`, `style`,
 * `title`, event handlers - go to the group of the calendar, as `id`, `ref`
 * and `className` do.
 */
interface DateCalendarBaseProps extends Omit<
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
  /** Accessible name of a calendar without `label` - "Select date" by default. */
  "aria-label"?: string;
  /** Id of the element naming a calendar without `label`. */
  "aria-labelledby"?: string;
  /** Classes of the box around the days - e.g. `w-full`, `border-0`. */
  className?: string;
  /** Help text under the calendar - it describes it. */
  description?: React.ReactNode;
  /**
   * Nothing can be focused or picked, and the value is not submitted. A
   * disabled `<fieldset>` around the calendar disables it too.
   */
  disabled?: boolean;
  /** Validation message - also marks the calendar as invalid. */
  error?: string;
  /**
   * Id of the `<form>` the hidden inputs belong to, when the calendar is
   * not inside it - like the `form` attribute of a native field. A reset of
   * that form resets the calendar too.
   */
  form?: string;
  /** Id of the group of the calendar - the ids of the messages derive from it. */
  id?: string;
  /**
   * Days that cannot be picked, e.g. weekends or booked days - called with
   * the start of a day: its local midnight, 1:00 of one whose midnight a
   * clock change skips. They are struck through; the arrow keys move over
   * them, but they cannot be picked. A value on such a day (a default one
   * or one of the parent) keeps the form from being submitted.
   */
  isDateDisabled?: DateDisabledPredicate;
  /** The label above the calendar - also its accessible name. */
  label?: React.ReactNode;
  /**
   * The latest day that can be picked, `YYYY-MM-DD` - the later ones are
   * disabled, and a later value keeps the form from being submitted.
   */
  max?: string;
  /** The earliest day that can be picked, `YYYY-MM-DD` - see `max`. */
  min?: string;
  /**
   * Submits the value in a hidden input of this name - `YYYY-MM-DD`, `""`
   * without one. With `multiple` an input for each day (none without
   * one): `formData.getAll(name)`.
   */
  name?: string;
  /** The focus left the calendar - moving within it is no blur. */
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  /** The focus entered the calendar - see `onBlur`. */
  onFocus?: React.FocusEventHandler<HTMLDivElement>;
  /**
   * The value is shown and submitted, and the days can be browsed - but
   * nothing picked. The grids are `aria-readonly`.
   */
  readOnly?: boolean;
  /** Ref to the group of the calendar - the element of `id`. */
  ref?: React.Ref<HTMLDivElement>;
  /** A day must be picked before the form can be submitted. */
  required?: boolean;
}

/** One day - `value`, `defaultValue` and `onChange` without `multiple`. */
interface SingleDateProps {
  /** The day at first, and after `form.reset()` - uncontrolled. `null` for none. */
  defaultValue?: string | null;
  /** Several days can be picked - a click adds or removes one. */
  multiple?: false;
  /**
   * Called with the picked day, `YYYY-MM-DD` - once the form has it, so it
   * may submit the form (`form.requestSubmit()`).
   */
  onChange?: (value: string) => void;
  /** The day, `YYYY-MM-DD` - controlled; `null` for none. */
  value?: string | null;
}

/** Several days - `value`, `defaultValue` and `onChange` with `multiple`. */
interface MultipleDatesProps {
  /** The days at first, and after `form.reset()` - uncontrolled. */
  defaultValue?: string[] | null;
  /** Several days can be picked - a click adds or removes one. */
  multiple: true;
  /**
   * Called with the picked days, `YYYY-MM-DD`, in order - once the form has
   * them, so it may submit the form (`form.requestSubmit()`).
   */
  onChange?: (values: string[]) => void;
  /** The days, `YYYY-MM-DD` - controlled. */
  value?: string[] | null;
}

export type DateCalendarProps = DateCalendarBaseProps &
  (SingleDateProps | MultipleDatesProps);

/** The days of a value, in order - without those that do not exist. */
function toDays(value: string | string[] | null | undefined) {
  const values = value === null || value === undefined ? [] : [value].flat();
  return values
    .map(parseISODate)
    .filter((day): day is Date => day !== null)
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * An always visible calendar for a form - a day, or several with
 * `multiple`, picked with the mouse or the keyboard (the arrow keys move
 * by a day and a week, Page Up / Down by a month, Home / End to the ends of
 * the week, Enter or Space picks). The value is in the `YYYY-MM-DD` format
 * of `<input type="date">`, so it can be sent to an API as it is.
 */
export default function DateCalendar({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  description,
  disabled: disabledProp = false,
  error,
  form,
  id,
  isDateDisabled,
  label,
  max,
  min,
  multiple = false,
  name,
  onBlur,
  onChange,
  onFocus,
  readOnly = false,
  ref,
  required,
  value,
  ...props
}: DateCalendarProps) {
  const locale = useLocale();
  const messages = locale.messages.ui;
  const generatedId = useId();
  const groupId = id ?? generatedId;

  // The days picked in an uncontrolled calendar - until then, and again
  // after a reset, it shows `defaultValue`
  const [entered, setEntered] = useState<string[]>();
  const isControlled = value !== undefined;
  const days = toDays(isControlled ? value : (entered ?? defaultValue));
  const keys = days.map(toISODate);
  const selectionKey = keys.join(",");

  // Keep the month of a local pick even when removing the first day. A
  // parent's replacement of the selection follows its first day instead.
  const [picked, setPicked] = useState<{
    day: string;
    selection: string;
    pendingSelection: string | null;
  } | null>(null);

  if (picked && (!multiple || picked.selection !== selectionKey)) {
    // A controlled parent may accept onChange on a later render. Consume
    // that expected change once, so it cannot mask a later replacement.
    setPicked(
      multiple && picked.pendingSelection === selectionKey
        ? { ...picked, pendingSelection: null, selection: selectionKey }
        : null,
    );
  }

  const { disabled, wrapperRef } = useCalendarField({
    disabled: disabledProp,
    form,
    onReset: () => {
      setEntered(undefined);
      setPicked(null);
    },
  });

  // The props are a union by `multiple` - `report` passes what it takes
  const report = onChange as ((value: string | string[]) => void) | undefined;

  // The hidden inputs hold the days before `onChange`, which may submit
  // the form or read its `FormData`
  const pick = (day: Date) => {
    const key = toISODate(day);
    if (!multiple) {
      if (keys[0] === key && keys.length === 1) return;
      if (!isControlled) flushSync(() => setEntered([key]));
      report?.(key);
      return;
    }

    const next = keys.includes(key)
      ? keys.filter((picked) => picked !== key)
      : [...keys, key].sort();
    flushSync(() => {
      setPicked({
        day: key,
        pendingSelection: next.join(","),
        selection: selectionKey,
      });
      if (!isControlled) setEntered(next);
    });
    report?.(next);
  };

  const formatValue = (day: string) => {
    const date = parseISODate(day);
    return date ? formatDate(date, locale.formats.date) : day;
  };

  // The days of `min` / `max` - the grid and the validity go by the same
  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);
  const minDay = minDate ? toISODate(minDate) : undefined;
  const maxDay = maxDate ? toISODate(maxDate) : undefined;

  // A day out of `min` / `max`, or a disabled one - of the parent or a
  // default one - keeps the form from being submitted
  const validityMessage =
    keys
      .map(
        (key, index) =>
          getRangeMessage(
            messages.dateTimePicker,
            key,
            { max: maxDay, min: minDay },
            formatValue,
          ) ||
          (isDateDisabled?.(days[index])
            ? formatMessage(messages.dateTimePicker.unavailable, {
                value: formatValue(key),
              })
            : ""),
      )
      .find(Boolean) ?? "";

  const hiddenFields = multiple
    ? keys.map((key) => ({ name, value: key }))
    : [{ name, value: keys[0] ?? "" }];

  return (
    <CalendarField
      ariaDescribedBy={ariaDescribedBy}
      ariaLabel={ariaLabel ?? messages.dateTimePicker.selectDate}
      ariaLabelledBy={ariaLabelledBy}
      className={cn("w-72", className)}
      description={description}
      disabled={disabled}
      error={error}
      form={form}
      groupProps={props}
      hasValue={keys.length > 0}
      hiddenFields={hiddenFields}
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
      <DayGrid
        disabled={disabled}
        inline
        isDateDisabled={isDateDisabled}
        max={maxDate}
        min={minDate}
        onSelect={pick}
        readOnly={readOnly}
        selected={
          multiple && picked ? parseISODate(picked.day) : (days[0] ?? null)
        }
        selection={multiple ? days : undefined}
      />

      {multiple && (
        <div
          // Announced as a day is added or removed
          aria-live="polite"
          className="mt-2 border-t border-neutral-200 pt-2 text-xs text-neutral-600 tabular-nums dark:border-neutral-700 dark:text-neutral-400"
        >
          {formatPlural(
            locale.code,
            messages.dateCalendar.selectedDays,
            keys.length,
          )}
        </div>
      )}
    </CalendarField>
  );
}
