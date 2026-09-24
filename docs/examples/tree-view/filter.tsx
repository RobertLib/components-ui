import { useState } from "react";
import { Input, TreeView, type TreeItem } from "components-ui";

const PRODUCTS = [
  "Office chairs",
  "Standing desks",
  "Monitors",
  "Keyboards",
  "Printer paper",
  "Filing cabinets",
  "Desk lamps",
  "Whiteboards",
  "Headsets",
  "Webcams",
  "Coffee machines",
];

// 4 warehouses × 10 aisles × 25 shelves - 1 044 items
const locations: TreeItem<string>[] = [
  "Prague",
  "Brno",
  "Ostrava",
  "Plzeň",
].map((city, w) => ({
  children: [..."ABCDEFGHIJ"].map((aisle, a) => ({
    children: Array.from({ length: 25 }, (_, s) => {
      const shelf = `${aisle}-${String(s + 1).padStart(2, "0")}`;
      const product = PRODUCTS[(w * 250 + a * 25 + s) % PRODUCTS.length];
      return { id: `${city}/${shelf}`, label: `${shelf} ${product}` };
    }),
    id: `${city}/${aisle}`,
    label: `Aisle ${aisle}`,
  })),
  id: city,
  label: `${city} warehouse`,
}));

export default function Filter() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-3">
      <div className="max-w-sm">
        <Input
          label="Find a shelf"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="e.g. webcams, C-12 or plzen"
          type="search"
          value={search}
        />
      </div>
      <TreeView
        aria-label="Stock locations"
        className="max-h-80 overflow-y-auto rounded-md border border-neutral-200 p-1 dark:border-neutral-800"
        filter={search}
        items={locations}
      />
    </div>
  );
}
