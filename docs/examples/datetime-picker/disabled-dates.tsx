import { DateTimePicker } from "components-ui";

/** `YYYY-MM-DD` of a date in local time. */
const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Public holidays - e.g. loaded from an API
const holidays = new Set(["2026-10-28", "2026-11-17", "2026-12-24"]);

const isWeekend = (day: Date) => day.getDay() === 0 || day.getDay() === 6;
const isClosed = (day: Date) => isWeekend(day) || holidays.has(toISODate(day));

// Working days only; no billing in December, no sprint over Christmas
export default function DisabledDates() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <DateTimePicker
        description="Working days - no weekends or public holidays."
        isDateDisabled={isClosed}
        label="Pickup day"
        type="date"
      />
      <DateTimePicker
        description="Working days, every half hour."
        isDateDisabled={isClosed}
        label="Appointment"
        minuteStep={30}
        type="datetime-local"
      />
      <DateTimePicker
        description="December is closed."
        isDateDisabled={(day) => day.getMonth() === 11}
        label="Billing month"
        type="month"
      />
      <DateTimePicker
        description="Not over Christmas."
        isDateDisabled={(day) => day.getMonth() === 11 && day.getDate() >= 21}
        label="Sprint week"
        type="week"
      />
    </div>
  );
}
