import cn from "../../../utils/cn";
import DayGrid from "./day-grid";
import PickerField from "./picker-field";
import PresetList from "./preset-list";
import { getRangeMessage, isInRange, parseDisplayValue } from "./parse";
import usePickerPopup from "./use-picker-popup";
import useIsMobile from "../../../hooks/use-is-mobile";
import useToday from "../../../hooks/use-today";
import { formatMessage } from "../../../i18n/ui/format";
import {
  formatDate,
  formatPlaceholder,
  parseISODate,
  startOfDay,
  toISODate,
} from "../../../utils/date";
import { useLocale } from "../../../providers/ui-context";
import type { CustomPickerProps } from "./types";

const actionClassName =
  "rounded px-2 py-1 text-sm font-medium text-primary-700 hover:bg-primary-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-primary-300 dark:hover:bg-primary-900/40 dark:disabled:hover:bg-transparent";

/** `type="date"` - value `YYYY-MM-DD`. */
export default function DatePicker({
  isDateDisabled,
  max,
  min,
  minuteStep: _minuteStep,
  onValueChange,
  placeholder,
  popupActions,
  presets,
  value,
  ...props
}: CustomPickerProps) {
  const locale = useLocale();
  const messages = locale.messages.ui.dateTimePicker;
  const isMobile = useIsMobile();
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
  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);

  /** A date (`YYYY-MM-DD`) as the field shows it. */
  const formatValue = (date: string) => {
    const day = parseISODate(date);
    return day ? formatDate(day, locale.formats.date) : date;
  };

  /** Whether a day can be picked - in `min` / `max`, and not disabled. */
  const canPick = (day: Date) =>
    isInRange(toISODate(day), min, max) && !isDateDisabled?.(day);

  const getUnavailableMessage = (value: string) => {
    const day = parseISODate(value);
    return day && isDateDisabled?.(day)
      ? formatMessage(messages.unavailable, { value: formatValue(value) })
      : "";
  };

  // A picked day, a preset or today - the popup closes
  const pick = (date: string) => {
    markPicked();
    onValueChange(date);
    close();
  };

  // Out of `min` / `max`, or a disabled day - one typed too, which is kept
  // (the form cannot be submitted with it)
  const validityMessage =
    getRangeMessage(
      messages,
      selectedDate ? toISODate(selectedDate) : undefined,
      { max, min },
      formatValue,
    ) || getUnavailableMessage(value);

  // Only in the open popup - "today" is the browser's, the next day after
  // midnight
  const today = useToday() ?? startOfDay(new Date());
  const hasClear = !!selectedDate && (props.clearable ?? !props.required);
  const presetItems = (presets ?? []).map((preset) => {
    const day = parseISODate(preset.value);
    const disabled = !day || !canPick(day);
    return {
      current: !disabled && !!selectedDate && preset.value === value,
      disabled,
      label: preset.label,
    };
  });
  const hasPresets = presetItems.length > 0;

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
      // Wider with the presets beside the days
      panelClassName={hasPresets && !isMobile ? undefined : "w-72"}
      parseText={(text) => {
        const typed = parseDisplayValue(text, locale.formats.date, "date");
        if (!typed) return { error: "format" };
        return isInRange(typed, min, max)
          ? { value: typed, validityMessage: getUnavailableMessage(typed) }
          : { error: "range" };
      }}
      pickCount={pickCount}
      placeholder={placeholder}
      popupLabel={messages.selectDate}
      validityMessage={validityMessage}
      value={value}
    >
      <div
        className={cn(
          hasPresets && (isMobile ? "flex flex-col gap-2" : "flex gap-3"),
        )}
      >
        {hasPresets && (
          <PresetList
            compact={isMobile}
            items={presetItems}
            label={messages.presetsLabel}
            onPick={(index) => pick(presets?.[index]?.value ?? "")}
          />
        )}

        <div className={cn(hasPresets && !isMobile && "w-68")}>
          <DayGrid
            autoFocus={openedByKeyboard}
            isDateDisabled={isDateDisabled}
            max={maxDate}
            min={minDate}
            onEscape={close}
            onSelect={(date) => pick(toISODate(date))}
            selected={selectedDate}
          />

          {popupActions && (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-700">
              <button
                className={actionClassName}
                // Also when today is out of `min` / `max` or disabled
                disabled={!canPick(today)}
                onClick={() => pick(toISODate(today))}
                type="button"
              >
                {messages.today}
              </button>
              {hasClear && (
                <button
                  className={actionClassName}
                  onClick={() => pick("")}
                  type="button"
                >
                  {messages.clearButton}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </PickerField>
  );
}
