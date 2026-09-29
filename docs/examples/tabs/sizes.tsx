import { Tabs } from "components-ui";

const items = [
  { label: "Overview", value: "overview" },
  { label: "Activity", value: "activity" },
  { label: "Settings", value: "settings" },
];

export default function Sizes() {
  return (
    <div className="space-y-3">
      <Tabs items={items} size="sm" value="activity" />
      <Tabs items={items} size="md" value="activity" />
      <Tabs items={items} size="lg" value="activity" />
      <Tabs items={[]} loading loadingTabsCount={3} />
    </div>
  );
}
