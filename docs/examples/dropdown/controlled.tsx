import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import {
  Dropdown,
  IconButton,
  Kbd,
  useHotkeys,
  useSnackbar,
} from "components-ui";

export default function Controlled() {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // Opened by a shortcut too - the menu takes the focus as on a click
  useHotkeys([["alt+m", () => setOpen(true)]]);

  return (
    <div className="flex items-center gap-3">
      <Dropdown
        aria-label="Actions"
        buttonTrigger
        items={[
          { label: "Share", onClick: () => enqueueSnackbar("Shared") },
          { label: "Export", onClick: () => enqueueSnackbar("Exported") },
        ]}
        onOpenChange={setOpen}
        open={open}
        trigger={
          <IconButton aria-keyshortcuts="Alt+M">
            <MoreHorizontal size={18} />
          </IconButton>
        }
      />
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        {open ? "Open" : "Closed"} - or press <Kbd shortcut="alt+m" />
      </span>
    </div>
  );
}
