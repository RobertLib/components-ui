import { useState } from "react";
import Chip from "../chip";
import { useMessages } from "../../../providers/ui-context";

/** A chip of the bar of the active filters - a filter or the search. */
export interface FilterChip {
  /** Key of the filtered column - `null` for the global search. */
  key: string | null;
  /** What the chip says - the column and its filter. */
  text: string;
}

// The React key of the chip of the search - apart from any column key
const SEARCH_CHIP_KEY = "\u0000search";

interface FilterChipsProps {
  /** The active filters and the search, in the order of the columns. */
  chips: FilterChip[];
  /** Removes all the filters and the search. */
  onClearAll: () => void;
  /** Removes a filter - `null` the search. */
  onRemove: (key: string | null) => void;
}

/**
 * The bar under the toolbar listing the active filters and the search as
 * removable chips, with "Clear all". Gone while nothing filters - unless
 * the focus is in it: "Clear all" pressed, or the last chip removed (whose
 * focus moves to "Clear all"), keeps the focus there, the button
 * `aria-disabled`, until it moves on.
 */
export function FilterChips({ chips, onClearAll, onRemove }: FilterChipsProps) {
  const messages = useMessages().ui.dataTable.activeFilters;
  const [hasFocus, setHasFocus] = useState(false);
  const isEmpty = chips.length === 0;

  if (isEmpty && !hasFocus) return null;

  return (
    <div
      aria-label={messages.label}
      className="flex basis-full flex-wrap items-center gap-1.5 print:hidden"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocus(false);
        }
      }}
      onFocus={() => setHasFocus(true)}
      role="group"
    >
      {chips.map((chip) => (
        <Chip
          color="primary"
          key={chip.key ?? SEARCH_CHIP_KEY}
          onRemove={() => onRemove(chip.key)}
          variant="outline"
        >
          {chip.text}
        </Chip>
      ))}
      <button
        aria-disabled={isEmpty || undefined}
        className="rounded-sm px-1 text-sm font-medium text-primary-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:no-underline dark:text-primary-300"
        onClick={isEmpty ? undefined : onClearAll}
        type="button"
      >
        {messages.clearAll}
      </button>
    </div>
  );
}
