import { DateRangePicker } from "components-ui";

/** `YYYY-MM-DD` of the day `days` days from today, in local time. */
function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// A leave request from tomorrow on, and a stay of at least one night
export default function Limits() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <DateRangePicker
        description="Two weeks at most, within the next year."
        label="Leave"
        max={inDays(365)}
        maxDays={14}
        min={inDays(1)}
      />
      <DateRangePicker
        description="Check-in and check-out day."
        label="Stay"
        min={inDays(0)}
        minDays={2}
      />
    </div>
  );
}
