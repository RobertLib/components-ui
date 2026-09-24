import { useState } from "react";
import { TreeView, type TreeItem } from "components-ui";

const regions: TreeItem<string>[] = [
  {
    children: [
      { id: "cz", label: "Czechia" },
      { id: "de", label: "Germany" },
      { id: "at", label: "Austria" },
      { id: "pl", label: "Poland" },
    ],
    id: "europe",
    label: "Europe",
  },
  {
    children: [
      { id: "us", label: "United States" },
      { id: "ca", label: "Canada" },
      { id: "br", label: "Brazil" },
    ],
    id: "americas",
    label: "Americas",
  },
  {
    children: [
      { id: "jp", label: "Japan" },
      { id: "sg", label: "Singapore" },
    ],
    id: "asia",
    label: "Asia",
  },
];

export default function Multiple() {
  const [selected, setSelected] = useState(["cz", "de"]);

  return (
    <div className="space-y-3">
      <TreeView
        aria-label="Markets in the report"
        defaultExpanded={["europe", "americas"]}
        items={regions}
        onSelectedChange={setSelected}
        selected={selected}
        selectionMode="multiple"
      />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {selected.length} selected: {selected.join(", ")}
      </p>
    </div>
  );
}
