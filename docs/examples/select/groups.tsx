import { Select, type SelectOptionGroup } from "components-ui";

const warehouses: SelectOptionGroup[] = [
  {
    label: "Czechia",
    options: [
      { label: "Prague", value: "prg" },
      { label: "Brno", value: "brq" },
      { disabled: true, label: "Ostrava (stocktaking)", value: "osr" },
    ],
  },
  {
    label: "Slovakia",
    options: [
      { label: "Bratislava", value: "bts" },
      { label: "Košice", value: "kse" },
    ],
  },
];

export default function Groups() {
  return (
    <div className="max-w-md">
      <Select
        description="Where the goods are shipped from."
        hasEmpty
        label="Warehouse"
        name="warehouse"
        options={warehouses}
      />
    </div>
  );
}
