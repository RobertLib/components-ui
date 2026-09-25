import { Calendar, type CalendarEvent } from "components-ui";
import { at, sampleEvents } from "./events";

// The night after the hours shown - offered as "+1 later" in the header
const events: CalendarEvent[] = [
  ...sampleEvents,
  {
    color: "purple",
    end: at(0, 23),
    id: "maintenance",
    start: at(0, 21),
    title: "Server maintenance",
  },
];

// A day from 6:00 to 20:00, only the week and day views
export default function Hours() {
  return (
    <Calendar
      dayEndHour={20}
      dayStartHour={6}
      events={events}
      initialView="day"
      viewOptions={["week", "day"]}
    />
  );
}
