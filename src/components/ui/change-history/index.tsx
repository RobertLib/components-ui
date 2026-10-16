import { Cog, History } from "lucide-react";
import {
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { attachRef } from "../../../hooks/use-form-control";
import useFormatDate from "../../../hooks/use-format-date";
import useFormatRelativeTime from "../../../hooks/use-format-relative-time";
import useIsHydrated from "../../../hooks/use-is-hydrated";
import useToday from "../../../hooks/use-today";
import {
  formatNumber,
  formatPlural,
  toIntlLocale,
} from "../../../i18n/ui/format";
import { useLocale } from "../../../providers/ui-context";
import cn from "../../../utils/cn";
import isPromiseLike from "../../../utils/is-promise-like";
import logger from "../../../utils/logger";
import {
  addDays,
  capitalize,
  startOfDay,
  toISODate,
} from "../../../utils/date";
import { dateTimeZone, inTimeZone, isTimeZone } from "../../../utils/time-zone";
import Avatar from "../avatar";
import Button from "../button";
import Chip, { type ChipColor } from "../chip";
import EmptyState from "../empty-state";
import Select from "../select";
import Table, { TableBody, TableCell, TableHead, TableRow } from "../table";
import Timeline, { type TimelineColor, type TimelineItem } from "../timeline";
import { diffWords, withContext, type DiffPart } from "./word-diff";

/** The person who made a change. */
export interface ChangeHistoryAuthor {
  /** URL of a profile picture - the initials of `name` without one. */
  avatarUrl?: string;
  /** Identifies the person in the author filter - the `name` by default. */
  id?: string | number;
  /** Name of the person. */
  name: string;
}

/**
 * What an entry did - `created`, `updated` and `deleted` are written in the
 * language of the locale, another text is shown as it is ("Approved").
 */
export type ChangeHistoryAction =
  "created" | "updated" | "deleted" | (string & {});

/** A changed field of an entry. */
export interface ChangeHistoryChange {
  /** Key of the field - see `fields` of `ChangeHistory`. */
  field: string;
  /** The value before - empty for none (a created record). */
  from?: unknown;
  /** Name of the field - the `label` of `fields`, or the key, by default. */
  label?: string;
  /** The value after - empty for none (a cleared field). */
  to?: unknown;
}

/** One entry of the history - who did what, when. */
export interface ChangeHistoryEntry {
  /** What happened - see `ChangeHistoryAction`. */
  action: ChangeHistoryAction;
  /** Who did it - none for a change of the system (an import, a job). */
  author?: ChangeHistoryAuthor | null;
  /** The changed fields - a table of their values before and after. */
  changes?: ChangeHistoryChange[];
  /** A note of the author, e.g. why they changed it. */
  comment?: React.ReactNode;
  /** Unique id of the entry. */
  id: string | number;
  /** When it happened - a `Date`, an ISO text or a timestamp. */
  time: Date | string | number;
}

/** How a field of the changes is shown. */
export interface ChangeHistoryField {
  /**
   * Compares the old and the new text word by word, in one cell - `true`
   * for every change of the field, `false` for none. By default for texts
   * longer than `longTextLength`, or of several lines.
   */
  diff?: boolean;
  /**
   * Writes a value of the field - e.g. a status by its label, an amount
   * with its currency. An empty value (`null`, `""`) is shown as "—"
   * without asking.
   */
  formatValue?: (
    value: unknown,
    change: ChangeHistoryChange,
    entry: ChangeHistoryEntry,
  ) => React.ReactNode;
  /** Name of the field, e.g. "Due date". */
  label?: string;
}

/** What the filters of the history pick - nothing for all. */
export interface ChangeHistoryFilter {
  /**
   * The `id` (or `name`) of an author as a text - `"system"` for the
   * changes no person made.
   */
  author?: string;
  /** Key of a field - the entries that changed it, with only its change. */
  field?: string;
}

export interface ChangeHistoryProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /**
   * How many days back a time is written relative to now ("před 3 dny") -
   * older times show the time of day under their date.
   * @default 7
   */
  absoluteAfterDays?: number;
  /** The filters of an uncontrolled history at first. */
  defaultFilter?: ChangeHistoryFilter;
  /**
   * Shown when there are no entries - "No changes yet" of the locale by
   * default.
   */
  empty?: React.ReactNode;
  /** The entries, in the order to show them - newest first, typically. */
  entries: ChangeHistoryEntry[];
  /** How the fields of the changes are shown, by their key. */
  fields?: Record<string, ChangeHistoryField>;
  /**
   * Shows the filters of the fields and the authors above the entries.
   * They filter the entries given - and tell `onFilterChange`, to load
   * others from a server.
   */
  filterable?: boolean;
  /** The filters of a controlled history - with `onFilterChange`. */
  filter?: ChangeHistoryFilter;
  /**
   * Writes a value of any field without a `formatValue` of its own - by
   * default dates and numbers by the locale, booleans as Yes / No, lists
   * joined by commas.
   */
  formatValue?: ChangeHistoryField["formatValue"];
  /**
   * Whether `onLoadMore` has older entries to load - the "Load older
   * changes" button shows while it does.
   */
  hasMore?: boolean;
  /**
   * Level of the headings of the days - fit it into the outline of the
   * page.
   * @default 3
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Shows placeholder entries, e.g. while the history loads. */
  loading?: boolean;
  /**
   * Shows the "Load older changes" button loading - by default it does
   * while the promise `onLoadMore` returned is pending.
   */
  loadingMore?: boolean;
  /**
   * Texts longer than this (or of several lines) are compared word by word,
   * with the unchanged words around the changes shortened.
   * @default 120
   */
  longTextLength?: number;
  /** Called with the new filters as the user picks them. */
  onFilterChange?: (filter: ChangeHistoryFilter) => void;
  /**
   * Loads older entries - append them to `entries`. A returned promise
   * shows the button loading while it is pending, and an error with
   * "Try again" when it rejects.
   */
  onLoadMore?: () => void | PromiseLike<unknown>;
  /**
   * `sm` - compact: smaller markers and less space between the entries.
   * @default "md"
   */
  size?: "sm" | "md";
  /**
   * IANA time zone the days and times are written in, e.g.
   * `"Europe/Prague"` - the browser's by default, which also stands in for
   * a zone the browser does not know (with a warning in the console). Give
   * it for a page rendered on the server, which does not know the zone of
   * the user.
   */
  timeZone?: string;
}

