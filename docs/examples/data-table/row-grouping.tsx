import { DataTable, type Column } from "components-ui";
import { people, type Person } from "../../mocks/data";
import { personColumns } from "./columns";

// The people of each department under a header with their number and the
// sum of their salaries - a click on the header collapses the group
const columns: Column<Person>[] = personColumns
  .filter((column) =>
    ["name", "department", "role", "salary"].includes(column.key),
  )
  .map((column) =>
    column.key === "salary" ? { ...column, summary: "sum" } : column,
  );

export default function RowGrouping() {
  return (
    <DataTable
      aria-label="People by department"
      clientSide
      columns={columns}
      data={people}
      // Sorted by the department first, a page holds whole groups
      defaultQuery={{
        pageSize: 25,
        sort: [
          { key: "department", order: "asc" },
          { key: "name", order: "asc" },
        ],
      }}
      groupBy="department"
      maxHeight="480px"
    />
  );
}
