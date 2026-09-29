import { DateTimePicker } from "components-ui";

/** `YYYY-MM-DD` of the day `days` days from today, in local time. */
function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Today and Clear under the days, days of your own beside them
export default function PopupActions() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <DateTimePicker
        label="Due date"
        min={inDays(0)}
        presets={[
          { label: "Tomorrow", value: inDays(1) },
          { label: "In 3 days", value: inDays(3) },
          { label: "In a week", value: inDays(7) },
          { label: "In 30 days", value: inDays(30) },
        ]}
        type="date"
      />
      <DateTimePicker
        defaultValue={inDays(0)}
        label="Without the buttons"
        popupActions={false}
        type="date"
      />
    </div>
  );
}