/** The authors' key of the changes no person made. */
const SYSTEM_AUTHOR = "system";

const BUILT_IN_ACTIONS = new Set(["created", "updated", "deleted"]);

const actionColors: Record<string, ChipColor & TimelineColor> = {
  created: "success",
  deleted: "danger",
  updated: "primary",
};

/** The key of the author of an entry in the author filter. */
const authorKey = (entry: ChangeHistoryEntry) =>
  entry.author ? String(entry.author.id ?? entry.author.name) : SYSTEM_AUTHOR;

/** The moment of an entry - `null` for an invalid one. */
function toDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whether a value is shown as empty - "—". */
const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "number" && Number.isNaN(value)) ||
  (value instanceof Date && Number.isNaN(value.getTime()));

// A day or a moment as the date pickers write them
const PICKER_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;
// An ISO moment with its time zone
const ZONED_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * The whitespace before the words of a changed part, and the words - the
 * space is no part of the change, so not marked (nor is a part of only
 * whitespace, at the end of a text).
 */
const splitSpace = (text: string) => {
  const words = text.trimStart();
  return [text.slice(0, text.length - words.length), words] as const;
};

/** The words of a long text compared - removed and added ones marked. */
function TextDiff({
  added,
  parts,
  removed,
}: {
  added: string;
  parts: (DiffPart | { type: "gap" })[];
  removed: string;
}) {
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        switch (part.type) {
          case "gap":
            return (
              <span
                className="text-neutral-500 dark:text-neutral-400"
                key={index}
              >
                {" … "}
              </span>
            );
          case "removed": {
            const [space, words] = splitSpace(part.text);
            return (
              <Fragment key={index}>
                {space}
                {words && (
                  <del className="rounded-sm bg-danger-100 text-danger-800 decoration-danger-600 dark:bg-danger-950 dark:text-danger-200 forced-colors:decoration-[CanvasText]">
                    <span className="sr-only">{removed} </span>
                    {words}
                  </del>
                )}
              </Fragment>
            );
          }
          case "added": {
            const [space, words] = splitSpace(part.text);
            return (
              <Fragment key={index}>
                {space}
                {words && (
                  <ins className="rounded-sm bg-success-100 text-success-800 no-underline dark:bg-success-950 dark:text-success-200 forced-colors:underline">
                    <span className="sr-only">{added} </span>
                    {words}
                  </ins>
                )}
              </Fragment>
            );
          }
          default:
            return <span key={index}>{part.text}</span>;
        }
      })}
    </span>
  );
}

