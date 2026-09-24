import { ChevronDown, Copy, Pencil, Trash2 } from "lucide-react";
import { Button, ButtonGroup, Dropdown, useSnackbar } from "components-ui";

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <ButtonGroup aria-label="Invoice actions" color="default" variant="outline">
      <Button
        onClick={() => enqueueSnackbar("Edit clicked")}
        startIcon={<Pencil size={16} />}
      >
        Edit
      </Button>
      <Button
        onClick={() => enqueueSnackbar("Invoice duplicated", "success")}
        startIcon={<Copy size={16} />}
      >
        Duplicate
      </Button>
      {/* A Dropdown with a button trigger joins the group as well */}
      <Dropdown
        buttonTrigger
        items={[
          {
            label: "Archive",
            onClick: () => enqueueSnackbar("Invoice archived"),
          },
          {
            danger: true,
            icon: <Trash2 size={16} />,
            label: "Delete",
            onClick: () => enqueueSnackbar("Invoice deleted", "error"),
          },
        ]}
        trigger={
          <Button aria-label="More actions">
            <ChevronDown size={16} />
          </Button>
        }
      />
    </ButtonGroup>
  );
}
