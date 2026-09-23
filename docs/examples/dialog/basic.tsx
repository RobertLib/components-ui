import { useState } from "react";
import { Button, Dialog, DialogFooter, Input } from "components-ui";

export default function Basic() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Rename project</Button>
      <Dialog
        onClose={() => setOpen(false)}
        open={open}
        size="md"
        title="Rename project"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
        >
          <Input
            defaultValue="Website redesign"
            label="Name"
            name="name"
            required
          />
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
