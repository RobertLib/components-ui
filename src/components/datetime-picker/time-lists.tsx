import { useEffect, useId, useRef } from "react";
import cn from "../../utils/cn";
import { getMinuteOptions, isTimeInRange } from "./parse";
import { formatPattern, getDayPeriods, pad2 } from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

interface TimeListsProps {
  /** Moves the focus into the hour list - the popup was opened by a key. */
  autoFocus?: boolean;
  /**
   * Shows the hours on the 12-hour clock with the AM / PM of the locale -
   * `9 AM`; the values stay 24-hour.
   */
  hour12?: boolean;
  /** Selected hours, `"00"` - `"23"` - `null` without a value. */
  hours: string | null;
  /** Classes of both lists - their height. */
  listClassName?: string;
  /**
   * Latest selectable time, `HH:mm`. Before `min` for a range over
   * midnight (22:00 - 06:00).
   */
  max?: string;
  /** Earliest selectable time, `HH:mm`. */
  min?: string;
  /** Selected minutes - `null` without a value. */
  minutes: string | null;
  /** Minutes offered - a whole number from 1 to 60. */
  minuteStep: number;
  /**
   * Called with the picked hours and minutes - the other part as it was,
   * or `"00"` without a value.
   */
  onChange: (hours: string, minutes: string) => void;
  /** Escape was pressed in a list. */
  onEscape: () => void;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => pad2(hour));

// Options a list shows at once, for Page Up / Down when it cannot be
// measured
const DEFAULT_PAGE_SIZE = 5;

interface TimeListProps {
  /** Moves the focus into the list when the popup opens. */
  autoFocus?: boolean;
  /** Classes of the list - its height. */
  className: string;
  /** Scrolled into the middle when the popup opens without a selected option. */
  initialOption?: string;
  /** Options outside `min` - `max`, which cannot be picked. */
  isDisabled: (option: string) => boolean;
  /** Heading and accessible name of the list. */
  label: string;
  /** Escape was pressed in the list. */
  onEscape: () => void;
  /** An option was picked. */
  onSelect: (option: string) => void;
  /** Text of an option - the option itself by default. */
  optionLabel?: (option: string) => string;
  /** The values offered, in their order. */
  options: string[];
  /** The selected option - `null` for none. */
  selected: string | null;
}

/**
 * A scrollable listbox of hours or minutes. Mounted each time the popup
 * opens - scrolls the selected option into the middle, and keeps it in view
 * when it changes.
 */
