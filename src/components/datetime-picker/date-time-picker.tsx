import DayGrid from "./day-grid";
import PickerField from "./picker-field";
import TimeLists from "./time-lists";
import {
  clampValue,
  isInRange,
  normalizeDateTime,
  parseDisplayValue,
  parseTime,
} from "./parse";
import usePickerPopup from "./use-picker-popup";
import {
  formatPattern,
  parseISODate,
  toISODate,
  usesHour12,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";
import type { CustomPickerProps } from "./types";

/** `type="datetime-local"` - value `YYYY-MM-DDTHH:mm`. */
export default function DateTimePanelPicker({
  max,
  min,
  minuteStep,
  onValueChange,
  placeholder,
  value,
  ...props
}: CustomPickerProps) {
  const locale = useLocale();
  const {
    close,
    contentRef,
    inputRef,
    isOpen,
    onOpenChange,
    openedByKeyboard,
  } = usePickerPopup();

  const [datePart = "", timePart = ""] = (value || "").split("T");
  const selectedDate = parseISODate(datePart);
  const time = parseTime(timePart);
  const hours = time?.hours ?? "00";
  const minutes = time?.minutes ?? "00";

  // A limit without a time allows its whole day
  const minValue = normalizeDateTime(min, "00:00");
  const maxValue = normalizeDateTime(max, "23:59");

  // The day the time lists set - without a picked one today, moved into the
  // allowed days. Local date - toISOString() would give the UTC one.
  const day =
    datePart ||
    clampValue(
      toISODate(new Date()),
      minValue?.slice(0, 10),
      maxValue?.slice(0, 10),
    );

  // The time part of a limit applies on its own day only
  const timeLimit = (limit: string | undefined) =>
    limit?.startsWith(day) ? limit.slice(11) : undefined;

  const change = (date: string, newHours: string, newMinutes: string) =>
    onValueChange(
      clampValue(`${date}T${newHours}:${newMinutes}`, minValue, maxValue),
    );

  const displayValue = selectedDate
    ? formatPattern(locale.formats.dateTime, {
        day: selectedDate.getDate(),
        hours: Number(hours),
        minutes: Number(minutes),
        month: selectedDate.getMonth() + 1,
        year: selectedDate.getFullYear(),
      })
    : "";

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? locale.messages.dateTimePicker.openCalendar}
      contentRef={contentRef}
      displayValue={displayValue}
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
        );
        return typed && isInRange(typed, minValue, maxValue) ? typed : null;
      }}
      placeholder={placeholder}
      value={value}
    >
      {/* Side by side from the `sm` breakpoint up, stacked on phones */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="w-72 max-w-full">
          <DayGrid
            autoFocus={openedByKeyboard}
            max={parseISODate(max)}
            min={parseISODate(min)}
            onEscape={close}
            onSelect={(date) => change(toISODate(date), hours, minutes)}
            selected={selectedDate}
          />
        </div>

        <div className="border-t border-neutral-300 pt-2 sm:w-44 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-2 dark:border-neutral-600">
          <TimeLists
            hasValue={!!time}
            hour12={usesHour12(locale.formats.dateTime)}
            hours={hours}
            listClassName="max-h-32 sm:max-h-48"
            max={timeLimit(maxValue)}
            min={timeLimit(minValue)}
            minuteStep={minuteStep}
            minutes={minutes}
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
