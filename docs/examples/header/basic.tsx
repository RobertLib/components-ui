import { Plus } from "lucide-react";
import { Button, Chip, Header, useSnackbar } from "components-ui";

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="space-y-8">
      <Header
        actions={
          <>
            <Button variant="outline">Export</Button>
            <Button>
              <Plus className="mr-1" size={16} /> New customer
            </Button>
          </>
        }
        title="Customers"
      />
      <Header
        afterTitle={<Chip color="success">Paid</Chip>}
        back
        // By default the arrow goes back in the history
        onBack={() => enqueueSnackbar("Back clicked")}
        title="Invoice 2026-0042"
      />
      {/* A title of null shows a placeholder while it loads */}
      <Header title={null} />
    </div>
  );
}
