import type { CalendarEvent, CalendarViewProps } from "./types";
import type { Locale } from "../../i18n/types";
import { addCalendarDays, daysBetween, getCalendarDay } from "./date-utils";
import {
  createDayFormat,
  createTimeFormat,
  getAllDayRange,
  getColorStyles,
  isOnDay,
} from "./utils";
import { useEffect, useId, useMemo, useRef } from "react";
import cn from "../../utils/cn";
import EventTile from "./event-tile";
import EventTitle from "./event-title";
import Spinner from "../spinner";
import {
  capitalize,
  isSameDay,
  parseISODate,
  startOfDay,
  toISODate,
} from "../../utils/date";
import { formatMessage } from "../../i18n/format";
import useIsHydrated from "../../hooks/use-is-hydrated";
import { useLocale } from "../../providers/ui-context";

/** An event on a day of the agenda. */
interface AgendaItem {
  /** Which of the days of the event the day is - 1 the first. */
  day: number;
  /** The days the event shows on. */
  days: number;
  event: CalendarEvent;
  /** When it takes place that day - "9:00 – 10:00 AM", "from 8:00 PM", … */
  time: string;
}

/** A day of the agenda with its events, in their order. */
interface AgendaDay {
  date: Date;
  items: AgendaItem[];
}

/**
 * The part of an event on `day`, as the agenda shows it: the times of an
 * event of one day; "from" its start on the first of several days, "until"
 * its end on the last, "All day" on the days between and for all-day
 * events.
 */
function toAgendaItem(
  event: CalendarEvent,
  day: Date,
  locale: Locale,
  timeFormat: Intl.DateTimeFormat,
): AgendaItem {
  const { messages } = locale;
  const { end, start } = event.allDay ? getAllDayRange(event) : event;
  // The days it shows on - the end is exclusive
  const firstDay = startOfDay(start);
  const lastDay =
    end > start ? startOfDay(new Date(end.getTime() - 1)) : firstDay;
  const days = daysBetween(firstDay, lastDay) + 1;
  const index = daysBetween(firstDay, day) + 1;

  const allDay = capitalize(messages.calendar.allDay, locale.code);
  // It starts before the day, or runs into the next one
  const fromMidnight = start.getTime() <= startOfDay(day).getTime();
  const toMidnight = end.getTime() >= addCalendarDays(day, 1).getTime();

  let time: string;
  if (event.allDay || (fromMidnight && toMidnight)) {
    time = allDay;
  } else if (days > 1 && index === 1) {
    time = formatMessage(messages.calendar.from, {
      time: timeFormat.format(start),
    });
  } else if (days > 1) {
    time = formatMessage(messages.calendar.until, {
      time: timeFormat.format(end),
    });
  } else if (end <= start) {
    time = timeFormat.format(start);
  } else if (toMidnight) {
    // `formatRange` would add the dates of the two days
    time = `${timeFormat.format(start)} – ${timeFormat.format(end)}`;
  } else {
    time = timeFormat.formatRange(start, end);
  }

  return { day: index, days, event, time };
}

/**
 * Scrolls the agenda to today - to the first day with events from today
 * on - when its period has today; to its start otherwise. A page does not
 * scroll: only an agenda of a fixed height (`stickyHeader`).
 */
function scrollToToday(
  scroller: HTMLElement | null,
  range: { end: Date; start: Date },
) {
  if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;

  const today = startOfDay(new Date());
  const target =
    today >= range.start && today < range.end
      ? Array.from(scroller.querySelectorAll<HTMLElement>("[data-date]")).find(
          (item) => {
            const day = parseISODate(item.dataset.date);
            return day !== null && day >= today;
          },
        )
      : undefined;

  scroller.scrollTop = target
    ? scroller.scrollTop +
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top
    : 0;
}

/**
 * The agenda view: the events of the period (`visibleRange`) as a list
 * grouped by day - all-day events first, then by start. An event over
 * several days is listed on each of them, marked with its day. Clickable
 * events are buttons, reached by Tab.
 */
