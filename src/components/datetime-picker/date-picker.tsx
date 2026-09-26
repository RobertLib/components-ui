import DayGrid from "./day-grid";
import PickerField from "./picker-field";
import { getRangeMessage, isInRange, parseDisplayValue } from "./parse";
import usePickerPopup from "./use-picker-popup";
import {
  formatDate,
  formatPlaceholder,
  parseISODate,
  toISODate,
} from "../../utils/date";
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

  const selectedDate = parseISODate(value);

  /** A date (`YYYY-MM-DD`) as the field shows it. */
  const formatValue = (date: string) => {
    const day = parseISODate(date);
    return day ? formatDate(day, locale.formats.date) : date;
  };

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? messages.openCalendar}
      contentRef={contentRef}
      displayValue={selectedDate ? formatValue(value) : ""}
      format={formatPlaceholder(
        locale.formats.date,
        messages.placeholderTokens,
      )}
      icon="calendar"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      panelClassName="w-72"
      parseText={(text) => {
        const typed = parseDisplayValue(text, locale.formats.date, "date");
        if (!typed) return { error: "format" };
        return isInRange(typed, min, max)
          ? { value: typed }
          : { error: "range" };
      }}
      pickCount={pickCount}
      placeholder={placeholder}
      popupLabel={messages.selectDate}
      rangeMessage={getRangeMessage(
        messages,
        selectedDate ? toISODate(selectedDate) : undefined,
        { max, min },
        formatValue,
      )}
      value={value}
    >
      <DayGrid
        autoFocus={openedByKeyboard}
        max={parseISODate(max)}
        min={parseISODate(min)}
        onEscape={close}
        onSelect={(date) => {
          markPicked();
          onValueChange(toISODate(date));
          close();
        }}
        selected={selectedDate}
      />
    </PickerField>
  );
}
