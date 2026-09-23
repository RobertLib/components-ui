import PickerField from "./picker-field";
import {
  clampValue,
  isInRange,
  normalizeTime,
  parseDisplayValue,
  parseTime,
} from "./parse";
import TimeLists from "./time-lists";
import usePickerPopup from "./use-picker-popup";
import { formatPattern, usesHour12 } from "../../utils/date";
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
    onOpenChange,
    openedByKeyboard,
  } = usePickerPopup();

  const time = parseTime(value);

  const earliest = normalizeTime(min);
  const latest = normalizeTime(max);
  // A reversed range (22:00 - 06:00) spans midnight - it is not enforced
  const [minTime, maxTime] =
    earliest && latest && earliest > latest ? [] : [earliest, latest];

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? messages.selectTime}
      contentRef={contentRef}
      displayValue={
        time
          ? formatPattern(locale.formats.time, {
              hours: Number(time.hours),
              minutes: Number(time.minutes),
            })
          : ""
      }
      icon="clock"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      panelClassName="w-48"
      parseText={(text) => {
        const typed = parseDisplayValue(text, locale.formats.time, "time");
        return typed && isInRange(typed, minTime, maxTime) ? typed : null;
      }}
      placeholder={placeholder}
      value={value}
    >
      <div aria-label={messages.selectTime} role="group">
        <div className="mb-1.5 text-center text-sm font-semibold">
          {messages.selectTime}
        </div>
        <TimeLists
          autoFocus={openedByKeyboard}
          hasValue={!!time}
          hour12={usesHour12(locale.formats.time)}
          hours={time?.hours ?? "00"}
          max={maxTime}
          min={minTime}
          minuteStep={minuteStep}
          minutes={time?.minutes ?? "00"}
          onChange={(hours, minutes) =>
            onValueChange(clampValue(`${hours}:${minutes}`, minTime, maxTime))
          }
          onEscape={close}
        />
      </div>
    </PickerField>
  );
}
