import { DataTable, useSnackbar, type Column } from "components-ui";
import { people, type Person } from "../../mocks/data";
import { personColumns } from "./columns";

// The name sticks to the left edge and the salary to the right one while
// the table scrolls sideways; the email starts 240px wide. Drag the edge of
// a header to resize a column (or focus the handle and use the arrow keys),
// double-click it to bring the width back. Widths and pins are remembered
// under `tableId` - "Reset columns" in the column menu forgets them.
const columns: Column<Person>[] = personColumns.map((column) => {
  if (column.key === "name") return { ...column, pinned: "left" };
  if (column.key === "salary") return { ...column, pinned: "right" };
  if (column.key === "email") return { ...column, width: 240 };
  return column;
});

export default function ColumnLayout() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <DataTable
      clientSide
      columns={columns}
      data={people}
      defaultQuery={{ pageSize: 10 }}
      groupActions={[
        {
          label: "Archive",
          onClick: (rows) => enqueueSnackbar(`Archived ${rows.length} people`),
        },
      ]}
      maxHeight="480px"
      tableId="docs-people-layout"
    />
  );
}
