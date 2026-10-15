import { useMemo, useState } from "react";
import {
  compactFilter,
  DataTable,
  FilterBuilder,
  matchesFilter,
  type FilterField,
  type FilterGroup,
} from "components-ui";
import {
  CITIES,
  departmentOptions,
  people,
  roleOptions,
  statusOptions,
  type Person,
} from "../../mocks/data";
import { personColumns } from "../data-table/columns";

// The fields of the records - outside the component, so that
// `matchesFilter` compiles each filter once for all the rows
const fields: FilterField<Person>[] = [
  { key: "name", label: "Name", type: "text" },
  {
    key: "department",
    label: "Department",
    options: departmentOptions,
    type: "select",
  },
  {
    key: "city",
    label: "City",
    options: CITIES.map((city) => ({ label: city, value: city })),
    type: "select",
  },
  { key: "role", label: "Role", options: roleOptions, type: "select" },
  { key: "status", label: "Status", options: statusOptions, type: "select" },
  { key: "salary", label: "Salary", type: "number" },
  // "2026-09-24" texts - compared as days
  { key: "createdAt", label: "Joined", type: "date" },
];

// The builder filters - the column filters are not needed
const columns = personColumns.map((column) => ({
  ...column,
  filter: undefined,
}));

const initialFilter: FilterGroup = {
  combinator: "and",
  conditions: [
    {
      field: "department",
      operator: "in",
      value: ["Engineering", "Support"],
    },
    { field: "salary", operator: "greaterThanOrEqual", value: 60_000 },
  ],
};

export default function FilterDataTable() {
  const [filter, setFilter] = useState(initialFilter);
  const rows = useMemo(
    () => people.filter((person) => matchesFilter(person, filter, fields)),
    [filter],
  );

  return (
    <div className="space-y-4">
      <FilterBuilder
        fields={fields}
        label="People where"
        onChange={setFilter}
        value={filter}
      />
      <DataTable
        aria-label="Filtered people"
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ pageSize: 5 }}
      />
      <div>
        <h4 className="mb-1 text-sm font-medium">
          Sent to a server - <code>compactFilter(filter, fields)</code>
        </h4>
        <pre className="max-h-64 overflow-auto rounded-md bg-neutral-50 p-3 font-mono text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {JSON.stringify(compactFilter(filter, fields), null, 2)}
        </pre>
      </div>
    </div>
  );
}
