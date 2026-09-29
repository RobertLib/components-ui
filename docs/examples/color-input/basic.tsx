import { useState } from "react";
import { ColorInput } from "components-ui";

export default function Basic() {
  const [color, setColor] = useState("#2563eb");

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <ColorInput
          description="Type a color or pick one - hex, rgb() or hsl()."
          label="Brand color"
          name="brand"
          onChange={setColor}
          value={color}
        />
        <p className="mt-2 flex items-center gap-2 text-sm">
          Value: <code>{JSON.stringify(color)}</code>
          <span
            className="inline-block size-4 rounded border border-neutral-300 dark:border-neutral-700"
            style={{ backgroundColor: color }}
          />
        </p>
      </div>
      <ColorInput defaultValue="#16a34a" label="Uncontrolled" />
    </div>
  );
}
