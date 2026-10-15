import { Button, ConfirmProvider, usePrompt, useSnackbar } from "components-ui";

// The API call that rejects the invoice with the reason
const rejectInvoice = (reason: string) =>
  new Promise<string>((resolve) => setTimeout(() => resolve(reason), 800));

function InvoiceApproval() {
  const prompt = usePrompt();
  const { enqueueSnackbar } = useSnackbar();

  const handleReject = async () => {
    const reason = await prompt({
      confirmColor: "danger",
      confirmLabel: "Reject",
      label: "Reason",
      maxLength: 300,
      message:
        "Invoice FP-2026-0187 from Stavebniny Novák s.r.o. returns to the supplier with the reason.",
      multiline: true,
      placeholder: "e.g. The VAT rate of item 3 should be 12 %",
      required: true,
      title: "Reject the invoice?",
      // Runs before the dialog closes, with a spinner on the button
      onConfirm: (value) => rejectInvoice(value),
    });
    if (reason !== null) {
      enqueueSnackbar(`The invoice was rejected: ${reason}`, "success");
    }
  };

  return (
    <Button color="danger" onClick={handleReject} variant="outline">
      Reject invoice
    </Button>
  );
}

// In an app, render <ConfirmProvider> once near the root - this example
// brings its own
export default function PromptReason() {
  return (
    <ConfirmProvider>
      <InvoiceApproval />
    </ConfirmProvider>
  );
}
