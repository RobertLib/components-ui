import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { ConfirmDialog, Dropdown, useSnackbar } from "components-ui";

export default function FromMenu() {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  return (
    <>
      <Dropdown
        aria-label="Customer actions"
        items={[
          { label: "Edit", onClick: () => enqueueSnackbar("Edit clicked") },
          { label: "Delete", onClick: () => setOpen(true) },
        ]}
        trigger={<MoreHorizontal size={18} />}
      />
      <ConfirmDialog
        confirmColor="danger"
        confirmLabel="Delete"
        message="The customer and all their orders will be deleted."
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          enqueueSnackbar("The customer was deleted", "success");
        }}
        open={open}
        title="Delete the customer?"
      />
    </>
  );
}
