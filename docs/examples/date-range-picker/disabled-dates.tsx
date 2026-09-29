import { DateRangePicker } from "components-ui";

/** `YYYY-MM-DD` of the day `days` days from today, in local time. */
function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Booked nights - e.g. loaded from an API
const booked = new Set([inDays(3), inDays(4), inDays(12)]);

/** `YYYY-MM-DD` of a date in local time. */
const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const isWeekend = (day: Date) => day.getDay() === 0 || day.getDay() === 6;

// A stay cannot reach over a booked night; a leave may reach over a
// weekend, but neither starts nor ends on one
export default function DisabledDates() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <DateRangePicker
        description="A range stops before the nearest booked night."
        isDateDisabled={(day) => booked.has(toISODate(day))}
        label="Stay"
        min={inDays(0)}
      />
      <DateRangePicker
        allowDisabledInRange
        description="From a working day to a working day."
        isDateDisabled={isWeekend}
        label="Leave"
        presets={["thisWeek", "lastWeek"]}
      />
    </div>
  );
}
