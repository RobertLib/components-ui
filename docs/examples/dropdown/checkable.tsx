import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button, Dropdown } from "components-ui";

const columns = ["Customer", "Amount", "Due date"];

export default function Checkable() {
  const [sortBy, setSortBy] = useState("due");
  const [visible, setVisible] = useState(columns);
  const [showPaid, setShowPaid] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        By {sortBy} · {visible.join(", ") || "no columns"}
        {showPaid && " · paid included"}
      </p>
      <Dropdown
        buttonTrigger
        items={[
          {
            label: "Sort by",
            onChange: setSortBy,
            options: [
              { label: "Due date", value: "due" },
              { label: "Amount", value: "amount" },
              { label: "Customer", value: "customer" },
            ],
            type: "radio",
            value: sortBy,
          },
          { type: "separator" },
          {
            // Stays open, so several columns can be toggled in a row
            items: columns.map((column) => ({
              checked: visible.includes(column),
              keepOpen: true,
              label: column,
              onCheckedChange: (checked: boolean) =>
                setVisible((current) =>
                  checked
                    ? columns.filter((c) => c === column || current.includes(c))
                    : current.filter((c) => c !== column),
                ),
            })),
            label: "Columns",
            type: "group",
          },
          { type: "separator" },
          {
            checked: showPaid,
            label: "Show paid invoices",
            onCheckedChange: setShowPaid,
          },
        ]}
        trigger={
          <Button startIcon={<SlidersHorizontal size={16} />} variant="outline">
            View
          </Button>
        }
      />
    </div>
  );
}