export default function AgendaView({
  events,
  getEventColor,
  getEventLabel,
  isEventClickable,
  loading,
  maxDate,
  minDate,
  onDateClick,
  onEventClick,
  renderEventActions,
  renderEventIcon,
  resources,
  stickyHeader = true,
  visibleRange,
}: CalendarViewProps) {
  const locale = useLocale();
  const { messages } = locale;
  const headingId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const rangeStart = visibleRange.start.getTime();
  const rangeEnd = visibleRange.end.getTime();

  const agendaDays = useMemo(() => {
    const timeFormat = createTimeFormat(locale);
    const result: AgendaDay[] = [];

    // Day by day from the first - each at its own start, also after a day
    // a daylight saving change starts at 1:00, and none the time zone skips
    const first = new Date(rangeStart);
    for (
      let index = 0;
      addCalendarDays(first, index).getTime() < rangeEnd;
      index++
    ) {
      const date = getCalendarDay(first, index);
      if (!date) continue;
      const items = events
        .filter((event) => isOnDay(event, date))
        .map((event) => toAgendaItem(event, date, locale, timeFormat));
      if (items.length > 0) result.push({ date, items });
    }

    return result;
  }, [events, locale, rangeEnd, rangeStart]);

  const resourceTitles = useMemo(
    () => new Map(resources?.map((resource) => [resource.id, resource.title])),
    [resources],
  );

  // Unknown on the server and while a server-rendered page hydrates - its
  // clock and time zone may differ from the browser's
  const isHydrated = useIsHydrated();
  const today = isHydrated ? new Date() : null;

  // A new period opens at today - once its events are there
  const scrolledRangeRef = useRef<string | null>(null);
  useEffect(() => {
    const rangeKey = `${rangeStart}/${rangeEnd}`;
    if (loading || scrolledRangeRef.current === rangeKey) return;
    scrolledRangeRef.current = rangeKey;
    scrollToToday(scrollRef.current, {
      end: new Date(rangeEnd),
      start: new Date(rangeStart),
    });
  });

  const dayFormat = createDayFormat(locale);

  const isClickable = (event: CalendarEvent) =>
    !!onEventClick && (isEventClickable?.(event) ?? true);

  const renderItem = ({ day, days, event, time }: AgendaItem) => {
    const clickable = isClickable(event);
    const resourceTitle =
      event.resourceId === undefined
        ? undefined
        : resourceTitles.get(event.resourceId);
    // An event over several days - which of them this is
    const dayOf =
      days > 1
        ? formatMessage(messages.calendar.dayOf, { count: days, day })
        : undefined;
    const details = [resourceTitle, dayOf].filter(Boolean).join(" · ");

    return (
      <li key={event.id}>
        <EventTile
          actions={renderEventActions?.(event)}
          // In the row, not over its text
          actionsClassName="relative! top-auto! right-auto! ml-2 shrink-0 self-center"
          className={cn(
            "relative flex px-3 py-2 text-sm",
            clickable
              ? "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
              : "cursor-default",
          )}
          clickable={clickable}
          contentClassName="flex min-w-0 flex-1 items-start gap-3"
          label={
            dayOf ? `${getEventLabel(event)}, ${dayOf}` : getEventLabel(event)
          }
          onOpen={() => onEventClick?.(event)}
          title={event.tooltip}
        >
          {/* The label of the tile says it all to screen readers */}
          <span
            aria-hidden="true"
            className="w-24 shrink-0 text-xs leading-5 text-neutral-600 tabular-nums sm:w-40 sm:text-sm dark:text-neutral-400"
          >
            {time}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 size-2.5 shrink-0 rounded-full border-[5px]",
              getColorStyles(getEventColor(event))[2],
            )}
          />
          <span className="min-w-0 flex-1 leading-5">
            <span className="block font-medium break-words text-neutral-900 dark:text-neutral-100">
              {/* Optional custom icon renderer */}
              {renderEventIcon?.(event)}
              <EventTitle event={event}>{event.title}</EventTitle>
            </span>
            {details && (
              <span
                aria-hidden="true"
                className="block text-xs text-neutral-500 dark:text-neutral-400"
              >
                {details}
              </span>
            )}
          </span>
        </EventTile>
      </li>
    );
  };

  return (
    <div
      className={cn(
        "agenda-view relative",
        stickyHeader ? "h-150 overflow-y-auto" : "min-h-40",
      )}
      ref={scrollRef}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {agendaDays.length > 0 ? (
        <ol>
          {agendaDays.map(({ date, items }) => {
            const iso = toISODate(date);
            const id = `${headingId}${iso}`;
            const label = capitalize(dayFormat.format(date), locale.code);
            const isToday = today !== null && isSameDay(date, today);
            const disabled = !!(
              (minDate && addCalendarDays(date, 1) <= minDate) ||
              (maxDate && date > maxDate)
            );

            return (
              <li data-date={iso} key={iso}>
                {/* The id is on its text - a table of contents looking for
                    headings with an id leaves the days out */}
                <h3
                  className={cn(
                    "flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-semibold dark:border-neutral-800 dark:bg-neutral-800",
                    stickyHeader && "sticky top-0 z-10",
                    disabled
                      ? "text-neutral-500 dark:text-neutral-400"
                      : isToday
                        ? "text-primary-700 dark:text-primary-300"
                        : "text-neutral-700 dark:text-neutral-200",
                  )}
                >
                  {onDateClick && !disabled ? (
                    <button
                      aria-current={isToday ? "date" : undefined}
                      className="rounded-sm text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      id={id}
                      onClick={() => onDateClick(date)}
                      type="button"
                    >
                      {label}
                    </button>
                  ) : (
                    <span aria-current={isToday ? "date" : undefined} id={id}>
                      {label}
                    </span>
                  )}
                  {isToday && (
                    <span className="rounded-full bg-primary-600 px-2 text-xs leading-5 font-medium text-white">
                      {messages.calendar.today}
                    </span>
                  )}
                </h3>
                <ul
                  aria-labelledby={id}
                  className={cn(
                    "divide-y divide-neutral-100 border-b border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800",
                    disabled && "opacity-60",
                  )}
                >
                  {items.map(renderItem)}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        // Not on the server - the events come after the hydration
        !loading &&
        isHydrated && (
          <p className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {messages.calendar.noEvents}
          </p>
        )
      )}
    </div>
  );
}
