import { NumberInput } from "components-ui";

export default function Sizes() {
  return (
    <div className="grid max-w-md gap-4">
      <NumberInput aria-label="Extra small" defaultValue={1} dim="xs" />
      <NumberInput aria-label="Small" defaultValue={2} dim="sm" />
      <NumberInput aria-label="Medium" defaultValue={3} />
      <NumberInput aria-label="Large" defaultValue={4} dim="lg" />
      <NumberInput floating label="Floating label" />
      <NumberInput
        defaultValue={150}
        error="At most 100 pieces per order."
        label="With an error"
      />
      <NumberInput defaultValue={5} disabled label="Disabled" />
      <NumberInput defaultValue={42} hideStepper label="Without buttons" />
    </div>
  );
}
