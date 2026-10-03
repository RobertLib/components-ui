import { DataTable, getDataTableGroupKey } from "components-ui";
export default function ServerGrouping() {
  return (
    <DataTable
      columns={[
        { key: "name", label: "Name" },
        { key: "team", label: "Team" },
        { key: "amount", label: "Amount", summary: "sum" },
      ]}
      data={[
        { id: 1, name: "Adam", team: "Engineering", amount: 100 },
        { id: 2, name: "Eva", team: "Engineering", amount: 200 },
      ]}
      total={42}
      groupBy="team"
      groupMetadata={{
        [getDataTableGroupKey(["Engineering"])]: {
          count: 42,
          summaryValues: { amount: 12500 },
        },
      }}
    />
  );
}
