import { useState } from "react";
import cn from "../../utils/cn";
import DayGrid, { type DayRange } from "../datetime-picker/day-grid";
import { formatPlural } from "../../i18n/format";
import { startOfDay } from "../../utils/date";
import { useLocale } from "../../providers/ui-context";
import {
  clampRange,
  countDays,
  encodeRange,
  getPresetRange,
  hasAllowedLength,
  isDayAllowed,
  isSameRange,
  orderDays,
  toDateRange,
  toDayRange,
  type RangeLimits,
} from "./range";
import type { DateRangePreset, DateRangePresetKey } from ".";

interface RangeCalendarProps {
  /** Moves the focus to the day - the popup was opened by a key. */
  autoFocus: boolean;
  /** Phones: one month, the presets above it. */
  compact: boolean;
  /** The days and lengths that can be picked. */
  limits: RangeLimits;
  /** Escape was pressed in the calendar. */
  onEscape: () => void;
  /** A range was picked - by its second day or by a preset. */
  onPick: (range: DayRange) => void;
  /** The presets offered next to the calendar. */
  presets: (DateRangePresetKey | DateRangePreset)[];
  /** The selected range. */
  value: DayRange | null;
}

/**
 * The popup of `DateRangePicker`: the presets and the days - the first
 * pick starts a range, the second ends it. Mounted each time the popup
 * opens, so a range left half picked is gone the next time.
 */
export default function RangeCalendar({
  autoFocus,
  compact,
  limits,
  onEscape,
  onPick,
  presets,
  value,
}: RangeCalendarProps) {
  const locale = useLocale();
  const messages = locale.messages.dateRangePicker;
  // The first day picked - the next pick ends the range
  const [anchor, setAnchor] = useState<Date | null>(null);
  // The day under the pointer or in focus - the other end of the range
  // being picked
  const [highlighted, setHighlighted] = useState<Date | null>(null);

  // A range typed into the field meanwhile starts the picking over
  const valueKey = value ? encodeRange(toDateRange(value)) : "";
  const [shownValueKey, setShownValueKey] = useState(valueKey);

  if (valueKey !== shownValueKey) {
    setShownValueKey(valueKey);
    setAnchor(null);
  }

  /** Whether `day` cannot end the range started - too near or too far. */
  const cannotEnd = (day: Date) =>
    !!anchor && !hasAllowedLength(orderDays(anchor, day), limits);

  // While picking, the range to the highlighted day - or the first day
  // alone, when the highlighted one cannot end the range
  const pickedRange =
    anchor &&
    (highlighted && isDayAllowed(highlighted, limits) && !cannotEnd(highlighted)
      ? orderDays(anchor, highlighted)
      : { end: anchor, start: anchor });
  const shownRange = pickedRange ?? value;

  const pick = (day: Date) => {
    if (!anchor) {
      setAnchor(day);
      setHighlighted(day);
      return;
    }

    onPick(orderDays(anchor, day));
  };

  // The presets as ranges inside the limits - `null` for one with nothing
  // left in them. Only in the open popup, so "today" is never the server's.
  const today = startOfDay(new Date());
  const presetItems = presets.map((preset) => {
    const { label, range } =
      typeof preset === "string"
        ? {
            label: messages.presets[preset],
            range: getPresetRange(preset, today, locale.weekStartsOn),
          }
        : { label: preset.label, range: toDayRange(preset.range) };
    const allowed = range && clampRange(range, limits);

    return {
      label,
      range: allowed && hasAllowedLength(allowed, limits) ? allowed : null,
    };
  });

  return (
    <div className={cn("flex", compact ? "flex-col gap-2" : "gap-3")}>
      {presetItems.length > 0 && (
        <div
          aria-label={messages.presetsLabel}
          // On phones one row, swiped sideways - up to the edges of the
          // popup, with room for the focus rings
          className={
            compact
              ? "-mx-2 flex gap-1 overflow-x-auto px-2 py-1"
              : "flex w-36 shrink-0 flex-col gap-0.5 border-r border-neutral-200 pr-3 dark:border-neutral-700"
          }
          role="group"
        >
          {presetItems.map(({ label, range }, index) => {
            const isCurrent = !!range && !!value && isSameRange(range, value);

            return (
              <button
                // The preset of the selected range
                aria-pressed={isCurrent}
                className={cn(
                  "text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  compact
                    ? "shrink-0 rounded-full border px-2.5 py-0.5 whitespace-nowrap"
                    : "rounded px-2 py-1 text-left",
                  compact &&
                    (isCurrent
                      ? "border-primary-500"
                      : "border-neutral-300 dark:border-neutral-600"),
                  !range
                    ? "cursor-not-allowed opacity-40"
                    : isCurrent
                      ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-200"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-700",
                )}
                disabled={!range}
                key={index}
                onClick={() => {
                  if (range) onPick(range);
                }}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div>
        <DayGrid
          autoFocus={autoFocus}
          isUnavailable={anchor ? cannotEnd : undefined}
          max={limits.max}
          min={limits.min}
          months={compact ? 1 : 2}
          onEscape={onEscape}
          onHighlight={setHighlighted}
          onSelect={pick}
          range={shownRange}
          selected={value?.start ?? null}
        />

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-200 pt-2 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          {/* Announced as the first pick is done - not on every move */}
          <span aria-live="polite">
            {anchor ? messages.selectEnd : messages.selectStart}
          </span>
          {shownRange && (
            <span className="tabular-nums">
              {formatPlural(locale.code, messages.days, countDays(shownRange))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
