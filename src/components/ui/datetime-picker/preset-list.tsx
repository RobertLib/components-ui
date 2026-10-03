import cn from "../../../utils/cn";

/** A button of `PresetList`. */
export interface PresetItem {
  /** The preset of the selected value - marked, and `aria-pressed`. */
  current: boolean;
  /** Nothing of the preset can be picked. */
  disabled: boolean;
  /** Text of the button. */
  label: string;
}

interface PresetListProps {
  /**
   * Phones: one row above the calendar, swiped sideways - otherwise a
   * column beside it.
   */
  compact: boolean;
  /** The presets. */
  items: PresetItem[];
  /** Accessible name of the group. */
  label: string;
  /** A preset was picked - its index in `items`. */
  onPick: (index: number) => void;
}

/**
 * The presets beside the calendar of a date or a range - a click picks a
 * value at once.
 */
export default function PresetList({
  compact,
  items,
  label,
  onPick,
}: PresetListProps) {
  return (
    <div
      aria-label={label}
      // On phones one row, swiped sideways - up to the edges of the popup,
      // with room for the focus rings
      className={
        compact
          ? "-mx-2 flex gap-1 overflow-x-auto px-2 py-1"
          : "flex w-36 shrink-0 flex-col gap-0.5 border-e border-neutral-200 pe-3 dark:border-neutral-700"
      }
      role="group"
    >
      {items.map(({ current, disabled, label: itemLabel }, index) => (
        <button
          // The preset of the selected value
          aria-pressed={current}
          className={cn(
            "text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500",
            compact
              ? "shrink-0 rounded-full border px-2.5 py-0.5 whitespace-nowrap"
              : "rounded px-2 py-1 text-start",
            compact &&
              (current
                ? "border-primary-500"
                : "border-neutral-300 dark:border-neutral-600"),
            disabled
              ? "cursor-not-allowed opacity-40"
              : current
                ? // Forced colors (Windows High Contrast) draw no tint -
                  // the system's highlight colors then
                  "bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-200 forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-700",
          )}
          data-disabled={disabled ? "" : undefined}
          data-selected={current ? "" : undefined}
          disabled={disabled}
          key={index}
          onClick={() => {
            if (!disabled) onPick(index);
          }}
          type="button"
        >
          {itemLabel}
        </button>
      ))}
    </div>
  );
}
