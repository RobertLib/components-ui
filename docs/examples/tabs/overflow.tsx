import { useState } from "react";
import { Tabs } from "components-ui";

const statuses = [
  "All",
  "Draft",
  "Waiting for approval",
  "Approved",
  "In production",
  "Shipped",
  "Delivered",
  "Returned",
  "Cancelled",
];

// Wider than its container, the bar scrolls sideways: the edges with more
// tabs fade out and the selected tab is kept in view
export default function OverflowTabs() {
  const [status, setStatus] = useState("Shipped");

  return (
    <div className="max-w-md">
      <Tabs
        items={statuses.map((label) => ({ label, value: label }))}
        onChange={setStatus}
        size="sm"
        value={status}
      />
    </div>
  );
}
