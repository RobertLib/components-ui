import { Bold, Italic, Underline } from "lucide-react";
import { Button, IconButton } from "components-ui";

export default function Sizes() {
  return (
    <div className="space-y-4">
      {(["sm", "md", "lg"] as const).map((size) => (
        // As high as a Button of the same size - they line up in a toolbar
        <div className="flex items-center gap-2" key={size}>
          <Button size={size} variant="outline">
            Save
          </Button>
          <IconButton aria-label="Bold" size={size} tooltip>
            <Bold />
          </IconButton>
          <IconButton aria-label="Italic" size={size} tooltip>
            <Italic />
          </IconButton>
          <IconButton aria-label="Underline" size={size} tooltip>
            <Underline />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
