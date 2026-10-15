import { useState } from "react";
import {
  createTsv,
  DataTable,
  Textarea,
  useClipboard,
  useLocale,
  useSnackbar,
} from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

const columns = personColumns.slice(0, 5);

// Select rows and press Ctrl + C (⌘ + C) in the table - or focus an editable
// cell - then paste into a spreadsheet, or into the field below. The group
// action copies the same rows with `createTsv`.
export default function Clipboard() {
  const locale = useLocale();
  const { copy } = useClipboard();
  const { enqueueSnackbar } = useSnackbar();
  const [pasted, setPasted] = useState("");

  return (
    <div className="space-y-3">
      <DataTable
        aria-label="People to copy"
        clientSide
        columns={columns}
        data={people}
        defaultQuery={{ pageSize: 5 }}
        groupActions={[
          {
            label: "Copy",
            onClick: async (rows) => {
              // Right in the click - browsers write to the clipboard only
              // in a user action
              if (await copy(createTsv(rows, columns, { locale }))) {
                enqueueSnackbar(`${rows.length} rows copied`, "success");
              }
              return false;
            },
          },
        ]}
        maxHeight="360px"
      />
      <Textarea
        label="Paste here"
        onChange={({ target }) => setPasted(target.value)}
        rows={4}
        value={pasted}
      />
    </div>
  );
}
