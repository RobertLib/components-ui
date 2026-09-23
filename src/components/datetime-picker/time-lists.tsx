import { useEffect, useId, useRef } from "react";
import cn from "../../utils/cn";
import { pad2 } from "../../utils/date";
import { useMessages } from "../../providers/ui-context";

interface TimeListsProps {
  /** Moves the focus into the hour list - the popup was opened by a key. */
  autoFocus?: boolean;
  /** Shows the hours on the 12-hour clock - `9 AM`, the values stay 24-hour. */
  hour12?: boolean;
  /** Selected hours, `"00"` - `"23"`. */
  hours: string;
  listClassName?: string;
  /** Latest selectable time, `HH:mm`. */
  max?: string;
  /** Earliest selectable time, `HH:mm`. */
  min?: string;
  minutes: string;
  minuteStep: number;
  onChange: (hours: string, minutes: string) => void;
  onEscape: () => void;
  /** Without a value the lists scroll to the working hours. */
  hasValue: boolean;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => pad2(hour));

const getMinuteOptions = (step: number) =>
  Array.from({ length: Math.ceil(60 / step) }, (_, index) =>
    pad2(index * step),
  );

/**
 * Scrollable hour and minute columns. Mounted each time the popup opens and
 * scrolls the selected values into the middle.
 */
export default function TimeLists({
  autoFocus = false,
  hasValue,
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
  const messages = useMessages();
  const id = useId();
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  const minuteOptions = getMinuteOptions(Math.max(1, Math.min(60, minuteStep)));

  // Options outside `min` - `max` are disabled: the hours before or after
  // it, and the minutes that are with the selected hour
  const isHourDisabled = (hour: string) =>
    (!!min && hour < min.slice(0, 2)) || (!!max && hour > max.slice(0, 2));
  const isMinuteDisabled = (minute: string) =>
    (!!min && `${hours}:${minute}` < min) ||
    (!!max && `${hours}:${minute}` > max);

  // Scroll selected hour/minute into view centered when the popup opens
  const initialValues = useRef({ autoFocus, hasValue, hours, minutes });

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const scrollToCenter = (
          list: HTMLDivElement | null,
          targetValue: string,
        ) => {
          const button = list?.querySelector<HTMLButtonElement>(
            `[data-value="${targetValue}"]`,
          );
          if (!list || !button) return;

          const buttonRect = button.getBoundingClientRect();
          const listRect = list.getBoundingClientRect();
          list.scrollTop +=
            buttonRect.top -
            listRect.top -
            list.clientHeight / 2 +
            button.offsetHeight / 2;
        };

        const initial = initialValues.current;
        scrollToCenter(
          hourListRef.current,
          initial.hasValue ? initial.hours : "08",
        );
        scrollToCenter(minuteListRef.current, initial.minutes);

        if (initial.autoFocus) hourListRef.current?.focus();
      });
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  // Keyboard navigation for a time list (hours or minutes) - skips the
  // disabled options and keeps the selected one in view
  const makeListKeyDown =
    (
      options: string[],
      currentValue: string,
      isDisabled: (option: string) => boolean,
      onSelect: (v: string) => void,
    ) =>
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();

      const step = event.key === "ArrowDown" ? 1 : -1;
      const index = options.indexOf(currentValue);
      // Without a selected option ArrowUp starts from the end
      const start = index === -1 && step === -1 ? options.length : index;

      for (let offset = 1; offset <= options.length; offset++) {
        const option =
          options[(start + step * offset + options.length) % options.length];
        if (isDisabled(option)) continue;

        onSelect(option);
        event.currentTarget
          .querySelector(`[data-value="${option}"]`)
          ?.scrollIntoView({ block: "nearest" });
        return;
      }
    };

  const renderList = (
    kind: "hour" | "minute",
    options: string[],
    selectedValue: string,
    isDisabled: (option: string) => boolean,
    onSelect: (value: string) => void,
    listRef: React.RefObject<HTMLDivElement | null>,
    optionLabel: (option: string) => string = (option) => option,
  ) => {
    const listLabel =
      kind === "hour"
        ? messages.dateTimePicker.hours
        : messages.dateTimePicker.minutes;

    return (
      <div className="flex-1">
        <div className="mb-1 text-center text-xs text-neutral-600 dark:text-neutral-400">
          {listLabel}
        </div>
        <div
          aria-activedescendant={
            options.includes(selectedValue)
              ? `${id}-${kind}-${selectedValue}`
              : undefined
          }
          aria-label={listLabel}
          className={cn(
            "overflow-y-auto rounded border border-neutral-300 dark:border-neutral-600",
            listClassName,
          )}
          onKeyDown={makeListKeyDown(
            options,
            selectedValue,
            isDisabled,
            onSelect,
          )}
          ref={listRef}
          role="listbox"
          tabIndex={0}
        >
          {options.map((option) => (
            <button
              aria-selected={option === selectedValue}
              className={cn(
                "w-full px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700",
                option === selectedValue &&
                  "bg-primary-500 text-white hover:bg-primary-600 dark:hover:bg-primary-600",
                isDisabled(option) &&
                  "cursor-not-allowed opacity-40 hover:bg-transparent dark:hover:bg-transparent",
              )}
              data-value={option}
              disabled={isDisabled(option)}
              id={`${id}-${kind}-${option}`}
              key={option}
              onClick={() => onSelect(option)}
              role="option"
              tabIndex={-1}
              type="button"
            >
              {optionLabel(option)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-2">
      {renderList(
        "hour",
        HOUR_OPTIONS,
        hours,
        isHourDisabled,
        (hour) => onChange(hour, minutes),
        hourListRef,
        hour12
          ? (hour) =>
              `${Number(hour) % 12 || 12} ${Number(hour) < 12 ? "AM" : "PM"}`
          : undefined,
      )}
      {renderList(
        "minute",
        minuteOptions,
        minutes,
        isMinuteDisabled,
        (minute) => onChange(hours, minute),
        minuteListRef,
      )}
    </div>
  );
}
