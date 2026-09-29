import { useState } from "react";
import {
  Calendar,
  type CalendarBusinessHours,
  type CalendarEvent,
} from "components-ui";
import { sampleEvents } from "./events";

// Mornings and afternoons with a lunch break, and a short Friday
const businessHours: CalendarBusinessHours[] = [
  { days: [1, 2, 3, 4], end: "12:00", start: "08:00" },
  { days: [1, 2, 3, 4], end: "17:00", start: "13:00" },
  { days: [5], end: "14:00", start: "08:00" },
];

let nextId = 1;

export default function WorkWeek() {
  const [events, setEvents] = useState<CalendarEvent[]>(sampleEvents);

  return (
    <Calendar
      businessHours={businessHours}
      dayEndHour={19}
      events={events}
      // Monday to Friday - no Saturday (6) and Sunday (0)
      hiddenDays={[0, 6]}
      initialView="week"
      // A meeting of quarters of an hour, in the working hours only
      onSlotDragEnd={({ end, start }) =>
        setEvents((current) => [
          ...current,
          {
            color: "green",
            end,
            id: `meeting-${nextId++}`,
            start,
            title: "New meeting",
          },
        ])
      }
      restrictToBusinessHours
      slotDuration={15}
    />
  );
}
