import {
  DataTable,
  Select,
  type Column,
  type DataTableFilterValue,
} from "components-ui";
import {
  departmentOptions,
  people,
  statusOptions,
  type Person,
} from "../../mocks/data";
import { Salary } from "./salary";

/** A custom filter keeps a number of years - its chip says what it means. */
const formatYears = (value: DataTableFilterValue) =>
  typeof value === "string" ? `in the company ${value}+ years` : "";

const columns: Column<Person>[] = [
  { filter: "input", key: "name", label: "Name", minWidth: 160 },
  {
    filter: "multiSelect",
    filterSelectOptions: departmentOptions,
    key: "department",
    label: "Department",
    minWidth: 160,
  },
  {
    // Any, yes or no - `"true"` / `"false"` in the query
    filter: "boolean",
    getValue: (person) => person.status === "active",
    key: "active",
    label: "Active",
    minWidth: 100,
  },
  {
    filter: "select",
    filterSelectOptions: statusOptions,
    key: "status",
    label: "Status",
    minWidth: 130,
  },
  {
    filter: "numberRange",
    key: "salary",
    label: "Salary",
    minWidth: 180,
    render: (person) => <Salary value={person.salary} />,
  },
  {
    customFilter: (setFilter, value) => (
      <Select
        aria-label="Filter Since"
        dim="sm"
        onChange={({ target }) => setFilter("since", target.value)}
        options={[
          { label: "Any", value: "" },
          { label: "1+ years", value: "1" },
          { label: "2+ years", value: "2" },
        ]}
        value={value}
      />
    ),
    filter: "custom",
    filterFn: (person, years) =>
      new Date().getFullYear() - Number(person.createdAt.slice(0, 4)) >=
      Number(years),
    // The chip says what the value means - "Since: in the company 1+ years"
    formatFilterValue: formatYears,
    key: "since",
    label: "Since",
    minWidth: 120,
    render: (person) => person.createdAt.slice(0, 4),
  },
];

// The active filters as chips under the toolbar - the × of a chip clears
// that filter, "Clear all" every filter and the search
export default function FilterChips() {
  return (
    <DataTable
      aria-label="People filtered by chips"
      clientSide
      columns={columns}
      data={people}
      defaultQuery={{
        filters: {
          active: "true",
          department: ["Sales", "Support"],
          salary: { from: "40000", to: "90000" },
          since: "1",
        },
        pageSize: 5,
        search: "an",
      }}
      enableGlobalSearch
      maxHeight="440px"
    />
  );
}
