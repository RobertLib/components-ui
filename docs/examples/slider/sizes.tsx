import { Slider } from "components-ui";

export default function Sizes() {
  return (
    <div className="grid max-w-md gap-6">
      <Slider aria-label="Extra small" defaultValue={20} dim="xs" />
      <Slider aria-label="Small" defaultValue={30} dim="sm" />
      <Slider aria-label="Medium" defaultValue={50} />
      <Slider aria-label="Large" defaultValue={70} dim="lg" />
      <Slider
        defaultValue={[20, 90]}
        error="The range may span 50 at most."
        label="With an error"
      />
      <Slider defaultValue={60} disabled label="Disabled" />
      <Slider
        defaultValue={80}
        description="Set by your administrator - it is still submitted."
        label="Read-only"
        name="quota"
        readOnly
        showValue
      />
    </div>
  );
}
