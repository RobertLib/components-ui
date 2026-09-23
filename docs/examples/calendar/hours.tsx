import { Calendar } from "components-ui";
import { sampleEvents } from "./events";

// A day from 6:00 to 20:00, only the week and day views
export default function Hours() {
  return (
    <Calendar
      dayEndHour={20}
      dayStartHour={6}
      events={sampleEvents}
      initialView="day"
      viewOptions={["week", "day"]}
    />
  );
}
