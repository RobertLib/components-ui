import { useState } from "react";
import { SegmentedControl } from "components-ui";

const periods = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

export default function Basic() {
  const [period, setPeriod] = useState("week");

  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Period"
        onChange={setPeriod}
        options={periods}
        value={period}
      />
      <p className="text-sm">
        Revenue of the last <strong>{period}</strong>
      </p>
    </div>
  );
}
