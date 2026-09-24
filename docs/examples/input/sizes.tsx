import { Input } from "components-ui";

export default function Sizes() {
  return (
    <div className="grid max-w-md gap-4">
      <Input dim="xs" placeholder="Extra small" />
      <Input dim="sm" placeholder="Small" />
      <Input dim="md" placeholder="Medium (default)" />
      <Input dim="lg" placeholder="Large" />
    </div>
  );
}
