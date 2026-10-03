import { DataTable, type Column } from "components-ui";
const columns: Column<{
  id: number;
  name: string;
  team: string;
  city: string;
  amount: number;
}>[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "team", label: "Team" },
  { key: "city", label: "City" },
  { key: "amount", label: "Amount", summary: "sum" },
];
const data = Array.from({ length: 500 }, (_, id) => ({
  id,
  name: `Person ${id + 1}`,
  team: ["Design", "Engineering", "Support"][id % 3],
  city: ["Prague", "Brno"][id % 2],
  amount: (id + 1) * 10,
}));
export default function NestedGrouping() {
  return (
    <DataTable
      columns={columns}
      data={data}
      groupBy={["team", "city"]}
      virtualized
      maxHeight="360px"
      defaultQuery={{ pageSize: 500 }}
      clientSide
    />
  );
}
