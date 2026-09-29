import { useState } from "react";
import { DataTable, type DataTableColumnState } from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

// The column settings as a value - store it on your server per user and
// pass it back. Reorder, hide, pin or resize a column and watch it change.
export default function ColumnState() {
  const [columnState, setColumnState] = useState<DataTableColumnState>({
    visibility: { city: true, email: false },
    widths: { name: 200 },
  });

  return (
    <div className="space-y-3">
      <DataTable
        aria-label="People with stored columns"
        clientSide
        columns={personColumns}
        columnState={columnState}
        data={people}
        defaultQuery={{ pageSize: 5 }}
        maxHeight="360px"
        onColumnStateChange={setColumnState}
      />
      <pre className="overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {JSON.stringify(columnState, null, 2)}
      </pre>
    </div>
  );
}
