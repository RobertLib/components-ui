import Popover from "../popover";
import { formatPlural } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";

interface MoreEventsProps {
  /** The tiles of all the events of the day. */
  children: React.ReactNode;
  /** Number of the events that have no tile of their own. */
  count: number;
  /** Heading of the list - the full date of the day. */
  label: string;
}

/**
 * "+N more" of a day that has no room for all its events - it opens the list
 * of them all.
 */
export default function MoreEvents({
  children,
  count,
  label,
}: MoreEventsProps) {
  const locale = useLocale();

  return (
    // A click here opens the list, not the day
    <div onClick={(event) => event.stopPropagation()}>
      <Popover
        className="inline-block"
        contentClassName="p-2"
        position="bottom"
        trigger={
          <span className="rounded px-1 text-xs text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200">
            {formatPlural(locale.code, locale.messages.calendar.more, count)}
          </span>
        }
        triggerType="click"
        width="220px"
      >
        <div className="mb-1.5 text-sm font-semibold">{label}</div>
        {/* One event per line - the tiles are as wide as their text */}
        <div className="space-y-1 text-xs">{children}</div>
      </Popover>
    </div>
  );
}
