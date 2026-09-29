import { useState } from "react";
import { Chip, DescriptionList, SegmentedControl, Switch } from "components-ui";

const columnOptions = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
] satisfies { label: string; value: 1 | 2 | 3 | 4 }[];

export default function Columns() {
  const [columns, setColumns] = useState<1 | 2 | 3 | 4>(3);
  const [bordered, setBordered] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          aria-label="Columns"
          dim="sm"
          onChange={setColumns}
          options={columnOptions}
          value={columns}
        />
        <Switch
          checked={bordered}
          label="Bordered"
          onChange={(event) => setBordered(event.target.checked)}
        />
      </div>
      {/* Two columns from sm, all of them from lg - stacked on phones */}
      <DescriptionList
        bordered={bordered}
        columns={columns}
        items={[
          { desc: "INV-2026-0042", term: "Invoice" },
          { desc: <Chip color="success">Paid</Chip>, term: "Status" },
          { desc: "September 24, 2026", term: "Issued" },
          { desc: "October 8, 2026", term: "Due" },
          { desc: "$1,250.00", term: "Total" },
          { desc: "Bank transfer", term: "Payment" },
          {
            desc: "Delivered to the reception, signed by J. Nováková.",
            fullWidth: true,
            term: "Note",
          },
        ]}
      />
    </div>
  );
}
