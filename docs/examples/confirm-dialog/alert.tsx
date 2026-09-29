import { Button, ConfirmProvider, useAlert } from "components-ui";

function ExportButton() {
  const alert = useAlert();

  const handleExport = async () => {
    // … the export runs
    await alert({
      message: "12 invoices were exported to invoices-2026-09.csv.",
      title: "Export finished",
    });
    // Here once the user has closed it - OK, the close button or Escape
  };

  return (
    <Button onClick={handleExport} variant="outline">
      Export invoices
    </Button>
  );
}

// In an app, render <ConfirmProvider> once near the root - this example
// brings its own
export default function Alert() {
  return (
    <ConfirmProvider>
      <ExportButton />
    </ConfirmProvider>
  );
}
