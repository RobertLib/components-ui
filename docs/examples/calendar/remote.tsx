import { useEffect, useState } from "react";
import {
  Calendar,
  getCalendarVisibleRange,
  useLocale,
  type CalendarEvent,
  type CalendarView,
} from "components-ui";
import { sampleEvents } from "./events";

// Load only the events the view shows: the range changes as the user
// navigates or switches the view
export default function Remote() {
  const { code, weekStartsOn } = useLocale();
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [loaded, setLoaded] = useState<{
    events: CalendarEvent[];
    key: string;
  }>();

  const range = getCalendarVisibleRange(date, view, weekStartsOn);
  const key = `${range.start.toISOString()}/${range.end.toISOString()}`;

  useEffect(() => {
    // e.g. fetch(`/api/events?from=${range.start.toISOString()}&to=…`)
    const timer = setTimeout(
      () =>
        setLoaded({
          events: sampleEvents.filter(
            (event) => event.start < range.end && event.end > range.start,
          ),
          key,
        }),
      500,
    );
    return () => clearTimeout(timer);
    // `key` stands for the range
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const format = (value: Date) => value.toLocaleDateString(code);

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Visible range: <code>{format(range.start)}</code> –{" "}
        <code>{format(range.end)}</code> (end exclusive)
      </p>
      <Calendar
        currentDate={date}
        events={loaded?.events ?? []}
        loading={loaded?.key !== key}
        onViewChange={setView}
        setCurrentDate={setDate}
        view={view}
      />
    </div>
  );
}
