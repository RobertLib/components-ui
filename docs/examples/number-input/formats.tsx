import { useState } from "react";
import { NumberInput } from "components-ui";

// Switch the language of the docs to see the Czech notation
export default function Formats() {
  const [price, setPrice] = useState<number | null>(1234.5);
  const [vat, setVat] = useState<number | null>(0.21);
  const [weight, setWeight] = useState<number | null>(12.5);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid gap-4">
        <NumberInput
          formatOptions={{ currency: "CZK", style: "currency" }}
          label="Price"
          min={0}
          onChange={setPrice}
          value={price}
        />
        <NumberInput
          formatOptions={{ maximumFractionDigits: 1, style: "percent" }}
          label="VAT rate"
          max={1}
          min={0}
          onChange={setVat}
          step={0.01}
          value={vat}
        />
        <NumberInput
          formatOptions={{ style: "unit", unit: "kilogram" }}
          label="Net weight"
          min={0}
          onChange={setWeight}
          value={weight}
        />
      </div>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {JSON.stringify({ price, vat, weight }, null, 2)}
      </pre>
    </div>
  );
}
