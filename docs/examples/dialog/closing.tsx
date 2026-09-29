import { useState } from "react";
import { Button, Dialog, DialogFooter } from "components-ui";

export default function Closing() {
  const [preview, setPreview] = useState(false);
  const [terms, setTerms] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setPreview(true)} variant="outline">
        Preview
      </Button>
      {/* Nothing to lose - a click beside it closes it */}
      <Dialog
        closeOnBackdropClick
        onClose={() => setPreview(false)}
        open={preview}
        title="Preview"
      >
        <p className="text-sm">
          A click on the dimmed page closes this dialog, and so do Escape and
          the close button.
        </p>
      </Dialog>

      <Button onClick={() => setTerms(true)} variant="outline">
        New terms
      </Button>
      {/* To be answered - Escape does nothing, the buttons decide */}
      <Dialog
        closeOnEscape={false}
        onClose={() => setTerms(false)}
        open={terms}
        role="alertdialog"
        title="The terms have changed"
      >
        <p className="text-sm">
          Escape does nothing here - accept the new terms or close the dialog
          with its button.
        </p>
        <DialogFooter>
          <div className="flex justify-end">
            <Button onClick={() => setTerms(false)}>Accept</Button>
          </div>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
