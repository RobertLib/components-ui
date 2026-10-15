import { Mail, Pencil, UserX } from "lucide-react";
import {
  DataTable,
  useSnackbar,
  type Column,
  type DropdownEntry,
} from "components-ui";
import { people, type Person } from "../../mocks/data";
import { personColumns } from "./columns";

const columns: Column<Person>[] = personColumns.slice(0, 5).map((column) =>
  column.key === "name"
    ? {
        ...column,
        // Classes of the cells by the row - a suspended person is struck out
        cellClassName: (person) =>
          person.status === "suspended"
            ? "text-neutral-500 line-through dark:text-neutral-400"
            : undefined,
      }
    : column,
);

// A right click, a long press, or Shift + F10 on a focused row opens its
// menu - the rows are one Tab stop, the arrow keys move between them
export default function ContextMenuExample() {
  const { enqueueSnackbar } = useSnackbar();

  const getRowContextMenu = (person: Person): DropdownEntry[] => [
    {
      icon: <Pencil size={16} />,
      label: "Edit",
      onClick: () => enqueueSnackbar(`Editing ${person.name}`),
    },
    {
      icon: <Mail size={16} />,
      label: "Send an email",
      onClick: () => enqueueSnackbar(`Email to ${person.email}`, "success"),
    },
    { type: "separator" },
    {
      danger: true,
      disabled: person.status === "suspended",
      icon: <UserX size={16} />,
      label: "Suspend",
      onClick: () => enqueueSnackbar(`${person.name} suspended`, "warning"),
    },
  ];

  return (
    <DataTable
      aria-label="People with a context menu"
      clientSide
      columns={columns}
      data={people}
      defaultQuery={{ pageSize: 5 }}
      getRowContextMenu={getRowContextMenu}
      maxHeight="360px"
    />
  );
}
