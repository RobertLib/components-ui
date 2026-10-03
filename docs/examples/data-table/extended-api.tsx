import { DataTable, type Column, type RowId } from "components-ui";
import { useState } from "react";

interface Person {
  uuid: string;
  name: string;
  priority: number;
  active: boolean;
}
const people: Person[] = [
  { uuid: "anna", name: "Anna", priority: 3, active: true },
  { uuid: "adam", name: "Adam", priority: 1, active: false },
  { uuid: "eva", name: "Eva", priority: 2, active: true },
];
const columns: Column<Person>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    sortFn: (a, b) => a.priority - b.priority,
  },
  { key: "priority", label: "Priority" },
  { key: "active", label: "Active" },
];

export default function ExtendedApi() {
  const [expandedIds, setExpandedIds] = useState<RowId[]>(["anna"]);
  const [archived, setArchived] = useState("");
  return (
    <div className="space-y-3">
      <DataTable
        clientSide
        columns={columns}
        data={people}
        expandedIds={expandedIds}
        getRowId={(row) => row.uuid}
        groupActions={[
          {
            label: "Archive",
            onClick: (rows) => {
              setArchived(rows.map((row) => row.name).join(", "));
            },
          },
        ]}
        isRowSelectable={(row) => row.active}
        onExpandedIdsChange={setExpandedIds}
        renderSubRow={(row) => (
          <p className="p-3">
            {row.name}'s priority is {row.priority}. Only active people can be
            archived.
          </p>
        )}
      />
      <output className="block text-sm">Archived: {archived || "—"}</output>
    </div>
  );
}
