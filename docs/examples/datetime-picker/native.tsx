import { DateTimePicker } from "components-ui";

export default function Native() {
  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <DateTimePicker label="Custom (default)" type="date" />
      <DateTimePicker label="Native" mode="native" type="date" />
    </div>
  );
}
