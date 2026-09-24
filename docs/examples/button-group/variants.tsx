import { AlignCenter, AlignLeft, AlignRight, Redo2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button, ButtonGroup } from "components-ui";

const alignments = [
  { icon: <AlignLeft size={16} />, label: "Align left", value: "left" },
  { icon: <AlignCenter size={16} />, label: "Center", value: "center" },
  { icon: <AlignRight size={16} />, label: "Align right", value: "right" },
];

export default function Variants() {
  const [align, setAlign] = useState("left");

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ButtonGroup aria-label="Review">
        <Button color="success">Approve</Button>
        <Button color="danger">Reject</Button>
      </ButtonGroup>

      {/* Toggle buttons tell their state with aria-pressed */}
      <ButtonGroup
        aria-label="Text alignment"
        color="default"
        size="icon"
        variant="outline"
      >
        {alignments.map((option) => (
          <Button
            aria-label={option.label}
            aria-pressed={align === option.value}
            key={option.value}
            onClick={() => setAlign(option.value)}
            // The pressed one filled, the others take the outline of the group
            variant={align === option.value ? "solid" : undefined}
          >
            {option.icon}
          </Button>
        ))}
      </ButtonGroup>

      <ButtonGroup
        aria-label="History"
        color="secondary"
        size="sm"
        variant="ghost"
      >
        <Button startIcon={<Undo2 size={14} />}>Undo</Button>
        <Button startIcon={<Redo2 size={14} />}>Redo</Button>
      </ButtonGroup>
    </div>
  );
}
