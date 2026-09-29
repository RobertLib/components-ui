import { useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  Input,
  Textarea,
  useSnackbar,
} from "components-ui";

export default function FullScreenMobile() {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  return (
    <>
      <Button onClick={() => setOpen(true)}>New contact</Button>
      <Dialog
        // The whole screen of a phone - a window from 768px up
        fullScreenOnMobile
        onClose={() => setOpen(false)}
        open={open}
        size="lg"
        title="New contact"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(false);
            enqueueSnackbar("The contact was saved", "success");
          }}
        >
          <Input autoComplete="name" label="Name" name="name" required />
          <Input
            autoComplete="email"
            label="E-mail"
            name="email"
            type="email"
          />
          <Input autoComplete="tel" label="Phone" name="phone" type="tel" />
          <Input label="Company" name="company" />
          <Textarea label="Note" name="note" rows={4} />
          {/* At the bottom of the phone screen, above its home indicator */}
          <DialogFooter>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
