import { Button } from "components-ui";

const colors = [
  "primary",
  "secondary",
  "success",
  "danger",
  "warning",
  "default",
] as const;

export default function Colors() {
  return (
    <div className="space-y-3">
      {(["solid", "outline", "ghost"] as const).map((variant) => (
        <div className="flex flex-wrap gap-3" key={variant}>
          {colors.map((color) => (
            <Button color={color} key={color} variant={variant}>
              {color}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
