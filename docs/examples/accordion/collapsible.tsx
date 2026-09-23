import { useState } from "react";
import { Button, CollapsibleContent } from "components-ui";

export default function Collapsible() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(!open)} size="sm" variant="outline">
        {open ? "Hide" : "Show"} advanced settings
      </Button>
      <CollapsibleContent isOpen={open}>
        <div className="mt-3 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          The content animates its height in and out and is unmounted when
          closed.
        </div>
      </CollapsibleContent>
    </div>
  );
}
