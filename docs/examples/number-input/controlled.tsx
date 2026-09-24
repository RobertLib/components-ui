import { useState } from "react";
import { NumberInput, useLocale } from "components-ui";

export default function Controlled() {
  const { code } = useLocale();
  const [quantity, setQuantity] = useState<number | null>(3);
  const [unitPrice, setUnitPrice] = useState<number | null>(249.9);

  // Updated while typing - not only when the field loses the focus
  const total = (quantity ?? 0) * (unitPrice ?? 0);

  return (
    <div className="grid max-w-md gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberInput
          label="Quantity"
          maximumFractionDigits={0}
          min={1}
          onChange={setQuantity}
          value={quantity}
        />
        <NumberInput
          formatOptions={{ currency: "CZK", style: "currency" }}
          label="Unit price"
          min={0}
          onChange={setUnitPrice}
          value={unitPrice}
        />
      </div>
      <p className="text-sm">
        Total:{" "}
        <strong>
          {new Intl.NumberFormat(code, {
            currency: "CZK",
            style: "currency",
          }).format(total)}
        </strong>
      </p>
    </div>
  );
}
