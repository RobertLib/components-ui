import { Panel, Stat } from "components-ui";

const revenue = [98, 104, 101, 110, 116, 112, 121, 128.4];
const churn = [0.041, 0.039, 0.043, 0.036, 0.034, 0.031, 0.029];

export default function Sparklines() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel>
        {/* The values of the chart are written like the figure */}
        <Stat
          change={0.061}
          description="vs last week"
          formatOptions={{
            currency: "EUR",
            notation: "compact",
            style: "currency",
          }}
          label="Revenue"
          sparkline={revenue.map((value) => value * 1000)}
          value={128400}
        />
      </Panel>
      <Panel>
        <Stat
          change={-0.065}
          description="vs last week"
          formatOptions={{ maximumFractionDigits: 1, style: "percent" }}
          invertTrend
          label="Churn"
          sparkline={{ color: "success", data: churn, highlightLast: true }}
          value={0.029}
        />
      </Panel>
    </div>
  );
}
