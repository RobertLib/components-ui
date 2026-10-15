import { Printer } from "lucide-react";
import { Button, DataTable } from "components-ui";
import { createPeople } from "../../mocks/data";
import { personColumns } from "./columns";

const manyPeople = createPeople(1_000);

// The printout has the rows without the toolbar, the filters, the
// checkboxes and the pagination - all 1 000 of them, though the virtualized
// table renders only those in view. The header row repeats on every page.
export default function Print() {
  return (
    <div className="space-y-3">
      <Button
        onClick={() => window.print()}
        startIcon={<Printer size={16} />}
        variant="outline"
      >
        Print
      </Button>
      <DataTable
        aria-label="1 000 people to print"
        clientSide
        columns={personColumns}
        data={manyPeople}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
        maxHeight="360px"
        pagination={false}
        virtualized
      />
    </div>
  );
}
