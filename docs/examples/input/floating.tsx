import { Input } from "components-ui";

export default function Floating() {
  return (
    <div className="grid max-w-md gap-6 pt-2">
      <Input floating label="City" />
      <Input defaultValue="Prague" floating label="City with a value" />
      <Input floating label="Departure" type="date" />
    </div>
  );
}
