import { DateRangePicker } from "components-ui";

// Built-in presets by their key, and ranges of your own
export default function Presets() {
  return (
    <div className="max-w-sm">
      <DateRangePicker
        label="Accounting period"
        presets={[
          "thisWeek",
          "lastWeek",
          "thisMonth",
          "lastMonth",
          "thisYear",
          {
            label: "Q1 2026",
            range: { end: "2026-03-31", start: "2026-01-01" },
          },
          {
            label: "Q2 2026",
            range: { end: "2026-06-30", start: "2026-04-01" },
          },
          {
            label: "Q3 2026",
            range: { end: "2026-09-30", start: "2026-07-01" },
          },
        ]}
      />
    </div>
  );
}
