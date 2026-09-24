import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  DescriptionList,
  DialogFooter,
  Sheet,
  useSnackbar,
} from "components-ui";

export default function Confirm() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Open the customer
      </Button>
      <Sheet onClose={() => setOpen(false)} open={open} title="Jana Nováková">
        <DescriptionList
          items={[
            { desc: "jana.novakova@example.com", term: "Email" },
            { desc: "12 open orders", term: "Orders" },
          ]}
        />
        <DialogFooter className="flex justify-between gap-2">
          <Button
            color="danger"
            onClick={() => setConfirming(true)}
            variant="outline"
          >
            Delete
          </Button>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>

        {/* Rendered in the sheet: it stacks above it, Escape closes it
            first and the focus goes back to the Delete button */}
        <ConfirmDialog
          confirmColor="danger"
          confirmLabel="Delete"
          message="The customer and their 12 orders will be deleted."
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            setOpen(false);
            enqueueSnackbar("The customer was deleted", "success");
          }}
          open={confirming}
          title="Delete the customer?"
        />
      </Sheet>
    </>
  );
}
