import { Mail, Search } from "lucide-react";
import { Input } from "components-ui";

export default function Adornments() {
  return (
    <div className="grid max-w-md gap-4">
      <Input
        aria-label="Search orders"
        placeholder="Search orders…"
        prefix={<Search size={16} />}
        type="search"
      />
      <Input label="Website" placeholder="example.com" prefix="https://" />
      <Input
        description="The unit is in the label for screen readers."
        inputMode="decimal"
        label="Price (Kč)"
        suffix="Kč"
      />
      <Input floating label="Email" prefix={<Mail size={16} />} type="email" />
      <Input
        defaultValue="120"
        error="The discount cannot exceed 100 %."
        label="Discount"
        suffix="%"
      />
      <Input defaultValue="250" disabled label="Weight" suffix="kg" />
    </div>
  );
}
