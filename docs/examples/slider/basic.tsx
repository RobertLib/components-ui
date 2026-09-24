import { useState } from "react";
import { Slider } from "components-ui";

export default function Basic() {
  const [discount, setDiscount] = useState(15);

  return (
    <div className="grid max-w-md gap-8">
      <Slider
        description="Applies to the whole order."
        formatValue={(value) => `${value} %`}
        label="Discount"
        max={50}
        name="discount"
        onChange={setDiscount}
        showValue
        step={5}
        value={discount}
      />
      <Slider defaultValue={40} label="Volume" valueLabel="always" />
    </div>
  );
}
