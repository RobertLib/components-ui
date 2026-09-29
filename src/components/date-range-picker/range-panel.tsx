import { useState } from "react";
import cn from "../../utils/cn";
import DayGrid, { type DayRange } from "../datetime-picker/day-grid";
import PresetList from "../datetime-picker/preset-list";
import useIsHydrated from "../../hooks/use-is-hydrated";
import { formatPlural } from "../../i18n/format";
import { startOfDay } from "../../utils/date";
import { useLocale } from "../../providers/ui-context";
import {
  clampRange,
  countDays,
  encodeRange,
  findBlockingDays,
  findUnavailableDay,
  getPresetRange,
  hasAllowedLength,
  isDayAllowed,
  isSameRange,
  orderDays,
  toDateRange,
  toDayRange,
  trimDisabledEnds,
  type RangeLimits,
} from "./range";
import type { DateRangePreset, DateRangePresetKey } from ".";

interface RangePanelProps {
  /** Moves the focus to the day - the popup was opened by a key. */
  autoFocus?: boolean;
  /** Phones: the presets in a row above the days. */
  compact: boolean;
  /** Nothing can be focused or picked. */
  disabled?: boolean;
  /** Shown in the page, not in a popup - see `DayGrid`. */
  inline?: boolean;
  /** The days and lengths that can be picked. */
  limits: RangeLimits;
  /** Months shown side by side. */
  months: 1 | 2;
  /**
   * Escape was pressed in the calendar - the popup closes. Without it
   * Escape drops a range picked halfway, and is left alone otherwise.
   */
  onEscape?: () => void;
  /** A range was picked - by its second day or by a preset. */
  onPick: (range: DayRange) => void;
  /** The presets offered next to the calendar. */
  presets: (DateRangePresetKey | DateRangePreset)[];
  /** The days can be focused, but nothing picked. */
  readOnly?: boolean;
  /** The selected range. */
  value: DayRange | null;
}

/**
 * The presets and the days of a range - the first pick starts a range, the
 * second ends it. The popup of `DateRangePicker`, mounted each time it
 * opens (so a range left half picked is gone the next time), and the
 * calendar of `RangeCalendar`.
 */
export default function RangePanel({
  autoFocus = false,
  compact,
  disabled = false,
  inline = false,
  limits,
  months,
  onEscape,
  onPick,
  presets,
  readOnly = false,
  value,
}: RangePanelProps) {
  const locale = useLocale();
  const messages = locale.messages.dateRangePicker;
  const isHydrated = useIsHydrated();
  // The first day picked - the next pick ends the range
  const [anchor, setAnchor] = useState<Date | null>(null);
  // The day under the pointer or in focus - the other end of the range
  // being picked
  const [highlighted, setHighlighted] = useState<Date | null>(null);

  // A range typed into the field meanwhile (or set by the parent) starts
  // the picking over
  const valueKey = value ? encodeRange(toDateRange(value)) : "";
  const [shownValueKey, setShownValueKey] = useState(valueKey);

  if (valueKey !== shownValueKey) {
    setShownValueKey(valueKey);
    setAnchor(null);
  }

  // A disabled or read-only calendar drops a range picked halfway
  if (anchor && (disabled || readOnly)) setAnchor(null);

  // The disabled days nearest to the first day - the range cannot reach
  // over them (unless `allowDisabledInRange`)
  const blockers = anchor ? findBlockingDays(anchor, limits) : null;

  /**
   * Whether `day` cannot end the range started - too near, too far, or
   * beyond a disabled day.
   */
  const cannotEnd = (day: Date) =>
    !!anchor &&
    (!hasAllowedLength(orderDays(anchor, day), limits) ||
      (!!blockers?.after && day >= blockers.after) ||
      (!!blockers?.before && day <= blockers.before));

  // While picking, the range to the highlighted day - or the first day
  // alone, when the highlighted one cannot end the range
  const pickedRange =
    anchor &&
    (highlighted &&
    isDayAllowed(highlighted, limits) &&
    !limits.isDateDisabled?.(highlighted) &&
    !cannotEnd(highlighted)
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
    setAnchor(null);
  };

  // The presets as ranges inside the limits - `null` for one with nothing
  // left in them. The built-in ones count from today, of the browser - in
  // a server-rendered calendar they wait for the hydration.
  const today = isHydrated ? startOfDay(new Date()) : null;
  const presetItems = presets.map((preset) => {
    const { label, range } =
      typeof preset === "string"
        ? {
            label: messages.presets[preset],
            range: today && getPresetRange(preset, today, locale.weekStartsOn),
          }
        : { label: preset.label, range: toDayRange(preset.range) };
    const clamped = range && clampRange(range, limits);
    const trimmed = clamped && trimDisabledEnds(clamped, limits.isDateDisabled);

    return {
      label,
      range:
        trimmed &&
        hasAllowedLength(trimmed, limits) &&
        !findUnavailableDay(trimmed, limits)
          ? trimmed
          : null,
    };
  });

  return (
    <div className={cn("flex", compact ? "flex-col gap-2" : "gap-3")}>
      {presetItems.length > 0 && (
        <PresetList
          compact={compact}
          items={presetItems.map(({ label, range }) => ({
            current: !!range && !!value && isSameRange(range, value),
            disabled: !range || disabled || readOnly,
            label,
          }))}
          label={messages.presetsLabel}
          onPick={(index) => {
            const range = presetItems[index]?.range;
            if (range) onPick(range);
          }}
        />
      )}

      {/* One month as wide as the date popup, beside the presets */}
      <div className={cn(months === 1 && !compact && "min-w-68 flex-1")}>
        <DayGrid
          autoFocus={autoFocus}
          disabled={disabled}
          inline={inline}
          isDateDisabled={limits.isDateDisabled}
          isUnavailable={anchor ? cannotEnd : undefined}
          max={limits.max}
          min={limits.min}
          months={months}
          onEscape={
            onEscape ??
            (anchor
              ? () => {
                  setAnchor(null);
                }
              : undefined)
          }
          onHighlight={setHighlighted}
          onSelect={pick}
          range={shownRange}
          readOnly={readOnly}
          selected={value?.start ?? null}
        />

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-200 pt-2 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          {/* Announced as the first pick is done - not on every move */}
          <span aria-live="polite">
            {disabled || readOnly
              ? null
              : anchor
                ? messages.selectEnd
                : messages.selectStart}
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
