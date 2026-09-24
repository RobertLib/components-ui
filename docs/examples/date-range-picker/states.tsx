import { DateRangePicker } from "components-ui";

const september = { end: "2026-09-30", start: "2026-09-01" };

export default function States() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <DateRangePicker
        error="Select the period of the report."
        label="With an error"
        required
      />
      <DateRangePicker defaultValue={september} label="Read-only" readOnly />
      <DateRangePicker defaultValue={september} disabled label="Disabled" />
      <DateRangePicker
        defaultValue={september}
        dim="sm"
        label="Small"
        presets
      />
    </div>
  );
}
