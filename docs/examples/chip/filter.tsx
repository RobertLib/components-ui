import { useState } from "react";
import { Chip } from "components-ui";

const invoices = [
  { number: "2026-0141", status: "unpaid" },
  { number: "2026-0142", status: "overdue" },
  { number: "2026-0143", status: "paid" },
  { number: "2026-0144", status: "unpaid" },
  { number: "2026-0145", status: "paid" },
];

const statuses = [
  { label: "Unpaid", value: "unpaid" },
  { label: "Overdue", value: "overdue" },
  { label: "Paid", value: "paid" },
];

export default function Filter() {
  const [selected, setSelected] = useState(["unpaid", "overdue"]);
  const shown = invoices.filter((invoice) => selected.includes(invoice.status));

  return (
    <div className="space-y-3">
      <div aria-label="Status" className="flex flex-wrap gap-2" role="group">
        {statuses.map((status) => (
          <Chip
            color="primary"
            key={status.value}
            onSelectedChange={(isSelected) =>
              setSelected((current) =>
                isSelected
                  ? [...current, status.value]
                  : current.filter((value) => value !== status.value),
              )
            }
            selected={selected.includes(status.value)}
          >
            {status.label}
          </Chip>
        ))}
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {shown.length} of {invoices.length} invoices:{" "}
        {shown.map((invoice) => invoice.number).join(", ") || "none"}
      </p>
    </div>
  );
}
