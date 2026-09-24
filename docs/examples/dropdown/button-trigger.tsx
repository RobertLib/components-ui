import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Button, Dropdown, IconButton, useSnackbar } from "components-ui";

export default function ButtonTrigger() {
  const { enqueueSnackbar } = useSnackbar();
  const items = [
    { label: "Export as CSV", onClick: () => enqueueSnackbar("CSV exported") },
    { label: "Export as PDF", onClick: () => enqueueSnackbar("PDF exported") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* The button is the menu button itself - one tab stop, with its
          aria-expanded */}
      <Dropdown
        buttonTrigger
        items={items}
        trigger={
          <Button variant="outline">
            Export <ChevronDown className="ml-1" size={16} />
          </Button>
        }
      />
      <Dropdown
        buttonTrigger
        items={items}
        trigger={
          <IconButton aria-label="More actions">
            <MoreHorizontal size={18} />
          </IconButton>
        }
      />
    </div>
  );
}
