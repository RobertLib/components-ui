import { useState } from "react";
import { Button, Dialog, type DialogSize } from "components-ui";

const sizes: DialogSize[] = ["sm", "md", "lg", "xl", "2xl", "full"];

export default function Sizes() {
  const [size, setSize] = useState<DialogSize | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {sizes.map((value) => (
        <Button key={value} onClick={() => setSize(value)} variant="outline">
          {value}
        </Button>
      ))}
      <Dialog
        onClose={() => setSize(null)}
        open={size !== null}
        size={size ?? "sm"}
        title={`Size ${size}`}
      >
        <p className="text-sm">
          The dialog is at most this wide from the <code>sm</code> breakpoint
          up; on phones it takes almost the whole width.
        </p>
      </Dialog>
    </div>
  );
}
