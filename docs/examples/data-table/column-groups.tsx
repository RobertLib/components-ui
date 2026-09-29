import { DataTable, type DataTableColumn } from "components-ui";
import { people, type Person } from "../../mocks/data";
import { personColumns } from "./columns";

const column = (key: string) =>
  personColumns.find((candidate) => candidate.key === key)!;

// An entry with `children` puts its columns under a common header. They
// are reordered within their group; pinned, a column takes its part of the
// group header along.
const columns: DataTableColumn<Person>[] = [
  { ...column("name"), pinned: "left" },
  {
    children: [column("email"), { ...column("city"), visible: true }],
    key: "contact",
    label: "Contact",
  },
  {
    children: [column("department"), column("role"), column("salary")],
    key: "work",
    label: "Work",
  },
  column("createdAt"),
];

export default function ColumnGroups() {
  return (
    <DataTable
      aria-label="People by contact and work"
      clientSide
      columns={columns}
      data={people}
      defaultQuery={{ pageSize: 5 }}
      maxHeight="420px"
    />
  );
}
