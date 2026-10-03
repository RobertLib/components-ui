import { Chart, SegmentedControl, type ChartType } from "components-ui";
import { useState } from "react";
const data = [
  { label: "Jan", new: 12, existing: 20, total: 32 },
  { label: "Feb", new: 18, existing: 24, total: 42 },
  { label: "Mar", new: 22, existing: 30, total: 52 },
];
export default function Extended() {
  const [type, setType] = useState<ChartType>("bar");
  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Display"
        value={type}
        onChange={setType}
        options={[
          { label: "Stacked bars", value: "bar" },
          { label: "Stacked areas", value: "area" },
          { label: "Mixed", value: "mixed" },
        ]}
      />
      <Chart
        title="Customers"
        data={data}
        type={type}
        stacked
        series={
          type === "mixed"
            ? [
                { key: "new", label: "New", type: "bar" },
                {
                  key: "existing",
                  label: "Existing",
                  type: "bar",
                  color: "success",
                },
                {
                  key: "total",
                  label: "Total",
                  type: "line",
                  color: "warning",
                },
              ]
            : [
                { key: "new", label: "New" },
                { key: "existing", label: "Existing", color: "success" },
              ]
        }
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Chart
          title="Customers by region"
          type="pie"
          height={260}
          data={[
            { label: "Europe", count: 40 },
            { label: "Americas", count: 35 },
            { label: "Asia", count: 25 },
          ]}
          series={[{ key: "count", label: "Customers" }]}
        />
        <Chart
          title="Subscription mix"
          type="donut"
          height={260}
          data={[
            { label: "Monthly", count: 65 },
            { label: "Annual", count: 35 },
          ]}
          series={[{ key: "count", label: "Subscriptions" }]}
        />
      </div>
    </div>
  );
}
