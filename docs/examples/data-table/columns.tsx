import { Chip, type Column } from "components-ui";
import {
  departmentOptions,
  roleOptions,
  statusOptions,
  type Person,
} from "../../mocks/data";
import { Salary } from "./salary";

const statusColors = {
  active: "success",
  invited: "info",
  suspended: "danger",
} as const;

// `2026-09-24` as that day here - `new Date("2026-09-24")` is midnight in
// UTC, which is the day before west of Greenwich
const toLocalDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
};

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
    // A Date without `render` - the table shows it in the date format of
    // the locale (24.09.2026, 09/24/2026) and sorts and filters it as one
    getValue: (person) => toLocalDate(person.createdAt),
    key: "createdAt",
    label: "Joined",
    labelInfo: "The day the account was created.",
    sortable: true,
  },
  {
    key: "salary",
    label: "Salary",
    render: (person) => <Salary value={person.salary} />,
    sortable: true,
  },
];
