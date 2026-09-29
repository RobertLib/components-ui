import { useState } from "react";
import {
  DataTable,
  createDataTableQuery,
  type DataTableQuery,
} from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

const columns = personColumns.filter((column) =>
  ["name", "department", "role", "salary"].includes(column.key),
);

// Shift + click on a header (Shift + Enter on its button) adds the column
// to the sorting - here by department, then by salary from the highest
export default function MultiSort() {
  const [query, setQuery] = useState<DataTableQuery>(() =>
    createDataTableQuery({
      pageSize: 10,
      sort: [
        { key: "department", order: "asc" },
        { key: "salary", order: "desc" },
      ],
    }),
  );

  return (
    <div className="space-y-3">
      <DataTable
        aria-label="People by department and salary"
        clientSide
        columns={columns}
        data={people}
        maxHeight="420px"
        onQueryChange={setQuery}
        query={query}
      />
      <pre className="overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {JSON.stringify(
          { order: query.order, sort: query.sort, sortBy: query.sortBy },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
