import { DateRangePicker, DateTimePicker } from "components-ui";

// A right-to-left page - `dir="rtl"` on the element or the whole document
export default function RightToLeft() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2" dir="rtl">
      <DateTimePicker defaultValue="2026-09-24" label="Date" type="date" />
      <DateRangePicker
        defaultValue={{ end: "2026-09-30", start: "2026-09-24" }}
        label="Range"
      />
    </div>
  );
}
