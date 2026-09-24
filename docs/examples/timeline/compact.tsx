import { Timeline } from "components-ui";

// Compact, e.g. in a sidebar - the times here are texts of the app
export default function Compact() {
  return (
    <div className="max-w-xs">
      <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
      <Timeline
        items={[
          { time: "5 min ago", title: "Order 2026-0107 shipped" },
          {
            color: "warning",
            time: "1 hour ago",
            title: "HDMI cables are running low",
          },
          {
            color: "danger",
            time: "Yesterday",
            title: "Payment of invoice 2026-0042 failed",
          },
          { color: "neutral", time: "Monday", title: "Price list updated" },
        ]}
        size="sm"
      />
    </div>
  );
}
