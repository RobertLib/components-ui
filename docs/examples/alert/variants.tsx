import { Alert } from "components-ui";

const types = ["info", "success", "warning", "danger"] as const;

export default function Variants() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {(["subtle", "solid", "outline"] as const).map((variant) => (
        <div className="space-y-3" key={variant}>
          {types.map((type) => (
            <Alert key={type} type={type} variant={variant}>
              A {variant} {type} alert.
            </Alert>
          ))}
        </div>
      ))}
    </div>
  );
}
