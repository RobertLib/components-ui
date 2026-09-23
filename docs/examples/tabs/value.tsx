import { useState } from "react";
import { Tabs } from "components-ui";

export default function ValueTabs() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-4">
      <Tabs
        items={[
          { label: "Overview", value: "overview" },
          { label: "Invoices", value: "invoices" },
          { label: "Settings", value: "settings" },
        ]}
        onChange={setTab}
        value={tab}
      />
      <p className="text-sm">
        Showing the <strong>{tab}</strong> tab.
      </p>
    </div>
  );
}
