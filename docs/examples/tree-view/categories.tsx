import { Laptop, Shirt, Sofa } from "lucide-react";
import { useState } from "react";
import { TreeView, type TreeItem } from "components-ui";

const categories: TreeItem<string>[] = [
  {
    children: [
      {
        children: [
          { id: "laptops", label: "Laptops" },
          { id: "desktops", label: "Desktops" },
          { id: "monitors", label: "Monitors" },
        ],
        id: "computers",
        label: "Computers",
      },
      { id: "phones", label: "Phones & tablets" },
      { disabled: true, id: "cameras", label: "Cameras (discontinued)" },
    ],
    icon: <Laptop size={16} />,
    id: "electronics",
    label: "Electronics",
  },
  {
    children: [
      { id: "furniture", label: "Furniture" },
      { id: "lighting", label: "Lighting" },
      { id: "garden", label: "Garden" },
    ],
    icon: <Sofa size={16} />,
    id: "home",
    label: "Home & garden",
  },
  {
    children: [
      { id: "women", label: "Women" },
      { id: "men", label: "Men" },
    ],
    icon: <Shirt size={16} />,
    id: "fashion",
    label: "Fashion",
  },
];

export default function Categories() {
  const [selected, setSelected] = useState(["laptops"]);

  return (
    <div className="grid gap-4 sm:grid-cols-[16rem_1fr]">
      <TreeView
        aria-label="Product categories"
        defaultExpanded={["electronics", "computers"]}
        items={categories}
        onSelectedChange={setSelected}
        selected={selected}
      />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Showing products of: <strong>{selected.join(", ") || "all"}</strong>
      </p>
    </div>
  );
}
