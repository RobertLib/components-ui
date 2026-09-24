import { useState } from "react";
import { Button, Checkbox, Sheet, type SheetSide } from "components-ui";

const sides: SheetSide[] = ["right", "left", "top", "bottom"];

export default function Sides() {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<SheetSide>("right");

  return (
    <div className="flex flex-wrap gap-2">
      {sides.map((value) => (
        <Button
          key={value}
          onClick={() => {
            setSide(value);
            setOpen(true);
          }}
          variant="outline"
        >
          {value}
        </Button>
      ))}
      <Sheet
        closeOnBackdropClick
        onClose={() => setOpen(false)}
        open={open}
        side={side}
        size="sm"
        title="Filters"
      >
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Order status</legend>
          <Checkbox defaultChecked label="New" name="status" value="new" />
          <Checkbox defaultChecked label="Paid" name="status" value="paid" />
          <Checkbox label="Shipped" name="status" value="shipped" />
          <Checkbox label="Cancelled" name="status" value="cancelled" />
        </fieldset>
      </Sheet>
    </div>
  );
}
