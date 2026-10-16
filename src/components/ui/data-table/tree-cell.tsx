import { ChevronRight } from "lucide-react";
import { useRef } from "react";
import cn from "../../../utils/cn";
import { getActiveElement } from "../overlay-stack";
import type { Locale } from "../../../i18n/ui/types";

// Indentation of each level below the top one, in rem - as in `TreeView`
const INDENT_STEP = 1.25;

/** The controls of a tree cell - their clicks are no clicks of the cell. */
export const TREE_CONTROL = "[data-tree-control]";

interface TreeCellProps {
  /** The content of the cell. */
  children: React.ReactNode;
  /** Smaller toggle for compact rows. */
  compact: boolean;
  /** The sub rows are shown - `undefined` for a row without any. */
  expanded?: boolean;
  /** Prefix of the ids of the toggle and the retry button. */
  idPrefix: string;
  /** Id of the content - when it is what names the row. */
  labelId?: string;
  /** Depth of the row - `1` at the top level. */
  level: number;
  /** The texts. */
  locale: Locale;
  /** Loads the sub rows again after a failure. */
  onRetry: () => void;
  /** Expands or collapses the sub rows. */
  onToggle: () => void;
  /** Id of what names the row - the controls add it to their names. */
  rowLabelId?: string;
  /** The sub rows are loading, or failed to (`loadSubRows`). */
  status?: "error" | "loading";
  /** `-1` while the row itself takes the arrow keys (it is a tab stop). */
  toggleTabIndex?: -1;
}

/**
 * The cell of tree data holding the toggle of the sub rows - indented by
 * the level of its row, with the state of loading the sub rows.
 */
export default function TreeCell({
  children,
  compact,
  expanded,
  idPrefix,
  labelId,
  level,
  locale,
  onRetry,
  onToggle,
  rowLabelId,
  status,
  toggleTabIndex,
}: TreeCellProps) {
  const messages = locale.messages.ui.dataTable;
  const toggleId = `${idPrefix}-toggle`;
  const retryId = `${idPrefix}-retry`;
  // "Sub-rows" alone does not tell the rows apart - named with the row
  const labelledBy = (id: string) =>
    rowLabelId ? `${id} ${rowLabelId}` : undefined;
  const size = compact ? "size-4" : "size-5";
  const toggleRef = useRef<HTMLButtonElement>(null);

  const handleRetry = (event: React.MouseEvent<HTMLButtonElement>) => {
    // The button goes as the sub rows load again - its focus goes to the
    // row (the tab stop of the rows), or to the toggle of a row with a link
    const button = event.currentTarget;
    const root = button.getRootNode() as Document | ShadowRoot;
    if (getActiveElement(root) === button) {
      const row = button.closest("tr");
      (toggleTabIndex === -1 && row ? row : toggleRef.current)?.focus();
    }
    onRetry();
  };

  return (
    <div
      className="flex items-start gap-1"
      style={{ paddingInlineStart: `${(level - 1) * INDENT_STEP}rem` }}
    >
      {expanded === undefined ? (
        // Rows without sub rows keep their text in line with their siblings
        <span aria-hidden="true" className={cn("shrink-0", size)} />
      ) : (
        <button
          aria-expanded={expanded}
          aria-label={messages.tree.toggle}
          aria-labelledby={labelledBy(toggleId)}
          className={cn(
            // A bigger target than it looks - for a finger
            "relative flex shrink-0 cursor-pointer items-center justify-center rounded text-neutral-500 after:absolute after:-inset-1 after:content-[''] hover:bg-neutral-200 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200",
            size,
          )}
          data-state={expanded ? "open" : "closed"}
          data-tree-control=""
          id={toggleId}
          onClick={onToggle}
          ref={toggleRef}
          tabIndex={toggleTabIndex}
          title={expanded ? messages.collapseRow : messages.expandRow}
          type="button"
        >
          {/* The row is busy (`aria-busy`) - the table announces the rows
              the user waits for */}
          {status === "loading" ? (
            <svg
              aria-hidden="true"
              className="size-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "transition-transform duration-150 motion-reduce:transition-none",
                // Pointing at the text - to the left in a right-to-left page
                expanded ? "rotate-90" : "rtl:-scale-x-100",
              )}
              size={16}
            />
          )}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div id={labelId}>{children}</div>
        {status === "error" && (
          <div className="text-xs text-danger-700 dark:text-danger-400">
            {messages.tree.loadFailed}{" "}
            <button
              aria-labelledby={labelledBy(retryId)}
              className="cursor-pointer rounded-sm font-semibold underline underline-offset-2 hover:text-danger-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:hover:text-danger-300"
              data-tree-control=""
              id={retryId}
              onClick={handleRetry}
              type="button"
            >
              {messages.tree.retry}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