function TimeList({
  autoFocus,
  className,
  initialOption,
  isDisabled,
  label,
  onEscape,
  onSelect,
  optionLabel,
  options,
  selected,
}: TimeListProps) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const optionId = (option: string) => `${id}-${option}`;

  // What the popup opened with - the options change later, the opening not
  const initialRef = useRef({ autoFocus, option: selected ?? initialOption });

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const list = listRef.current;
        const { autoFocus: focus, option } = initialRef.current;
        const button =
          option === undefined
            ? null
            : list?.querySelector<HTMLButtonElement>(
                `[data-value="${option}"]`,
              );

        if (list && button) {
          const buttonRect = button.getBoundingClientRect();
          const listRect = list.getBoundingClientRect();
          list.scrollTop +=
            buttonRect.top -
            listRect.top -
            list.clientHeight / 2 +
            button.offsetHeight / 2;
        }

        if (focus) list?.focus();
      });
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  // Keeps a newly selected option in view - picked with a key, or typed
  // into the field
  const shownSelectedRef = useRef(selected);

  useEffect(() => {
    if (selected === shownSelectedRef.current) return;
    shownSelectedRef.current = selected;
    if (selected === null) return;

    listRef.current
      ?.querySelector(`[data-value="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  /** How many options the list shows at once. */
  const pageSize = () => {
    const list = listRef.current;
    const optionHeight =
      list?.querySelector<HTMLElement>("[data-value]")?.offsetHeight ?? 0;
    return list && optionHeight > 0
      ? Math.max(1, Math.floor(list.clientHeight / optionHeight))
      : DEFAULT_PAGE_SIZE;
  };

  // The arrow keys move to the next or the previous option, over the end
  // to the start; Home / End to the first / last one, Page Up / Down by
  // what the list shows at once, stopping at the ends. All skip the
  // disabled options.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      return;
    }

    const count = options.length;
    const index = selected === null ? -1 : options.indexOf(selected);
    const isEnabledAt = (at: number) => !isDisabled(options[at]);
    const indexes = Array.from({ length: count }, (_, at) => at);
    let target: number | undefined;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        const step = event.key === "ArrowDown" ? 1 : -1;
        // Without a selected option ArrowUp starts from the end
        const start = index === -1 && step === -1 ? count : index;
        target = indexes
          .map((offset) => (start + step * (offset + 1) + count * 2) % count)
          .find(isEnabledAt);
        break;
      }
      case "Home":
        target = indexes.find(isEnabledAt);
        break;
      case "End":
        target = indexes.findLast(isEnabledAt);
        break;
      case "PageDown": {
        // As far as a page goes - to the last enabled option up to there
        const last = Math.min(index + pageSize(), count - 1);
        target = indexes.findLast(
          (at) => at > index && at <= last && isEnabledAt(at),
        );
        break;
      }
      case "PageUp": {
        const from = index === -1 ? count : index;
        const first = Math.max(from - pageSize(), 0);
        target = indexes.find(
          (at) => at >= first && at < from && isEnabledAt(at),
        );
        break;
      }
      default:
        return;
    }

    event.preventDefault();
    if (target !== undefined && options[target] !== selected) {
      onSelect(options[target]);
    }
  };

  const labelId = `${id}-label`;

  return (
    <div className="flex-1">
      <div
        className="mb-1 text-center text-xs text-neutral-600 dark:text-neutral-400"
        id={labelId}
      >
        {label}
      </div>
      <div
        aria-activedescendant={
          selected !== null && options.includes(selected)
            ? optionId(selected)
            : undefined
        }
        aria-labelledby={labelId}
        className={cn(
          "overflow-y-auto rounded border border-neutral-300 dark:border-neutral-600",
          className,
        )}
        onKeyDown={handleKeyDown}
        ref={listRef}
        role="listbox"
        tabIndex={0}
      >
        {options.map((option) => {
          const isSelected = option === selected;
          const disabled = isDisabled(option);

          return (
            <button
              aria-selected={isSelected}
              className={cn(
                "w-full px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700",
                isSelected &&
                  "bg-primary-600 text-white hover:bg-primary-700 dark:hover:bg-primary-700",
                disabled &&
                  "cursor-not-allowed opacity-40 hover:bg-transparent dark:hover:bg-transparent",
              )}
              data-value={option}
              disabled={disabled}
              id={optionId(option)}
              key={option}
              onClick={() => onSelect(option)}
              role="option"
              tabIndex={-1}
              type="button"
            >
              {optionLabel ? optionLabel(option) : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Scrollable hour and minute columns. Mounted each time the popup opens and
 * scrolls the selected values into the middle.
 */
export default function TimeLists({
  autoFocus = false,
  hour12 = false,
  hours,
  listClassName = "max-h-40",
  max,
  min,
  minutes,
  minuteStep,
  onChange,
  onEscape,
}: TimeListsProps) {
  const locale = useLocale();
  const messages = locale.messages.dateTimePicker;
  const dayPeriods = getDayPeriods(locale.code);
  const minuteOptions = getMinuteOptions(minuteStep);

  // Options outside `min` - `max` are disabled: the hours with no minute
  // option in it, and the minutes that are not with the selected hour -
  // with midnight before one is selected
  const isHourDisabled = (hour: string) =>
    !minuteOptions.some((minute) =>
      isTimeInRange(`${hour}:${minute}`, min, max),
    );
  const isMinuteDisabled = (minute: string) =>
    !isTimeInRange(`${hours ?? "00"}:${minute}`, min, max);

  return (
    <div className="flex gap-2">
      <TimeList
        autoFocus={autoFocus}
        className={listClassName}
        // Without a value - the working hours
        initialOption="08"
        isDisabled={isHourDisabled}
        label={messages.hours}
        onEscape={onEscape}
        onSelect={(hour) => onChange(hour, minutes ?? "00")}
        optionLabel={
          hour12
            ? (hour) =>
                formatPattern("h A", { hours: Number(hour) }, dayPeriods)
            : undefined
        }
        options={HOUR_OPTIONS}
        selected={hours}
      />
      <TimeList
        className={listClassName}
        initialOption="00"
        isDisabled={isMinuteDisabled}
        label={messages.minutes}
        onEscape={onEscape}
        onSelect={(minute) => onChange(hours ?? "00", minute)}
        options={minuteOptions}
        selected={minutes}
      />
    </div>
  );
}
