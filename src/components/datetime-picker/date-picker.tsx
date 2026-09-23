import DayGrid from "./day-grid";
import PickerField from "./picker-field";
import { isInRange, parseDisplayValue } from "./parse";
import usePickerPopup from "./use-picker-popup";
import { formatDate, parseISODate, toISODate } from "../../utils/date";
import { useLocale } from "../../providers/ui-context";
import type { CustomPickerProps } from "./types";

/** `type="date"` - value `YYYY-MM-DD`. */
export default function DatePicker({
  max,
  min,
  minuteStep: _minuteStep,
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

  const selectedDate = parseISODate(value);

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? locale.messages.dateTimePicker.openCalendar}
      contentRef={contentRef}
      displayValue={
        selectedDate ? formatDate(selectedDate, locale.formats.date) : ""
      }
      icon="calendar"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      panelClassName="w-72"
      parseText={(text) => {
        const typed = parseDisplayValue(text, locale.formats.date, "date");
        return typed && isInRange(typed, min, max) ? typed : null;
      }}
      placeholder={placeholder}
      value={value}
    >
      <DayGrid
        autoFocus={openedByKeyboard}
        max={parseISODate(max)}
        min={parseISODate(min)}
        onEscape={close}
        onSelect={(date) => {
          onValueChange(toISODate(date));
          close();
        }}
        selected={selectedDate}
      />
    </PickerField>
  );
}
