import { Chip, type Column } from "components-ui";
import {
  departmentOptions,
  roleOptions,
  statusOptions,
  type Person,
} from "../../mocks/data";

const statusColors = {
  active: "success",
  invited: "info",
  suspended: "danger",
} as const;

/** Column definitions shared by the DataTable examples. */
export const personColumns: Column<Person>[] = [
  {
    filter: "input",
    key: "name",
    label: "Name",
    minWidth: 180,
    sortable: true,
  },
  { filter: "input", key: "email", label: "Email", sortable: true },
  {
    filter: "select",
    filterSelectOptions: departmentOptions,
    key: "department",
    label: "Department",
    sortable: true,
  },
  {
    filter: "select",
    filterSelectOptions: roleOptions,
    key: "role",
    label: "Role",
  },
  {
    filter: "select",
    filterSelectOptions: statusOptions,
    key: "status",
    label: "Status",
    render: (person) => (
      <Chip color={statusColors[person.status]}>{person.status}</Chip>
    ),
  },
  { key: "city", label: "City", sortable: true, visible: false },
  {
    filter: "date",
    key: "createdAt",
    label: "Joined",
    labelInfo: "The day the account was created.",
    render: (person) => new Date(person.createdAt).toLocaleDateString(),
    sortable: true,
  },
  {
    key: "salary",
    label: "Salary",
    render: (person) => (
      <span className="tabular-nums">{person.salary.toLocaleString()} CZK</span>
    ),
    sortable: true,
  },
];
