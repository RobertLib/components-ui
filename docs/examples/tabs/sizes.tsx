import { Tabs } from "components-ui";

const items = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

export default function Sizes() {
  return (
    <div className="space-y-3">
      <Tabs items={items} size="sm" value="week" />
      <Tabs items={items} size="md" value="week" />
      <Tabs items={items} size="lg" value="week" />
      <Tabs items={[]} loading loadingTabsCount={3} />
    </div>
  );
}
