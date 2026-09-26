import { useState } from "react";
import { DataTable, type Column } from "components-ui";
import { departmentOptions, people } from "../../mocks/data";
import { Salary } from "./salary";

interface Employee {
  department: string;
  email: string;
  id: number;
  name: string;
  remote: boolean;
  salary: number;
  startDate: Date;
}

const employees: Employee[] = people.slice(0, 40).map((person) => {
  const [year, month, day] = person.createdAt.split("-").map(Number);

  return {
    department: person.department,
    email: person.email,
    id: person.id,
    name: person.name,
    remote: person.id % 3 === 0,
    salary: person.salary,
    startDate: new Date(year, month - 1, day),
  };
});

// The editors follow the values: a text field, a select (options), a number
// field, a date picker and a checkbox
const columns: Column<Employee>[] = [
  {
    editable: true,
    key: "name",
    label: "Name",
    // An edited row stays in place while the editing goes on - sorted by
    // name, a renamed row moves once you are done
    sortable: true,
    validate: (value) => (String(value).trim() ? undefined : "Enter a name."),
  },
  {
    editable: true,
    key: "email",
    label: "Email",
    validate: (value) =>
      /^\S+@\S+\.\S+$/.test(String(value)) ? undefined : "Enter an email.",
  },
  {
    editable: true,
    editorOptions: departmentOptions,
    key: "department",
    label: "Department",
  },
  {
    editable: true,
    key: "salary",
    label: "Salary",
    render: (employee) => <Salary value={employee.salary} />,
    validate: (value) =>
      typeof value === "number" && value >= 0 ? undefined : "Enter a salary.",
  },
  { editable: true, key: "startDate", label: "Start date" },
  { editable: true, key: "remote", label: "Remote" },
];

/** A save to a server - "error" in a name makes it refuse the change. */
async function saveEmployee(key: string, value: unknown) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  if (key === "name" && String(value).toLowerCase().includes("error")) {
    throw new Error("The server refused this name.");
  }
}

export default function InlineEditing() {
  const [rows, setRows] = useState(employees);

  return (
    <DataTable
      aria-label="Employees"
      clientSide
      columns={columns}
      data={rows}
      defaultQuery={{ pageSize: 10 }}
      maxHeight="480px"
      // The cell shows the new value with a spinner while this runs - and
      // its old value with the message when it throws
      onCellEdit={async (employee, key, value) => {
        await saveEmployee(key, value);
        setRows((current) =>
          current.map((row) =>
            row.id === employee.id ? { ...row, [key]: value } : row,
          ),
        );
      }}
    />
  );
}
