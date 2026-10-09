import { EllipsisVertical, Pencil } from "lucide-react";
import { Button, Dropdown, IconButton, useSnackbar } from "components-ui";

// Next to outline buttons - a menu of the less common actions
export default function Bordered() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button startIcon={<Pencil size={16} />} variant="outline">
        Edit
      </Button>
      <Dropdown
        align="end"
        buttonTrigger
        items={[
          { label: "Duplicate", onClick: () => enqueueSnackbar("Duplicated") },
          {
            danger: true,
            label: "Delete",
            onClick: () => enqueueSnackbar("Deleted"),
          },
        ]}
        trigger={
          <IconButton aria-label="More actions" bordered>
            <EllipsisVertical />
          </IconButton>
        }
      />
    </div>
  );
}
