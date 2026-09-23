import { Plus } from "lucide-react";
import { Button } from "components-ui";

export default function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button aria-label="Add" size="icon">
        <Plus size={16} />
      </Button>
      <Button>
        <Plus className="mr-1" size={16} />
        With icon
      </Button>
    </div>
  );
}
