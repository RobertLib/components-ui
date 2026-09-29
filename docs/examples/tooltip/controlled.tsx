import { useState } from "react";
import { Button, Switch, Tooltip } from "components-ui";

export default function Controlled() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-6 py-4">
      <Tooltip
        onOpenChange={setOpen}
        // Pinned, it stays - hover, focus and Escape only ask to change it
        open={pinned || open}
        position="end"
        title="Saved drafts are kept for 30 days"
      >
        <Button variant="outline">Drafts</Button>
      </Tooltip>
      <Switch
        checked={pinned}
        label="Keep the tooltip shown"
        onChange={(event) => setPinned(event.target.checked)}
      />
    </div>
  );
}
