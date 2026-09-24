import { useState } from "react";
import { Slider, useLocale } from "components-ui";

export default function Range() {
  const { code } = useLocale();
  const [price, setPrice] = useState<[number, number]>([2000, 8000]);
  // What a server would be asked for - once a drag is done, not on every step
  const [loaded, setLoaded] = useState(price);
  const currency = new Intl.NumberFormat(code, {
    currency: "CZK",
    maximumFractionDigits: 0,
    style: "currency",
  });

  return (
    <div className="max-w-md space-y-3">
      <Slider
        formatValue={(value) => currency.format(value)}
        label="Price"
        max={10000}
        minDistance={1000}
        name="price"
        onChange={setPrice}
        onChangeEnd={setLoaded}
        showValue
        step={500}
        value={price}
      />
      <p className="text-sm">
        Products for {currency.format(loaded[0])} to{" "}
        {currency.format(loaded[1])} loaded.
      </p>
    </div>
  );
}
