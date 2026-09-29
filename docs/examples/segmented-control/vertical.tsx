import { Columns3, LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { SegmentedControl } from "components-ui";

export default function Vertical() {
  const [view, setView] = useState("list");

  return (
    <div className="flex flex-wrap items-start gap-8">
      <SegmentedControl
        label="View"
        onChange={setView}
        options={[
          { icon: <List size={16} />, label: "List", value: "list" },
          { icon: <LayoutGrid size={16} />, label: "Grid", value: "grid" },
          { icon: <Columns3 size={16} />, label: "Board", value: "board" },
        ]}
        orientation="vertical"
        value={view}
      />
      <div className="w-48">
        <SegmentedControl
          defaultValue="week"
          dim="sm"
          fullWidth
          label="Period (small, full width)"
          options={[
            { label: "Day", value: "day" },
            { label: "Week", value: "week" },
            { label: "Month", value: "month" },
          ]}
          orientation="vertical"
        />
      </div>
    </div>
  );
}
