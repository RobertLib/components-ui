import {
  createCsv,
  DataTable,
  downloadCsv,
  useLocale,
  type Column,
} from "components-ui";
import { people, type Person } from "../../mocks/data";
import { personColumns } from "./columns";

const statusLabels = {
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
};

// The status cell is a chip and the salary is formatted by `render` - the
// file gets their values instead
const columns: Column<Person>[] = personColumns.map((column) => {
  if (column.key === "status") {
    return { ...column, exportValue: (person) => statusLabels[person.status] };
  }
  if (column.key === "salary") {
    return { ...column, exportValue: (person) => person.salary };
  }
  return column;
});

export default function CsvExport() {
  const locale = useLocale();

  return (
    <DataTable
      aria-label="People to export"
      clientSide
      columns={columns}
      data={people}
      defaultQuery={{ pageSize: 5 }}
      // The download icon in the toolbar: every page of the filtered and
      // sorted rows, the visible columns in their order
      enableCsvExport
      exportFilename="people"
      groupActions={[
        {
          label: "Export selected",
          // The helpers of the export button, for rows of your choice
          onClick: (rows) => {
            downloadCsv(
              createCsv(rows, columns, { locale }),
              "selected-people",
            );
            return false;
          },
        },
      ]}
      maxHeight="420px"
    />
  );
}
