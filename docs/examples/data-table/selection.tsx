import { DataTable, useSnackbar } from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

export default function Selection() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <DataTable
      autoResetSelectedRows
      clientSide
      columns={personColumns.slice(0, 5)}
      data={people}
      defaultQuery={{ pageSize: 5 }}
      // Once a whole page is selected, offers selecting every matching row
      filteredSelection
      groupActions={[
        {
          label: "Send an email",
          onClick: (rows, { allFiltered, count }) =>
            enqueueSnackbar(
              allFiltered
                ? `Email to all ${count} matching people`
                : `Email to ${rows.map((row) => row.firstName).join(", ")}`,
              "success",
            ),
        },
        {
          label: "Export",
          onClick: (_rows, { count }) => {
            enqueueSnackbar(`Exported ${count} rows`);
            // Keep the selection after this action
            return false;
          },
        },
      ]}
      maxHeight="420px"
    />
  );
}
