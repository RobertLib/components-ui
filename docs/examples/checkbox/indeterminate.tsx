import { useState } from "react";
import { Checkbox } from "components-ui";

const reports = ["Sales", "Inventory", "Invoices"];

export default function Indeterminate() {
  const [selected, setSelected] = useState(["Sales"]);

  return (
    <div className="space-y-2">
      <Checkbox
        checked={selected.length === reports.length}
        indeterminate={selected.length > 0 && selected.length < reports.length}
        label="All reports"
        onChange={(event) => setSelected(event.target.checked ? reports : [])}
      />
      <div className="space-y-2 pl-6">
        {reports.map((report) => (
          <Checkbox
            checked={selected.includes(report)}
            key={report}
            label={report}
            onChange={(event) =>
              setSelected((current) =>
                event.target.checked
                  ? [...current, report]
                  : current.filter((item) => item !== report),
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
