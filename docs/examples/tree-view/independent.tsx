import { useState } from "react";
import { TreeView, type TreeItem } from "components-ui";

// A product is listed in a category, not in everything under it - and in a
// subcategory without its parent
const categories: TreeItem<string>[] = [
  {
    children: [
      { id: "laptops", label: "Laptops" },
      { id: "tablets", label: "Tablets" },
      { id: "accessories", label: "Accessories" },
    ],
    id: "computers",
    label: "Computers",
  },
  {
    children: [
      { id: "deals", label: "Deals of the week" },
      { disabled: true, id: "clearance", label: "Clearance (closed)" },
    ],
    id: "promotions",
    label: "Promotions",
  },
  { id: "new", label: "New arrivals" },
];

export default function Independent() {
  const [checked, setChecked] = useState(["computers", "deals"]);

  return (
    <div className="space-y-3">
      <TreeView
        aria-label="Listed in"
        checkable
        checked={checked}
        checkMode="independent"
        defaultExpanded={["computers", "promotions"]}
        items={categories}
        onCheckedChange={setChecked}
      />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Listed in: <strong>{checked.join(", ") || "nothing"}</strong>
      </p>
    </div>
  );
}
