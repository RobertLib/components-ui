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
              <Plus className="me-1" size={16} /> New customer
            </Button>
          </>
        }
        description="128 active · 12 archived"
        title="Customers"
      />
      <Header
        afterTitle={<Chip color="success">Paid</Chip>}
        back
        // By default the arrow goes back in the history
        onBack={() => enqueueSnackbar("Back clicked")}
        title="Invoice 2026-0042"
      />
      {/* A link to the list - also from a page opened in a new tab */}
      <Header
        backHref="/components/header?status=open"
        description="Created 1 Oct 2026 by Jana Nováková"
        headingLevel={2}
        title="Order 42"
      />
      {/* A title of null shows a placeholder while it loads */}
      <Header title={null} />
    </div>
  );
}
