import { Slider } from "components-ui";

export default function Sizes() {
  return (
    <div className="grid max-w-md gap-6">
      <Slider aria-label="Small" defaultValue={30} size="sm" />
      <Slider aria-label="Medium" defaultValue={50} />
      <Slider aria-label="Large" defaultValue={70} size="lg" />
      <Slider
        defaultValue={[20, 90]}
        error="The range may span 50 at most."
        label="With an error"
      />
      <Slider defaultValue={60} disabled label="Disabled" />
    </div>
  );
}
