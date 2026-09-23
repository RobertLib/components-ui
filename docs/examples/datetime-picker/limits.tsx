import { DateTimePicker } from "components-ui";

/** `YYYY-MM-DD` of a date in local time. */
const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Only the next 14 days can be picked; the time in 15-minute steps
export default function Limits() {
  const today = new Date();
  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(today.getDate() + 14);

  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <DateTimePicker
        label="Delivery day"
        max={toISODate(inTwoWeeks)}
        min={toISODate(today)}
        type="date"
      />
      <DateTimePicker label="Pickup time" minuteStep={15} type="time" />
    </div>
  );
}
