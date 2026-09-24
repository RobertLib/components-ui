import { useState } from "react";
import { PinInput } from "components-ui";

export default function Variants() {
  const [voucher, setVoucher] = useState("");

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <PinInput
          label="Voucher"
          length={8}
          onChange={(code) => setVoucher(code.toUpperCase())}
          placeholder="·"
          type="alphanumeric"
          value={voucher}
        />
        <p className="mt-2 text-sm">
          Value: <code>{JSON.stringify(voucher)}</code>
        </p>
      </div>
      <PinInput dim="lg" label="Card PIN (masked)" length={4} mask />
      <PinInput defaultValue="4821" dim="sm" label="Small" length={4} />
      <PinInput defaultValue="93" disabled label="Disabled" length={4} />
    </div>
  );
}
