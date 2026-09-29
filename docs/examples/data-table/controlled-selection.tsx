import { useState } from "react";
import {
  Button,
  DataTable,
  SegmentedControl,
  type DataTableSelectionMode,
  type RowId,
} from "components-ui";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

const columns = personColumns.slice(0, 4);

// The selection lives in the state of the page - it stays across pages and
// filters, and the page can change it. Shift + click on a checkbox selects
// the rows from the one checked before.
export default function ControlledSelection() {
  const [mode, setMode] = useState<DataTableSelectionMode>("multiple");
  const [selectedIds, setSelectedIds] = useState<RowId[]>([2, 3]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label="Selection"
          onChange={(value) => {
            setMode(value);
            setSelectedIds((ids) => ids.slice(0, 1));
          }}
          options={[
            { label: "Several rows", value: "multiple" },
            { label: "One row", value: "single" },
          ]}
          size="sm"
          value={mode}
        />
        <Button
          disabled={selectedIds.length === 0}
          onClick={() => setSelectedIds([])}
          size="sm"
          variant="outline"
        >
          Clear
        </Button>
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          Selected: {selectedIds.join(", ") || "none"}
        </span>
      </div>
      <DataTable
        aria-label="People to pick"
        clientSide
        columns={columns}
        data={people}
        defaultQuery={{ pageSize: 5 }}
        maxHeight="360px"
        onSelectedIdsChange={setSelectedIds}
        selectedIds={selectedIds}
        selectionMode={mode}
      />
    </div>
  );
}
