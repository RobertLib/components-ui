import { FileText, Upload } from "lucide-react";
import { Button, EmptyState, Panel, useSnackbar } from "components-ui";

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Panel border="neutral" shadow="none">
      <EmptyState
        action={
          <>
            <Button onClick={() => enqueueSnackbar("New invoice")}>
              New invoice
            </Button>
            <Button
              color="default"
              onClick={() => enqueueSnackbar("Import")}
              variant="outline"
            >
              <Upload className="mr-2" size={16} />
              Import
            </Button>
          </>
        }
        description="Create your first invoice, or import the ones you already have from a spreadsheet."
        icon={<FileText />}
        title="No invoices yet"
      />
    </Panel>
  );
}
