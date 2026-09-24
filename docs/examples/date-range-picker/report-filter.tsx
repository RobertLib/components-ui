import { useState } from "react";
import { DateRangePicker, type DateRange } from "components-ui";

/** `YYYY-MM-DD` of the day `days` days before today, in local time. */
function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// The filter of a sales report: past days only, at most a year at once
export default function ReportFilter() {
  const [period, setPeriod] = useState<DateRange | null>(() => ({
    end: daysAgo(0),
    start: daysAgo(29),
  }));

  return (
    <div className="space-y-3">
      <div className="max-w-sm">
        <DateRangePicker
          description="Up to one year, today at the latest."
          label="Period"
          max={daysAgo(0)}
          maxDays={366}
          onChange={setPeriod}
          presets
          value={period}
        />
      </div>
      <p className="text-sm">
        Value: <code>{JSON.stringify(period)}</code>
      </p>
    </div>
  );
}
