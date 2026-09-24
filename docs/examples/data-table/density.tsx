import { DataTable } from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

// Compact rows by default - the user switches the density with the rows
// icon in the toolbar, and the choice is remembered under `tableId`
const columns = personColumns.slice(0, 5);

export default function Density() {
  return (
    <DataTable
      clientSide
      columns={columns}
      data={people}
      defaultQuery={{ pageSize: 10 }}
      density="compact"
      maxHeight="420px"
      tableId="docs-people-density"
    />
  );
}
