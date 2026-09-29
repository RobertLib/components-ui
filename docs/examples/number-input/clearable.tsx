import { useState } from "react";
import { NumberInput } from "components-ui";

export default function Clearable() {
  const [discount, setDiscount] = useState<number | null>(0.15);

  return (
    <div className="grid max-w-md gap-4">
      <NumberInput
        clearable
        formatOptions={{ style: "percent" }}
        label="Discount"
        max={1}
        min={0}
        onChange={setDiscount}
        value={discount}
      />
      <p className="text-sm">
        Value: <code>{JSON.stringify(discount)}</code>
      </p>
      <NumberInput
        clearable
        defaultValue={1250}
        description="Read-only - no step buttons and no clear button."
        formatOptions={{ currency: "CZK", style: "currency" }}
        label="Price from the price list"
        readOnly
      />
    </div>
  );
}