/** A long text compared word by word - shortened around the changes. */
function LongTextChange({ from, to }: { from: string; to: string }) {
  const messages = useLocale().messages.ui.changeHistory;
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const parts = diffWords(from, to);
  const shortened = withContext(parts, 6);

  return (
    <div className="space-y-1">
      <div id={contentId}>
        <TextDiff
          added={messages.added}
          parts={expanded || !shortened ? parts : shortened}
          removed={messages.removed}
        />
      </div>
      {shortened && (
        <Button
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          size="sm"
          variant="link"
        >
          {expanded ? messages.showLess : messages.showMore}
        </Button>
      )}
    </div>
  );
}

/**
 * The audit trail of a record - who changed what and when, on a timeline
 * grouped by days ("Today", "Yesterday", a date). Each entry has its author
 * (an avatar, or the system), its action, a relative time (the date and
 * time in its title) and a table of the changed fields - their values
 * before and after, a long text compared word by word. Optional filters of
 * the fields and the authors, older entries loaded on request
 * (`onLoadMore`), placeholders while loading and an empty state. The `ref`
 * and the other attributes go to the element around.
 */
export default function ChangeHistory({
  absoluteAfterDays = 7,
  className,
  defaultFilter,
  empty,
  entries,
  fields,
  filter: controlledFilter,
  filterable = false,
  formatValue,
  hasMore = false,
  headingLevel = 3,
  loading = false,
  loadingMore,
  longTextLength = 120,
  onFilterChange,
  onLoadMore,
  ref,
  size = "md",
  timeZone: timeZoneProp,
  ...props
}: ChangeHistoryProps) {
  // A zone `Intl` does not know would throw - the browser's instead
  const timeZone =
    timeZoneProp && isTimeZone(timeZoneProp) ? timeZoneProp : undefined;
  useEffect(() => {
    if (timeZoneProp && !timeZone) {
      logger.warn(
        `ChangeHistory: timeZone "${timeZoneProp}" is no IANA time zone this browser knows - the history shows the browser's zone.`,
      );
    }
  }, [timeZone, timeZoneProp]);
  const locale = useLocale();
  const messages = locale.messages.ui.changeHistory;
  const formatDate = useFormatDate();
  const formatRelative = useFormatRelativeTime(timeZone);
  const today = useToday(timeZone);
  const isHydrated = useIsHydrated();
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;

  const [ownFilter, setOwnFilter] = useState<ChangeHistoryFilter>(
    defaultFilter ?? {},
  );
  const filter = controlledFilter ?? ownFilter;
  const changeFilter = (next: ChangeHistoryFilter) => {
    if (!controlledFilter) setOwnFilter(next);
    onFilterChange?.(next);
  };

  // Loading older entries - by the promise of `onLoadMore`
  const [loadPending, setLoadPending] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const isLoadingMore = loadingMore ?? loadPending;
  // The id of the last entry when older ones were asked for - they come
  // after it - and whether the button had the focus then
  const loadRef = useRef<{ focused: boolean; last: string | null } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);

  const loadMore = (button: HTMLElement) => {
    if (!onLoadMore) return;
    const last = entries.at(-1);
    loadRef.current = {
      focused: button.ownerDocument.activeElement === button,
      last: last ? String(last.id) : null,
    };
    setLoadFailed(false);
    setAnnouncement("");
    const result = onLoadMore();
    if (!isPromiseLike(result)) return;
    setLoadPending(true);
    result.then(
      () => setLoadPending(false),
      () => {
        setLoadPending(false);
        setLoadFailed(true);
      },
    );
  };

  // Older entries arrived - said to screen readers; the focus goes to the
  // first of them when the button it was on is gone
  useLayoutEffect(() => {
    const load = loadRef.current;
    if (!load) return;
    // The older entries follow the last one there was - not an entry added
    // at the top meanwhile (a new change of the record), also once loading
    // has ended without any
    const start =
      load.last === null
        ? 0
        : entries.findIndex((entry) => String(entry.id) === load.last) + 1;
    if (start === 0 && load.last !== null) {
      // Other entries altogether - of another record
      loadRef.current = null;
      return;
    }
    if (entries.length <= start) return;
    loadRef.current = null;
    setAnnouncement(
      formatPlural(locale.code, messages.loaded, entries.length - start),
    );

    const root = rootRef.current;
    if (!load.focused || !root) return;
    const active = root.ownerDocument.activeElement;
    if (active && active !== root.ownerDocument.body && root.contains(active))
      return;
    const first = String(entries[start].id);
    [...root.querySelectorAll<HTMLElement>("[data-entry-id]")]
      .find((element) => element.dataset.entryId === first)
      ?.focus();
  }, [entries, locale.code, messages.loaded]);

  // The filters - the fields and the authors of the entries
  const fieldOptions = new Map<string, string>();
  const authorOptions = new Map<string, string>();
  for (const entry of entries) {
    authorOptions.set(
      authorKey(entry),
      entry.author ? entry.author.name : messages.system,
    );
    for (const change of entry.changes ?? []) {
      if (!fieldOptions.has(change.field)) {
        fieldOptions.set(
          change.field,
          change.label ?? fields?.[change.field]?.label ?? change.field,
        );
      }
    }
  }
  // A field or an author picked that the entries no longer have (others
  // were given) - still offered, so that the filter shows and can be undone
  if (filter.field && !fieldOptions.has(filter.field)) {
    fieldOptions.set(
      filter.field,
      fields?.[filter.field]?.label ?? filter.field,
    );
  }
  if (filter.author && !authorOptions.has(filter.author)) {
    authorOptions.set(
      filter.author,
      filter.author === SYSTEM_AUTHOR ? messages.system : filter.author,
    );
  }

  const shown = entries.flatMap((entry) => {
    if (filter.author && authorKey(entry) !== filter.author) return [];
    if (!filter.field) return [entry];
    const changes = (entry.changes ?? []).filter(
      (change) => change.field === filter.field,
    );
    return changes.length ? [{ ...entry, changes }] : [];
  });

  /** The day of an entry - `null` before the zone of the user is known. */
  const dayOf = (date: Date) => {
    const zone = timeZone ?? dateTimeZone(date);
    if (!zone && !isHydrated) return null;
    return toISODate(inTimeZone(date, zone));
  };

  const dayHeading = (day: string) => {
    if (today) {
      const todayKey = toISODate(today);
      if (day === todayKey) return messages.today;
      if (day === toISODate(addDays(today, -1))) return messages.yesterday;
    }
    const [year, month, date] = day.split("-").map(Number);
    return capitalize(
      new Intl.DateTimeFormat(toIntlLocale(locale.code), {
        day: "numeric",
        month: "long",
        weekday: "long",
        year: "numeric",
      }).format(new Date(year, month - 1, date)),
      locale.code,
    );
  };

  /** A value as the table shows it - "—" for none. */
  const renderValue = (
    value: unknown,
    change: ChangeHistoryChange,
    entry: ChangeHistoryEntry,
  ): React.ReactNode => {
    if (isEmpty(value)) {
      return (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">{messages.emptyValue}</span>
        </>
      );
    }
    const format = fields?.[change.field]?.formatValue ?? formatValue;
    if (format) return format(value, change, entry);
    return writeValue(value);
  };

  /** The default text of a value. */
  const writeValue = (value: unknown): React.ReactNode => {
    if (isValidElement(value)) return value;
    if (typeof value === "boolean") {
      return value
        ? locale.messages.ui.common.yes
        : locale.messages.ui.common.no;
    }
    if (typeof value === "number") return formatNumber(locale.code, value);
    if (value instanceof Date) {
      // A date at midnight stands for the day itself
      const zoned = inTimeZone(value, timeZone);
      const hasTime = zoned.getHours() !== 0 || zoned.getMinutes() !== 0;
      return formatDate(value, hasTime ? "dateTime" : "date", { timeZone });
    }
    if (typeof value === "string") {
      if (PICKER_DATE.test(value)) {
        return formatDate(value, value.length > 10 ? "dateTime" : "date");
      }
      if (ZONED_DATE.test(value)) {
        return formatDate(value, "dateTime", { timeZone });
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          const written = writeValue(item);
          return typeof written === "string" ? written : String(item);
        })
        .join(", ");
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  /** Whether a change of a text is compared word by word. */
  const isLongText = (change: ChangeHistoryChange) => {
    const setting = fields?.[change.field]?.diff;
    if (setting === false) return false;
    const texts = [change.from, change.to];
    if (
      texts.every(isEmpty) ||
      !texts.every((text) => typeof text === "string" || isEmpty(text))
    ) {
      return false;
    }
    if (setting) return true;
    return texts.some(
      (text) =>
        typeof text === "string" &&
        (text.length > longTextLength || text.includes("\n")),
    );
  };

  const writeTime = (date: Date) => {
    const startOfEntryDay = startOfDay(inTimeZone(date, timeZone)).getTime();
    // Whole days - one is 23 or 25 hours long when the clocks change
    const isRecent =
      !today ||
      Math.round((today.getTime() - startOfEntryDay) / 86_400_000) <=
        absoluteAfterDays;
    return isRecent
      ? formatRelative(date)
      : formatDate(date, "time", { timeZone });
  };

  const renderChanges = (entry: ChangeHistoryEntry) => {
    const changes = entry.changes ?? [];
    if (changes.length === 0) return null;

    return (
      <Table
        className="table-fixed"
        containerClassName="mt-1"
        density="compact"
      >
        <TableHead>
          <TableRow>
            <TableCell className="w-1/4" header>
              {messages.field}
            </TableCell>
            <TableCell header>{messages.from}</TableCell>
            <TableCell header>{messages.to}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {changes.map((change, index) => {
            const label =
              change.label ?? fields?.[change.field]?.label ?? change.field;
            return (
              <TableRow key={`${change.field}-${index}`}>
                <TableCell
                  className="font-medium wrap-break-word text-neutral-900 dark:text-neutral-100"
                  header
                  scope="row"
                >
                  {label}
                </TableCell>
                {isLongText(change) ? (
                  <TableCell className="wrap-break-word" colSpan={2}>
                    <LongTextChange
                      from={typeof change.from === "string" ? change.from : ""}
                      to={typeof change.to === "string" ? change.to : ""}
                    />
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="wrap-break-word text-neutral-500 dark:text-neutral-400">
                      {renderValue(change.from, change, entry)}
                    </TableCell>
                    <TableCell className="wrap-break-word">
                      {renderValue(change.to, change, entry)}
                    </TableCell>
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const toItem = (entry: ChangeHistoryEntry, date: Date | null) => {
    const author = entry.author;
    const isBuiltIn = BUILT_IN_ACTIONS.has(entry.action);
    const actionLabel = isBuiltIn
      ? messages.actions[entry.action as "created" | "updated" | "deleted"]
      : entry.action;
    const color = actionColors[entry.action] ?? "neutral";
    const avatarSize = size === "sm" ? 22 : 30;

    const item: TimelineItem = {
      color,
      content:
        entry.comment !== undefined &&
        entry.comment !== null &&
        entry.comment !== "" ? (
          <>
            {renderChanges(entry)}
            <blockquote className="mt-2 border-s-2 border-neutral-300 ps-3 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300">
              <span className="sr-only">{messages.comment} </span>
              {entry.comment}
            </blockquote>
          </>
        ) : (
          renderChanges(entry)
        ),
      description: date ? (
        <time
          dateTime={date.toISOString()}
          title={formatDate(date, "dateTime", { timeZone }) || undefined}
        >
          {writeTime(date)}
        </time>
      ) : undefined,
      icon: author ? (
        <Avatar
          alt=""
          color="auto"
          name={author.name}
          size={avatarSize}
          src={author.avatarUrl}
        />
      ) : (
        <Cog />
      ),
      id: entry.id,
      title: (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="rounded-sm font-semibold focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
            data-entry-id={entry.id}
            tabIndex={-1}
          >
            {author ? author.name : messages.system}
          </span>
          <Chip color={color} size="sm">
            {actionLabel}
          </Chip>
        </span>
      ),
    };
    return item;
  };

  // Consecutive entries of the same day under its heading - one list
  // without headings before the zone of the user is known. A day the
  // entries come back to (not in order) is another list, with a key of its
  // own.
  const days: { day: string | null; items: TimelineItem[]; key: string }[] = [];
  const listsOfDay = new Map<string, number>();
  for (const entry of shown) {
    const date = toDate(entry.time);
    const day = date ? dayOf(date) : null;
    const last = days.at(-1);
    const item = toItem(entry, date);
    if (last && last.day === day) {
      last.items.push(item);
      continue;
    }
    const name = day ?? "all";
    const count = (listsOfDay.get(name) ?? 0) + 1;
    listsOfDay.set(name, count);
    days.push({
      day,
      items: [item],
      key: count > 1 ? `${name}-${count}` : name,
    });
  }

  const setRoot = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element;
      const detach = attachRef(ref, element);
      return () => {
        if (rootRef.current === element) rootRef.current = null;
        detach();
      };
    },
    [ref],
  );

  const showFilters = filterable && entries.length > 0;
  const showLoadMore = !!onLoadMore && hasMore && !loading;

  return (
    <div
      {...props}
      className={cn("flex flex-col gap-4 text-sm", className)}
      ref={setRoot}
    >
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <div className="w-full sm:w-56">
            <Select
              aria-label={messages.field}
              dim="sm"
              onChange={(event) =>
                changeFilter({
                  ...filter,
                  field: event.target.value || undefined,
                })
              }
              options={[
                { label: messages.allFields, value: "" },
                ...[...fieldOptions].map(([value, label]) => ({
                  label,
                  value,
                })),
              ]}
              // No value of a read-only form the history is in
              readOnly={false}
              value={filter.field ?? ""}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              aria-label={messages.author}
              dim="sm"
              onChange={(event) =>
                changeFilter({
                  ...filter,
                  author: event.target.value || undefined,
                })
              }
              options={[
                { label: messages.allAuthors, value: "" },
                ...[...authorOptions].map(([value, label]) => ({
                  label,
                  value,
                })),
              ]}
              readOnly={false}
              value={filter.author ?? ""}
            />
          </div>
        </div>
      )}

      {loading ? (
        <Timeline items={[]} loading size={size} />
      ) : shown.length === 0 ? (
        (entries.length === 0 && empty) || (
          <EmptyState
            headingLevel={headingLevel}
            icon={<History />}
            size="sm"
            title={entries.length === 0 ? messages.empty : messages.noMatches}
          />
        )
      ) : (
        days.map(({ day, items, key }, index) => (
          <div key={key}>
            {day && (
              <Heading
                className="mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
                id={`${headingId}-${index}`}
              >
                {dayHeading(day)}
              </Heading>
            )}
            <Timeline
              aria-labelledby={day ? `${headingId}-${index}` : undefined}
              items={items}
              size={size}
            />
          </div>
        ))
      )}

      {showLoadMore && (
        <div>
          <Button
            loading={isLoadingMore}
            onClick={(event) => loadMore(event.currentTarget)}
            size="sm"
            variant="outline"
          >
            {messages.loadMore}
          </Button>
        </div>
      )}
      {loadFailed && !isLoadingMore && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-danger-700 dark:text-danger-300"
          role="alert"
        >
          <span>{messages.loadError}</span>
          <Button
            onClick={(event) => loadMore(event.currentTarget)}
            size="sm"
            variant="outline"
          >
            {messages.retry}
          </Button>
        </div>
      )}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
