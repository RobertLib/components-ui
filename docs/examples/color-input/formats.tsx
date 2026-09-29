import { useState } from "react";
import { ColorInput } from "components-ui";

const swatches = [
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Amber", value: "#d97706" },
  { label: "Green", value: "#16a34a" },
  { label: "Teal", value: "#0d9488" },
  { label: "Blue", value: "#2563eb" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
  { label: "Gray", value: "#6b7280" },
  { label: "Half-transparent black", value: "rgba(0, 0, 0, 0.5)" },
];

export default function Formats() {
  const [overlay, setOverlay] = useState("rgba(37, 99, 235, 0.6)");

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <ColorInput defaultValue="rgb(22, 163, 74)" format="rgb" label="rgb()" />
      <ColorInput
        defaultValue="hsl(262, 83%, 58%)"
        format="hsl"
        label="hsl()"
      />
      <div>
        <ColorInput
          alpha
          format="rgb"
          label="Overlay (with alpha and swatches)"
          onChange={setOverlay}
          swatches={swatches}
          value={overlay}
        />
        <div className="mt-2 flex h-10 items-center justify-center rounded-md bg-[repeating-conic-gradient(var(--color-neutral-300)_0_25%,white_0_50%)] bg-size-[12px_12px] dark:bg-[repeating-conic-gradient(var(--color-neutral-600)_0_25%,var(--color-neutral-800)_0_50%)]">
          <div
            className="h-full w-full rounded-md"
            style={{ backgroundColor: overlay }}
          />
        </div>
      </div>
      <ColorInput
        defaultValue="#2563eb"
        eyeDropper={false}
        label="Swatches, no eye dropper"
        swatches={swatches.slice(0, 9)}
      />
    </div>
  );
}
