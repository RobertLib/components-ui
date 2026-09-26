import { Repeat } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Calendar,
  Dialog,
  DialogFooter,
  type CalendarEvent,
  type EventTimeChange,
} from "components-ui";
import { at } from "./events";

const today = new Date();
// This week's Monday, the last day and the last Friday of last month
const monday = at(-((today.getDay() + 6) % 7), 9);
const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
const lastFriday = new Date(lastDay);
lastFriday.setDate(lastDay.getDate() - ((lastDay.getDay() + 2) % 7));
lastFriday.setHours(15);

const minutesLater = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

const initialEvents: CalendarEvent[] = [
  {
    color: "blue",
    end: minutesLater(monday, 15),
    id: "standup",
    // Every working day
    recurrence: { byWeekday: [1, 2, 3, 4, 5], freq: "weekly" },
    start: monday,
    title: "Stand-up",
  },
  {
    color: "green",
    end: at(1, 15),
    id: "one-on-one",
    // An iCalendar rule - every other week, six times
    recurrence: "FREQ=WEEKLY;INTERVAL=2;COUNT=6",
    start: at(1, 14),
    title: "1:1 with Petra",
  },
  {
    allDay: true,
    color: "purple",
    end: new Date(
      lastDay.getFullYear(),
      lastDay.getMonth(),
      lastDay.getDate() + 1,
    ),
    id: "payroll",
    // The last day of each month
    recurrence: { byMonthDay: [-1], freq: "monthly" },
    start: lastDay,
    title: "Payroll",
  },
  {
    color: "yellow",
    end: minutesLater(lastFriday, 60),
    id: "review",
    // The last Friday of each month
    recurrence: "FREQ=MONTHLY;BYDAY=-1FR",
    start: lastFriday,
    title: "Sprint review",
  },
];

/** A change of an occurrence waiting for "this one or all of them?". */
type Pending = { change?: EventTimeChange; event: CalendarEvent };

// `date` moved like an occurrence from `from` to `to` - by days and by the
// clock, not by milliseconds: a day over a daylight saving change has 23 or
// 25 hours, and the series would end up an hour off its time
const shift = (date: Date, from: Date, to: Date) => {
  const days = Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000,
  );
  const minutes =
    to.getHours() * 60 +
    to.getMinutes() -
    (from.getHours() * 60 + from.getMinutes());

  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

export default function Recurring() {
  const [events, setEvents] = useState(initialEvents);
  const [pending, setPending] = useState<Pending | null>(null);

  // Only this occurrence
  const changeOccurrence = ({ change, event }: Pending) =>
    setEvents((current) => {
      // One changed before is an event of the app already
      const others = current.filter((item) => item.id !== event.id);
      if (change) {
        // Moved: it replaces the occurrence - it keeps `recurringEventId`
        // and `occurrenceStart`
        return [
          ...others,
          { ...event, end: change.newEnd, start: change.newStart },
        ];
      }
      // Deleted: left out of the series
      return others.map((item) =>
        item.id === event.recurringEventId
          ? {
              ...item,
              exdates: [...(item.exdates ?? []), event.occurrenceStart!],
            }
          : item,
      );
    });

  // The whole series - moved like the occurrence, or deleted. Its changed
  // occurrences go with it: they follow the series again
  const changeSeries = ({ change, event }: Pending) =>
    setEvents((current) => {
      const others = current.filter(
        (item) => item.recurringEventId !== event.recurringEventId,
      );
      if (!change) {
        return others.filter((item) => item.id !== event.recurringEventId);
      }

      const moved = (date: Date) => shift(date, event.start, change.newStart);
      return others.map((item) =>
        item.id === event.recurringEventId
          ? {
              ...item,
              end: shift(item.end, event.end, change.newEnd),
              // The left-out occurrences move along
              exdates: item.exdates?.map(moved),
              start: moved(item.start),
            }
          : item,
      );
    });

  const decide = (apply: (pending: Pending) => void) => {
    if (pending) apply(pending);
    setPending(null);
  };

  const move = (change: EventTimeChange) =>
    setPending({ change, event: change.event });

  return (
    <>
      <Calendar
        events={events}
        initialView="week"
        onEventClick={(event) => setPending({ event })}
        onEventDrop={move}
        onEventResize={move}
        renderEventIcon={(event) =>
          event.recurringEventId ? (
            <Repeat aria-hidden className="mr-1 inline" size={12} />
          ) : null
        }
        viewOptions={["week", "month", "agenda"]}
      />
      <Dialog
        onClose={() => setPending(null)}
        open={!!pending}
        size="md"
        title={
          pending?.change
            ? "Move a repeating event"
            : "Delete a repeating event"
        }
      >
        <p className="mb-16 text-sm">
          Only this occurrence of “{pending?.event.title}”, or all of them?
        </p>
        <DialogFooter>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setPending(null)} variant="outline">
              Cancel
            </Button>
            <Button onClick={() => decide(changeOccurrence)} variant="outline">
              This occurrence
            </Button>
            <Button onClick={() => decide(changeSeries)}>
              All occurrences
            </Button>
          </div>
        </DialogFooter>
      </Dialog>
    </>
  );
}
