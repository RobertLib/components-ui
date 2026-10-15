import { DateTimePicker } from "components-ui";

// Reports by quarter and by fiscal year - the values are ISO 8601,
// "2026-Q3" and "2026"
export default function Periods() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <DateTimePicker
        defaultValue="2026-Q3"
        description="Type Q3 2026, 3/2026 or 2026-Q3."
        label="VAT return period"
        max="2026-Q4"
        min="2024-Q1"
        name="period"
        presets={[
          { label: "Q1 2026", value: "2026-Q1" },
          { label: "Q2 2026", value: "2026-Q2" },
          { label: "Q3 2026", value: "2026-Q3" },
          { label: "Q4 2026", value: "2026-Q4" },
        ]}
        type="quarter"
      />
      <DateTimePicker
        defaultValue="2026"
        label="Fiscal year"
        max={2027}
        min={2015}
        name="fiscalYear"
        type="year"
      />
    </div>
  );
}
