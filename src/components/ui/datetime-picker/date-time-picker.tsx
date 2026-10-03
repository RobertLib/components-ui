import DayGrid from "./day-grid";
import PickerField from "./picker-field";
import TimeLists from "./time-lists";
import {
  clampValue,
  getRangeMessage,
  isInRange,
  normalizeDateTime,
  parseDisplayValue,
  parseTime,
  snapDateTime,
} from "./parse";
import usePickerPopup from "./use-picker-popup";
import { findEnabledDay } from "./availability";
import useToday from "../../../hooks/use-today";
import { formatMessage } from "../../../i18n/format";
import {
  formatPattern,
  formatPlaceholder,
  getDayPeriods,
  parseISODate,
  startOfDay,
  toISODate,
  usesHour12,
} from "../../../utils/date";
import { useLocale } from "../../../providers/ui-context";
import type { CustomPickerProps } from "./types";

/** `type="datetime-local"` - value `YYYY-MM-DDTHH:mm`. */
export default function DateTimePanelPicker({
  isDateDisabled,
  max,
  min,
  minuteStep,
  onValueChange,
  placeholder,
  // Of the date popup only
  popupActions: _popupActions,
  presets: _presets,
  value,
  ...props
}: CustomPickerProps) {
  const locale = useLocale();
  const messages = locale.messages.dateTimePicker;
  const {
    close,
    contentRef,
    inputRef,
    isOpen,
    markPicked,
    onOpenChange,
    openedByKeyboard,
    pickCount,
  } = usePickerPopup(!props.disabled && !props.readOnly);

  const dayPeriods = getDayPeriods(locale.code);
  const [datePart = "", timePart = ""] = (value || "").split("T");
  const selectedDate = parseISODate(datePart);
  const time = parseTime(timePart);
  // A picked day without a time yet - its first minute
  const hours = time?.hours ?? "00";
  const minutes = time?.minutes ?? "00";

  // A limit without a time allows its whole day, one with seconds is
  // rounded into the range
  const minValue = normalizeDateTime(min, "min");
  const maxValue = normalizeDateTime(max, "max");
  const minDay = minValue?.slice(0, 10);
  const maxDay = maxValue?.slice(0, 10);

  // The day the time lists set - without a picked one today, moved into the
  // allowed days, or the nearest one that is not disabled. Local date -
  // toISOString() would give the UTC one. Today follows the clock past
  // midnight.
  const minDate = parseISODate(minDay);
  const maxDate = parseISODate(maxDay);
  const today = useToday() ?? startOfDay(new Date());
  const day =
    datePart ||
    toISODate(
      findEnabledDay(
        parseISODate(clampValue(toISODate(today), minDay, maxDay)) ?? today,
        isDateDisabled,
        minDate,
        maxDate,
      ),
    );
  // A search with no enabled day keeps its starting day. An already
  // selected day can also become disabled while the popup is open.
  const timeDay = parseISODate(day);
  const timeDisabled = !timeDay || !!isDateDisabled?.(timeDay);

  // The time part of a limit applies on its own day only
  const timeLimit = (limit: string | undefined) =>
    limit?.startsWith(day) ? limit.slice(11) : undefined;

  // `date` at a time - kept inside the range, on the minute step
  const toAllowed = (date: string, newHours: string, newMinutes: string) =>
    snapDateTime(
      clampValue(`${date}T${newHours}:${newMinutes}`, minValue, maxValue),
      minuteStep,
      minValue,
      maxValue,
    );

  // A day or a time picked in the popup
  const change = (date: string, newHours: string, newMinutes: string) => {
    const next = toAllowed(date, newHours, newMinutes);
    const nextDay = parseISODate(next);
    // Rounding near midnight may reach another day, which must be enabled too.
    if (!nextDay || isDateDisabled?.(nextDay)) return;
    markPicked();
    onValueChange(next);
  };

  /** A date-time (`YYYY-MM-DDTHH:mm`) as the field shows it. */
  const formatValue = (dateTime: string) => {
    const date = parseISODate(dateTime);
    const parts = parseTime(dateTime.slice(11));
    return date
      ? formatPattern(
          locale.formats.dateTime,
          {
            day: date.getDate(),
            hours: Number(parts?.hours ?? 0),
            minutes: Number(parts?.minutes ?? 0),
            month: date.getMonth() + 1,
            year: date.getFullYear(),
          },
          dayPeriods,
        )
      : dateTime;
  };

  const selectedValue = selectedDate
    ? `${toISODate(selectedDate)}T${hours}:${minutes}`
    : undefined;

  const parsedValue = (value: string) => {
    const day = parseISODate(value);
    return {
      value,
      validityMessage:
        day && isDateDisabled?.(day)
          ? formatMessage(messages.unavailable, { value: formatValue(value) })
          : "",
    };
  };

  // Out of `min` / `max`, or on a disabled day - one typed too, which is
  // kept (the form cannot be submitted with it)
  const validityMessage =
    getRangeMessage(
      messages,
      selectedValue,
      { max: maxValue, min: minValue },
      formatValue,
    ) || parsedValue(selectedValue ?? "").validityMessage;

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? messages.openCalendar}
      contentRef={contentRef}
      displayValue={selectedValue ? formatValue(selectedValue) : ""}
      format={formatPlaceholder(
        locale.formats.dateTime,
        messages.placeholderTokens,
      )}
      icon="calendar"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      parseText={(text) => {
        const typed = parseDisplayValue(
          text,
          locale.formats.dateTime,
          "datetime-local",
          dayPeriods,
        );
        if (typed) {
          // An allowed date-time goes onto the minute step
          return isInRange(typed, minValue, maxValue)
            ? parsedValue(snapDateTime(typed, minuteStep, minValue, maxValue))
            : { error: "range" };
        }

        // A day alone is taken like a day picked in the popup: with the
        // time it had, moved into `min` / `max` on their days
        const typedDay = parseDisplayValue(text, locale.formats.date, "date");
        if (!typedDay) return { error: "format" };
        return isInRange(typedDay, minDay, maxDay)
          ? parsedValue(toAllowed(typedDay, hours, minutes))
          : { error: "range" };
      }}
      pickCount={pickCount}
      placeholder={placeholder}
      popupLabel={messages.selectDateTime}
      validityMessage={validityMessage}
      value={value}
    >
      {/* Side by side from the `sm` breakpoint up, stacked on phones */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div
          aria-label={messages.selectDate}
          className="w-72 max-w-full"
          role="group"
        >
          <DayGrid
            autoFocus={openedByKeyboard}
            isDateDisabled={isDateDisabled}
            max={maxDate}
            min={minDate}
            onEscape={close}
            onSelect={(date) => change(toISODate(date), hours, minutes)}
            selected={selectedDate}
          />
        </div>

        <div
          aria-label={messages.selectTime}
          className="border-t border-neutral-300 pt-2 sm:w-44 sm:border-s sm:border-t-0 sm:ps-2 sm:pt-0 dark:border-neutral-600"
          role="group"
        >
          <TimeLists
            disabled={timeDisabled}
            hour12={usesHour12(locale.formats.dateTime)}
            hours={time?.hours ?? null}
            listClassName="max-h-32 sm:max-h-48"
            max={timeLimit(maxValue)}
            min={timeLimit(minValue)}
            minuteStep={minuteStep}
            minutes={time?.minutes ?? null}
            onChange={(newHours, newMinutes) =>
              change(day, newHours, newMinutes)
            }
            onEscape={close}
          />
        </div>
      </div>
    </PickerField>
  );
}
