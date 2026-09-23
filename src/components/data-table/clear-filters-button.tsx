import { X } from "lucide-react";
import cn from "../../utils/cn";
import { useMessages } from "../../providers/ui-context";

interface ClearFiltersButtonProps {
  className?: string;
  /** Some column filter has a value - the button is enabled. */
  hasActiveFilters: boolean;
  onClear: () => void;
}

/** Empties all column filters - in the actions column, or the toolbar without one. */
export default function ClearFiltersButton({
  className,
  hasActiveFilters,
  onClear,
}: ClearFiltersButtonProps) {
  const messages = useMessages();

  return (
    <button
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50",
        hasActiveFilters
          ? "border-primary-400 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10"
          : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900",
        className,
      )}
      disabled={!hasActiveFilters}
      onClick={onClear}
      type="button"
    >
      <X aria-hidden="true" size={16} />
      {messages.dataTable.clearFilters}
    </button>
  );
}
