import { Timer } from "lucide-react";
import { DurationInput } from "components-ui";

export default function Sizes() {
  return (
    <div className="grid max-w-md gap-4">
      <DurationInput aria-label="Extra small" defaultValue={15} dim="xs" />
      <DurationInput aria-label="Small" defaultValue={30} dim="sm" />
      <DurationInput aria-label="Medium" defaultValue={45} />
      <DurationInput aria-label="Large" defaultValue={60} dim="lg" />
      <DurationInput floating label="Floating label" />
      <DurationInput
        clearable
        defaultValue={90}
        label="With a prefix and a clear button"
        prefix={<Timer aria-hidden="true" size={16} />}
      />
      <DurationInput
        defaultValue={600}
        error="At most 8 hours a day."
        label="With an error"
      />
      <DurationInput defaultValue={480} disabled label="Disabled" />
      <DurationInput
        defaultValue={480}
        description="Still submitted, but the keys do not step it."
        label="Read-only"
        readOnly
      />
    </div>
  );
}
