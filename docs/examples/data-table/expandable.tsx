import { DataTable, DescriptionList, Input, type Column } from "components-ui";
import { people, type Person } from "../../mocks/data";
import { Salary } from "./salary";

const columns: Column<Person>[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "department", label: "Department" },
  {
    // A custom filter - a minimum salary, matched with filterFn
    customFilter: (setFilter, value) => (
      <Input
        aria-label="Minimum salary"
        dim="sm"
        onChange={(event) => setFilter("salary", event.target.value)}
        placeholder="Min. salary"
        type="number"
        value={value}
      />
    ),
    filter: "custom",
    filterFn: (person, value) => person.salary >= Number(value),
    key: "salary",
    label: "Salary",
    render: (person) => <Salary value={person.salary} />,
    sortable: true,
  },
];

export default function Expandable() {
  return (
    <DataTable
      clientSide
      columns={columns}
      data={people}
      defaultQuery={{ pageSize: 5 }}
      emptyMessage="Nobody earns that much."
      getRowBackgroundColor={(person) =>
        person.status === "suspended" ? "rgb(239 68 68 / 0.08)" : undefined
      }
      maxHeight="480px"
      renderSubRow={(person) => (
        <DescriptionList
          items={[
            { desc: person.email, term: "Email" },
            { desc: person.city, term: "City" },
            { desc: person.status, term: "Status" },
          ]}
        />
      )}
    />
  );
}
