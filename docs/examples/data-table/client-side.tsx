import { Pencil, Trash2 } from "lucide-react";
import { DataTable, IconButton, useSnackbar } from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

// All rows are in the browser: `clientSide` filters, searches, sorts and
// pages them. Try the column filters, the search icon, sorting by a header,
// and the column menu (reorder, hide, pin) - it is remembered under `tableId`.
export default function ClientSide() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <DataTable
      actions={(person) => (
        <div className="flex gap-2">
          <IconButton
            aria-label={`Edit ${person.name}`}
            onClick={() => enqueueSnackbar(`Edit ${person.name}`)}
          >
            <Pencil size={16} />
          </IconButton>
          <IconButton
            aria-label={`Delete ${person.name}`}
            onClick={() => enqueueSnackbar(`Delete ${person.name}`, "warning")}
            variant="danger"
          >
            <Trash2 size={16} />
          </IconButton>
        </div>
      )}
      clientSide
      columns={personColumns}
      data={people}
      defaultQuery={{ pageSize: 10 }}
      enableGlobalSearch
      maxHeight="560px"
      tableId="docs-people"
    />
  );
}
