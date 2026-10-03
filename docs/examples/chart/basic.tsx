import { Chart, SegmentedControl, type ChartProps } from "components-ui";
import { useState } from "react";

const data = [
  { label: "Jan", revenue: 12000, cost: 8400 },
  { label: "Feb", revenue: 14600, cost: 9600 },
  { label: "Mar", revenue: 13200, cost: null },
  { label: "Apr", revenue: 18800, cost: 11800 },
  { label: "May", revenue: 21600, cost: 13700 },
  { label: "Jun", revenue: 24200, cost: 14900 },
];

export default function Basic() {
  const [type, setType] = useState<NonNullable<ChartProps["type"]>>("line");
  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Chart type"
        onChange={setType}
        options={[
          { label: "Line", value: "line" },
          { label: "Area", value: "area" },
          { label: "Bar", value: "bar" },
        ]}
        value={type}
      />
      <Chart
        data={data}
        description="Revenue grew every quarter. The March cost report is missing."
        formatOptions={{
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }}
        series={[
          { key: "revenue", label: "Revenue", color: "primary" },
          { key: "cost", label: "Cost", color: "warning" },
        ]}
        title="Revenue and costs"
        type={type}
      />
    </div>
  );
}
