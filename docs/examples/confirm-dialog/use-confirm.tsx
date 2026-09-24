import {
  Button,
  ConfirmProvider,
  useConfirm,
  useSnackbar,
} from "components-ui";

function InvoiceActions() {
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();

  const handleDelete = async () => {
    const confirmed = await confirm({
      confirmColor: "danger",
      confirmLabel: "Delete",
      message: "The invoice will be deleted. This cannot be undone.",
      title: "Delete invoice 2026-0042?",
    });
    if (confirmed) enqueueSnackbar("The invoice was deleted", "success");
  };

  return (
    <Button color="danger" onClick={handleDelete} variant="outline">
      Delete invoice
    </Button>
  );
}

// In an app, render <ConfirmProvider> once near the root - this example
// brings its own
export default function UseConfirm() {
  return (
    <ConfirmProvider>
      <InvoiceActions />
    </ConfirmProvider>
  );
}
