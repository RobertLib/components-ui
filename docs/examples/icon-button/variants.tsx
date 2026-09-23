import { Pencil, Settings, Star, Trash2 } from "lucide-react";
import { IconButton } from "components-ui";

export default function Variants() {
  return (
    <div className="flex items-center gap-4">
      <IconButton aria-label="Settings">
        <Settings size={18} />
      </IconButton>
      <IconButton aria-label="Favorite" variant="primary">
        <Star size={18} />
      </IconButton>
      <IconButton aria-label="Edit" variant="secondary">
        <Pencil size={18} />
      </IconButton>
      <IconButton aria-label="Delete" variant="danger">
        <Trash2 size={18} />
      </IconButton>
    </div>
  );
}
