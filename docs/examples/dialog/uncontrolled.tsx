import { useState } from "react";
import { Button, Dialog } from "components-ui";

// Without `open` the dialog opens when mounted and closes itself -
// `onClose` runs after the closing animation. In an app this is the
// component of a route: <Dialog onClose={() => navigate(-1)} …>
export default function Uncontrolled() {
  const [mounted, setMounted] = useState(false);

  return (
    <>
      <Button onClick={() => setMounted(true)} variant="outline">
        Mount the dialog
      </Button>
      {mounted && (
        <Dialog onClose={() => setMounted(false)} title="Order #1042">
          <p className="text-sm">
            Press Escape or the close button - the parent unmounts the dialog in{" "}
            <code>onClose</code>.
          </p>
        </Dialog>
      )}
    </>
  );
}
