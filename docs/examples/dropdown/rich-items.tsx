import {
  Copy,
  MoreHorizontal,
  Pencil,
  Printer,
  Send,
  Trash2,
} from "lucide-react";
import { Dropdown, IconButton, useSnackbar } from "components-ui";

export default function RichItems() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="min-w-0">
        <div className="truncate font-medium">Invoice 2026-041</div>
        <div className="truncate text-sm text-neutral-500 dark:text-neutral-400">
          Acme s.r.o. · 12 400 Kč
        </div>
      </div>
      <Dropdown
        buttonTrigger
        items={[
          {
            icon: <Pencil size={16} />,
            label: "Edit",
            onClick: () => enqueueSnackbar("Edit clicked"),
            shortcut: "mod+e",
          },
          {
            icon: <Copy size={16} />,
            label: "Duplicate",
            onClick: () => enqueueSnackbar("Invoice duplicated", "success"),
            shortcut: "mod+d",
          },
          {
            description: "Sends the PDF to the customer",
            icon: <Send size={16} />,
            label: "Send by e-mail",
            onClick: () => enqueueSnackbar("Invoice sent", "success"),
          },
          {
            description: "No printer is connected",
            disabled: true,
            icon: <Printer size={16} />,
            label: "Print",
          },
          { type: "separator" },
          {
            danger: true,
            icon: <Trash2 size={16} />,
            label: "Delete",
            onClick: () => enqueueSnackbar("Invoice deleted", "error"),
            shortcut: "delete",
          },
        ]}
        trigger={
          <IconButton aria-label="Invoice actions">
            <MoreHorizontal size={18} />
          </IconButton>
        }
      />
    </div>
  );
}
