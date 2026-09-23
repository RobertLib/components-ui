import { DateTimePicker } from "components-ui";

export default function Types() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DateTimePicker label="Date" name="date" type="date" />
      <DateTimePicker label="Time" name="time" type="time" />
      <DateTimePicker label="Date and time" name="at" type="datetime-local" />
      <DateTimePicker label="Month" name="month" type="month" />
      <DateTimePicker label="Week" name="week" type="week" />
    </div>
  );
}
