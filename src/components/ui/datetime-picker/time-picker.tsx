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
import {
  formatPattern,
  formatPlaceholder,
  getDayPeriods,
  usesHour12,
} from "../../../utils/date";
import { useLocale } from "../../../providers/ui-context";
import type { CustomPickerProps } from "./types";

/** `type="time"` - value `HH:mm`. */
export default function TimePicker({
  // No days in a time
  isDateDisabled: _isDateDisabled,
  max,
  min,
  minuteStep,
  onValueChange,
  placeholder,
  popupActions: _popupActions,
  presets: _presets,
  timeZone: _timeZone,
  value,
  ...props
}: CustomPickerProps) {
  const locale = useLocale();
  const messages = locale.messages.ui.dateTimePicker;
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
  // Validate the supplied seconds that the form submits. The popup and the
  // guidance in the message still offer whole minutes within those limits.
  const rangeMessage = getRangeMessage(
    messages,
    value,
    { max, min },
    (limit, kind) => formatValue(normalizeTime(limit, kind) ?? limit),
    "time",
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
        const snapped = isTimeInRange(typed, min, max)
          ? snapTime(typed, minuteStep, min, max)
          : undefined;
        return snapped ? { value: snapped } : { error: "range" };
      }}
      pickCount={pickCount}
      placeholder={placeholder}
      popupLabel={messages.selectTime}
      validityMessage={rangeMessage}
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
        max={max}
        min={min}
        minuteStep={minuteStep}
        minutes={time?.minutes ?? null}
        onChange={(hours, minutes) => {
          const next = snapTime(`${hours}:${minutes}`, minuteStep, min, max);
          if (!next) return;
          markPicked();
          onValueChange(next);
        }}
        onEscape={close}
      />
    </PickerField>
  );
}
