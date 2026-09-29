import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { Button, Dropdown, useSnackbar } from "components-ui";

export default function Placement() {
  const { enqueueSnackbar } = useSnackbar();
  const items = [
    { label: "Rename", onClick: () => enqueueSnackbar("Rename") },
    { label: "Move", onClick: () => enqueueSnackbar("Move") },
    { label: "Delete", danger: true, onClick: () => enqueueSnackbar("Delete") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      {/* Below, from the start edge of the button */}
      <Dropdown
        align="start"
        buttonTrigger
        items={items}
        trigger={
          <Button variant="outline">
            Below, start <ChevronDown aria-hidden="true" size={16} />
          </Button>
        }
      />
      {/* Above, centered on it */}
      <Dropdown
        align="center"
        buttonTrigger
        items={items}
        position="top"
        trigger={
          <Button variant="outline">
            Above, centered <ChevronUp aria-hidden="true" size={16} />
          </Button>
        }
      />
      {/* Beside it, towards the end of the line - to the left right to left */}
      <Dropdown
        buttonTrigger
        items={items}
        offset={6}
        position="end"
        trigger={
          <Button variant="outline">
            Beside <ChevronRight aria-hidden="true" size={16} />
          </Button>
        }
      />
    </div>
  );
}
