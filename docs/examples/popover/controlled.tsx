import { useState } from "react";
import { Button, Input, Popover } from "components-ui";

export default function Controlled() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("Draft");

  return (
    <Popover
      align="left"
      contentClassName="w-64 p-3"
      onOpenChange={setOpen}
      open={open}
      position="bottom"
      trigger={<Button variant="outline">Label: {label}</Button>}
      triggerType="click"
    >
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setLabel(String(data.get("label") || "Draft"));
          setOpen(false);
        }}
      >
        <Input defaultValue={label} dim="sm" label="Label" name="label" />
        <Button size="sm" type="submit">
          Apply
        </Button>
      </form>
    </Popover>
  );
}
