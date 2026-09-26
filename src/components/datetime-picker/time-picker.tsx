import PickerField from "./picker-field";
import {
  getRangeMessage,
  isTimeInRange,
  normalizeTime,
  parseDisplayValue,
  parseTime,
  snapTime,
} from "./parse";
import TimeLists from "./time-lists";
import usePickerPopup from "./use-picker-popup";
import { formatMessage } from "../../i18n/format";
import {
  formatPattern,
  formatPlaceholder,
  getDayPeriods,
  usesHour12,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";
import type { CustomPickerProps } from "./types";

/** `type="time"` - value `HH:mm`. */
export default function TimePicker({
  max,
  min,
  minuteStep,
  onValueChange,
  placeholder,
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
  const time = parseTime(value);
  // A reversed range (22:00 - 06:00) spans midnight, as for a native input
  const minTime = normalizeTime(min);
  const maxTime = normalizeTime(max);

  /** A time (`HH:mm`) as the field shows it. */
  const formatValue = (hoursAndMinutes: string) => {
    const parts = parseTime(hoursAndMinutes);
    return parts
      ? formatPattern(
          locale.formats.time,
          { hours: Number(parts.hours), minutes: Number(parts.minutes) },
          dayPeriods,
        )
      : hoursAndMinutes;
  };

  const selectedTime = time ? `${time.hours}:${time.minutes}` : undefined;
  // A time out of a range over midnight is before its start, and after its
  // end - the start is said
  const rangeMessage =
    selectedTime && minTime && maxTime && minTime > maxTime
      ? isTimeInRange(selectedTime, minTime, maxTime)
        ? ""
        : formatMessage(messages.rangeUnderflow, { min: formatValue(minTime) })
      : getRangeMessage(
          messages,
          selectedTime,
          { max: maxTime, min: minTime },
          formatValue,
        );

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? messages.selectTime}
      contentRef={contentRef}
      displayValue={selectedTime ? formatValue(selectedTime) : ""}
      format={formatPlaceholder(
        locale.formats.time,
        messages.placeholderTokens,
      )}
      icon="clock"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      panelClassName="w-48"
      parseText={(text) => {
        const typed = parseDisplayValue(
          text,
          locale.formats.time,
          "time",
          dayPeriods,
        );
        if (!typed) return { error: "format" };
        // An allowed time goes onto the minute step
        return isTimeInRange(typed, minTime, maxTime)
          ? { value: snapTime(typed, minuteStep, minTime, maxTime) }
          : { error: "range" };
      }}
      pickCount={pickCount}
      placeholder={placeholder}
      popupLabel={messages.selectTime}
      rangeMessage={rangeMessage}
      value={value}
    >
      {/* The popup is named so already */}
      <div
        aria-hidden="true"
        className="mb-1.5 text-center text-sm font-semibold"
      >
        {messages.selectTime}
      </div>
      <TimeLists
        autoFocus={openedByKeyboard}
        hour12={usesHour12(locale.formats.time)}
        hours={time?.hours ?? null}
        max={maxTime}
        min={minTime}
        minuteStep={minuteStep}
        minutes={time?.minutes ?? null}
        onChange={(hours, minutes) => {
          markPicked();
          onValueChange(
            snapTime(`${hours}:${minutes}`, minuteStep, minTime, maxTime),
          );
        }}
        onEscape={close}
      />
    </PickerField>
  );
}
