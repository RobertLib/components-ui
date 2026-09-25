import Popover from "../popover";
import { formatMessage, formatPlural } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";
import type { PluralMessage } from "../../i18n/types";

interface MoreEventsProps {
  /** The tiles of the events the list shows. */
  children: React.ReactNode;
  /** Number of the events that have no tile of their own. */
  count: number;
  /** Heading of the list - the full date of the day (and its resource). */
  label: string;
  /**
   * Text of the button - "+N more" (`calendar.more`) by default, or
   * "+N earlier" / "+N later" of the week and day views.
   */
  message?: PluralMessage;
}

/**
 * "+N more" of a day that has no room for all its events - it opens the list
 * of them all. Named with the day too: a screen reader lists the buttons of
 * a month out of their cells.
 */
export default function MoreEvents({
  children,
  count,
  label,
  message,
}: MoreEventsProps) {
  const locale = useLocale();
  const { calendar } = locale.messages;
  const text = formatPlural(locale.code, message ?? calendar.more, count);

  return (
    // A click here opens the list, not the day
    <div onClick={(event) => event.stopPropagation()}>
      <Popover
        aria-label={formatMessage(calendar.moreLabel, {
          day: label,
          more: text,
        })}
        className="inline-block"
        contentClassName="p-2"
        position="bottom"
        trigger={
          <span className="rounded px-1 text-xs text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200">
            {text}
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
