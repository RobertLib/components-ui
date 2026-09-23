import { useState } from "react";
import { Button, ConfirmDialog, useSnackbar } from "components-ui";

export default function Delete() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleConfirm = async () => {
    setDeleting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // the API call
    setDeleting(false);
    setOpen(false);
    enqueueSnackbar("The customer was deleted", "success");
  };

  return (
    <>
      <Button color="danger" onClick={() => setOpen(true)} variant="outline">
        Delete customer
      </Button>
      <ConfirmDialog
        confirmColor="danger"
        confirmLabel="Delete"
        loading={deleting}
        message="The customer and all their orders will be deleted. This cannot be undone."
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        open={open}
        title="Delete the customer?"
      />
    </>
  );
}
