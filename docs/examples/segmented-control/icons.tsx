import { CalendarDays, LayoutGrid, List, Table } from "lucide-react";
import { SegmentedControl } from "components-ui";

export default function Icons() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Icons alone need a name - it is their tooltip too */}
      <SegmentedControl
        aria-label="View"
        defaultValue="list"
        options={[
          { "aria-label": "List", icon: <List size={16} />, value: "list" },
          {
            "aria-label": "Board",
            icon: <LayoutGrid size={16} />,
            value: "board",
          },
          {
            "aria-label": "Calendar",
            icon: <CalendarDays size={16} />,
            value: "calendar",
          },
        ]}
      />
      <SegmentedControl
        aria-label="Layout"
        defaultValue="table"
        options={[
          { icon: <Table size={16} />, label: "Table", value: "table" },
          { icon: <LayoutGrid size={16} />, label: "Cards", value: "cards" },
        ]}
      />
    </div>
  );
}
