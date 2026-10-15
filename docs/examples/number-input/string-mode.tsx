import { useState } from "react";
import { NumberInput } from "components-ui";

// Amounts of an invoice as exact decimal strings - as an accounting API
// sends and takes them
export default function StringMode() {
  const [amount, setAmount] = useState<string | null>("1234.50");
  const [balance, setBalance] = useState<string | null>("98765432109876543.21");

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid gap-4">
        <NumberInput
          formatOptions={{ currency: "CZK", style: "currency" }}
          label="Invoice amount"
          min="0"
          name="amount"
          onChange={setAmount}
          step="0.10"
          stringMode
          value={amount}
        />
        <NumberInput
          description="Beyond 2^53 - a number would lose its last digits."
          formatOptions={{ maximumFractionDigits: 2 }}
          label="Ledger balance"
          onChange={setBalance}
          step="0.01"
          stringMode
          value={balance}
        />
      </div>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {JSON.stringify({ amount, balance }, null, 2)}
      </pre>
    </div>
  );
}
