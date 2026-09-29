import { Building2 } from "lucide-react";
import { Input } from "components-ui";

const optional = (
  <span className="font-normal text-neutral-500 dark:text-neutral-400">
    (optional)
  </span>
);

export default function Labels() {
  return (
    <div className="grid max-w-md gap-5">
      <Input
        label={
          <span className="inline-flex items-center gap-1">
            <Building2 aria-hidden="true" size={14} />
            Company
          </span>
        }
        required
      />
      <Input label={<>VAT ID {optional}</>} />
      <Input floating label={<>Work email {optional}</>} type="email" />
      <Input
        clearable
        defaultValue="INV-2026-0042"
        description="Given by the system - it can be copied, not changed."
        label="Invoice number"
        readOnly
      />
    </div>
  );
}
