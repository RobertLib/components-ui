import { useState } from "react";
import { X } from "lucide-react";
import cn from "../../utils/cn";
import { useMessages } from "../../providers/ui-context";

interface ClearFiltersButtonProps {
  /** Extra classes of the button. */
  className?: string;
  /** Some filter has a value - the button is enabled. */
  hasActiveFilters: boolean;
  /** In the row of the filter fields - as high as they are. */
  inFilterRow?: boolean;
  /** Empties the filters. */
  onClear: () => void;
}

/**
 * Empties all filters (also a search without its field) - in the actions
 * column, or in the toolbar without one or without a visible filter field.
 * Pressed, it keeps the focus while there is nothing more to clear.
 */
export default function ClearFiltersButton({
  className,
  hasActiveFilters,
  inFilterRow = false,
  onClear,
}: ClearFiltersButtonProps) {
  const messages = useMessages();
  // A button disabled with the focus in it drops the focus to the page -
  // it stays focusable (`aria-disabled`) until the focus moves on
  const [hasFocus, setHasFocus] = useState(false);

  return (
    <button
      aria-disabled={!hasActiveFilters || undefined}
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 text-sm whitespace-nowrap aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
        // The toolbar icons are 26px high, the filter fields 22px
        inFilterRow ? "py-0" : "py-0.5",
        hasActiveFilters
          ? "border-primary-400 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10"
          : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900",
        className,
      )}
      disabled={!hasActiveFilters && !hasFocus}
      onBlur={() => setHasFocus(false)}
      onClick={hasActiveFilters ? onClear : undefined}
      onFocus={() => setHasFocus(true)}
      type="button"
    >
      <X aria-hidden="true" size={16} />
      {messages.dataTable.clearFilters}
    </button>
  );
}
