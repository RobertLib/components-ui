import {
  Archive,
  Copy,
  Download,
  Mail,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Toolbar, useSnackbar } from "components-ui";

// Drag the corner of the frame - the items move into the "More" menu by
// priority, then from the end
export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();
  const [showArchived, setShowArchived] = useState(false);
  const notify = (text: string) => () => enqueueSnackbar(text);

  return (
    <div className="w-180 max-w-full min-w-24 resize-x overflow-hidden rounded-md border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
      <Toolbar
        aria-label="Invoices"
        items={[
          {
            color: "primary",
            icon: <Plus size={16} />,
            id: "new",
            label: "New invoice",
            onClick: notify("New invoice"),
            // The main action stays longest
            priority: 2,
            variant: "solid",
          },
          {
            icon: <Pencil size={16} />,
            id: "edit",
            label: "Edit",
            onClick: notify("Edit"),
            priority: 1,
          },
          {
            icon: <Copy size={16} />,
            id: "duplicate",
            label: "Duplicate",
            onClick: notify("Duplicate"),
          },
          {
            icon: <Mail size={16} />,
            id: "send",
            label: "Send by e-mail",
            onClick: notify("Sent to novak@stavby.cz"),
          },
          { type: "separator" },
          {
            id: "archived",
            label: "Show archived",
            onPressedChange: setShowArchived,
            pressed: showArchived,
            type: "toggle",
          },
          { type: "separator" },
          {
            icon: <Download size={16} />,
            iconOnly: true,
            id: "export",
            label: "Export to CSV",
            onClick: notify("Exported"),
          },
          {
            icon: <Printer size={16} />,
            iconOnly: true,
            id: "print",
            label: "Print",
            onClick: notify("Print"),
          },
          {
            icon: <RefreshCw size={16} />,
            iconOnly: true,
            id: "refresh",
            label: "Refresh",
            onClick: notify("Refreshed"),
            // Goes first
            priority: -1,
          },
          { type: "separator" },
          // Used rarely - always in the menu
          {
            icon: <Archive size={16} />,
            id: "archive",
            label: "Archive",
            menuOnly: true,
            onClick: notify("Archived"),
          },
          {
            color: "danger",
            icon: <Trash2 size={16} />,
            id: "delete",
            label: "Delete",
            menuOnly: true,
            onClick: notify("Deleted"),
          },
        ]}
      />
    </div>
  );
}
