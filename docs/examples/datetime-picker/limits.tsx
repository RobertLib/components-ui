import { DateTimePicker } from "components-ui";

/** `YYYY-MM-DD` of a date in local time. */
const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Only the next 14 days can be picked; the time in 15-minute steps, and a
// night shift over midnight
export default function Limits() {
  const today = new Date();
  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(today.getDate() + 14);

  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <DateTimePicker
        description="Within the next two weeks."
        label="Delivery day"
        max={toISODate(inTwoWeeks)}
        min={toISODate(today)}
        type="date"
      />
      <DateTimePicker
        description="Every quarter of an hour."
        label="Pickup time"
        minuteStep={15}
        type="time"
      />
      <DateTimePicker
        label="Night shift start"
        max="06:00"
        min="22:00"
        minuteStep={30}
        type="time"
      />
    </div>
  );
}
