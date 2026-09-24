import { useState } from "react";
import { Button, Panel, Stat } from "components-ui";

export default function InOnePanel() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 1500);
        }}
        size="sm"
      >
        Reload
      </Button>
      {/* Several stats in one card, divided by lines */}
      <Panel
        border="neutral"
        className="grid divide-y divide-neutral-200 p-0! sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-neutral-800"
        shadow="none"
      >
        <Stat
          change={0.052}
          className="p-5"
          description="vs last week"
          label="Paid invoices"
          loading={loading}
          value={312}
        />
        <Stat
          change={0.21}
          className="p-5"
          description="vs last week"
          formatOptions={{ currency: "EUR", style: "currency" }}
          invertTrend
          label="Overdue"
          loading={loading}
          value={18250}
        />
        <Stat
          change={0}
          className="p-5"
          description="vs last week"
          formatOptions={{ maximumFractionDigits: 1, style: "percent" }}
          label="Conversion"
          loading={loading}
          value={0.034}
        />
      </Panel>
    </div>
  );
}
