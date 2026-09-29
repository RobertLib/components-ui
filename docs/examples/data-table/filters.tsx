import { useState } from "react";
import {
  DataTable,
  createDataTableQuery,
  type Column,
  type DataTableQuery,
} from "components-ui";
import {
  departmentOptions,
  people,
  statusOptions,
  type Person,
} from "../../mocks/data";
import { Salary } from "./salary";

const columns: Column<Person>[] = [
  { filter: "input", key: "name", label: "Name", minWidth: 160 },
  {
    // Any of the departments picked - `["Sales", "Support"]`
    filter: "multiSelect",
    filterSelectOptions: departmentOptions,
    key: "department",
    label: "Department",
    minWidth: 160,
  },
  {
    filter: "multiSelect",
    filterSelectOptions: statusOptions,
    key: "status",
    label: "Status",
    minWidth: 140,
  },
  {
    // From - to, either side may stay open - `{ from: "50000" }`
    filter: "numberRange",
    key: "salary",
    label: "Salary",
    minWidth: 180,
    render: (person) => <Salary value={person.salary} />,
  },
  {
    // A range of days - `{ from: "2024-01-01", to: "2024-06-30" }`
    filter: "dateRange",
    key: "createdAt",
    label: "Joined",
    minWidth: 220,
  },
];

// The filters of the query - texts, lists and ranges - as the table
// reports them, e.g. to a server
export default function Filters() {
  const [query, setQuery] = useState<DataTableQuery>(() =>
    createDataTableQuery({
      filters: { salary: { from: "60000" }, status: ["active", "invited"] },
      pageSize: 5,
    }),
  );

  return (
    <div className="space-y-3">
      <DataTable
        aria-label="People by department, salary and start"
        clientSide
        columns={columns}
        data={people}
        maxHeight="420px"
        onQueryChange={setQuery}
        query={query}
      />
      <pre className="overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {JSON.stringify(query.filters, null, 2)}
      </pre>
    </div>
  );
}
