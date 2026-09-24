import { NumberInput } from "components-ui";

export default function Basic() {
  return (
    <div className="grid max-w-md gap-4">
      <NumberInput
        changeOnWheel
        defaultValue={1}
        description="Also the mouse wheel changes it while the field has the focus."
        label="Quantity"
        max={99}
        maximumFractionDigits={0}
        min={1}
        name="quantity"
      />
      <NumberInput
        defaultValue={1234.5}
        label="Weight"
        min={0}
        name="weight"
        step={0.1}
        suffix="kg"
      />
      <NumberInput
        defaultValue={10}
        description="Up to 20 %, in steps of 5."
        label="Discount"
        max={20}
        min={0}
        name="discount"
        step={5}
        suffix="%"
      />
    </div>
  );
}
