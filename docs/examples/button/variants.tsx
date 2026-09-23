import { Button } from "components-ui";

export default function Variants() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button>Solid</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  );
}
