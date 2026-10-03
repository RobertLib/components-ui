import {
  Calendar,
  Select,
  type CalendarEvent,
  type EventTimeChange,
} from "components-ui";
import { useState } from "react";

const initial: CalendarEvent[] = [
  {
    id: "weekly",
    title: "Weekly review",
    start: new Date("2026-03-22T08:00:00Z"),
    end: new Date("2026-03-22T09:00:00Z"),
    recurrence: { freq: "weekly" },
    color: "primary",
  },
  {
    id: "locked",
    title: "Locked booking",
    start: new Date("2026-03-29T10:00:00Z"),
    end: new Date("2026-03-29T11:00:00Z"),
    color: "neutral",
  },
  {
    id: "editable",
    title: "Move this meeting",
    start: new Date("2026-03-29T13:00:00Z"),
    end: new Date("2026-03-29T14:00:00Z"),
    color: "success",
  },
];

export default function TimeZonePermissions() {
  const [timeZone, setTimeZone] = useState("Europe/Prague");
  const [events, setEvents] = useState(initial);
  const apply = ({ event, newStart, newEnd }: EventTimeChange) =>
    setEvents((current) =>
      current.map((item) =>
        item.id === event.id ? { ...item, start: newStart, end: newEnd } : item,
      ),
    );
  return (
    <div className="space-y-4">
      <Select
        label="Calendar time zone"
        onChange={(event) => setTimeZone(event.target.value)}
        options={[
          { label: "Prague", value: "Europe/Prague" },
          { label: "New York", value: "America/New_York" },
        ]}
        value={timeZone}
      />
      <p className="text-sm">
        The review keeps 9:00 in Prague across the daylight saving change. The
        locked booking cannot move or resize. Move the green meeting within
        8:00–18:00.
      </p>
      <Calendar
        canDropEvent={({ newStart, newEnd }) =>
          newStart.getHours() >= 8 &&
          newEnd.getHours() <= 18 &&
          newStart.getDate() === newEnd.getDate()
        }
        canMoveEvent={(event) => event.id === "editable"}
        canResizeEvent={(event) => event.id === "editable"}
        events={events}
        initialDate={new Date("2026-03-29T12:00:00Z")}
        initialView="week"
        onEventDrop={apply}
        onEventResize={apply}
        slotDuration={30}
        timeZone={timeZone}
      />
    </div>
  );
}
