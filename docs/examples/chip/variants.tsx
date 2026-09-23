import { Chip } from "components-ui";

const colors = [
  "primary",
  "secondary",
  "success",
  "danger",
  "warning",
  "info",
  "neutral",
] as const;

export default function Variants() {
  return (
    <div className="space-y-3">
      {(["default", "outline", "solid"] as const).map((variant) => (
        <div className="flex flex-wrap gap-2" key={variant}>
          {colors.map((color) => (
            <Chip color={color} key={color} variant={variant}>
              {color}
            </Chip>
          ))}
        </div>
      ))}
    </div>
  );
}
