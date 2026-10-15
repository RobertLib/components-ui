import { DataTable, type DataTableView } from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

// Views of the app - they can be applied, not changed or deleted
const presetViews: DataTableView[] = [
  {
    id: "sales",
    name: "Active in Sales",
    query: { filters: { department: "Sales", status: "active" } },
  },
  {
    columnState: { visibility: { city: true, email: false } },
    id: "top-salaries",
    name: "Highest salaries",
    query: { pageSize: 10, sort: [{ key: "salary", order: "desc" }] },
  },
];

// Filter, sort or rearrange the columns, then "Save as a new view…" - the
// views are remembered in this browser under `tableId`. Pass `views` and
// `onViewsChange` to keep them on a server instead.
export default function SavedViews() {
  return (
    <DataTable
      aria-label="People with saved views"
      clientSide
      columns={personColumns}
      data={people}
      defaultQuery={{ pageSize: 5 }}
      enableGlobalSearch
      enableViews
      maxHeight="420px"
      presetViews={presetViews}
      tableId="docs-saved-views"
    />
  );
}
