import { DataTable, type Column } from "components-ui";
import { departmentOptions, people, type Person } from "../../mocks/data";
import { Salary } from "./salary";

// `2026-09-24` as that day here - see columns.tsx
const toLocalDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const YEAR = 365.25 * 24 * 60 * 60 * 1000;
const today = new Date(2026, 8, 24);

const columns: Column<Person>[] = [
  { filter: "input", key: "name", label: "Name", summary: "count" },
  {
    filter: "select",
    filterSelectOptions: departmentOptions,
    key: "department",
    label: "Department",
    // A function renders whatever it likes
    summary: (rows) =>
      `${new Set(rows.map((person) => person.department)).size} departments`,
  },
  {
    getValue: (person) => toLocalDate(person.createdAt),
    key: "createdAt",
    label: "Joined",
    summary: "min",
  },
  {
    getValue: (person) =>
      Math.round(
        ((today.getTime() - toLocalDate(person.createdAt).getTime()) / YEAR) *
          10,
      ) / 10,
    key: "tenure",
    label: "Years",
    summary: "avg",
  },
  {
    key: "salary",
    label: "Salary",
    render: (person) => <Salary value={person.salary} />,
    summary: "sum",
  },
];

// The summary row covers every row matching the filters, not just the
// page - filter the department and watch it change
export default function Summary() {
  return (
    <DataTable
      clientSide
      columns={columns}
      data={people}
      defaultQuery={{ pageSize: 10 }}
      maxHeight="480px"
    />
  );
}
