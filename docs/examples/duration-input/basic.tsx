import { useState } from "react";
import { DurationInput } from "components-ui";

const tasks = [
  { id: "analysis", name: "Requirements analysis - ERP for Stavby Novák" },
  { id: "meeting", name: "Client meeting in Brno" },
  { id: "invoices", name: "Fixing the invoice export" },
];

// A day of a work report - minutes in, the total from them
export default function Basic() {
  const [minutes, setMinutes] = useState<Record<string, number | null>>({
    analysis: 150,
    meeting: 90,
    invoices: null,
  });

  const total = Object.values(minutes).reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );

  return (
    <div className="grid max-w-lg gap-3">
      {tasks.map((task) => (
        <DurationInput
          key={task.id}
          label={task.name}
          max={24 * 60}
          onChange={(value) =>
            setMinutes((current) => ({ ...current, [task.id]: value }))
          }
          placeholder="1:30"
          value={minutes[task.id]}
        />
      ))}
      <DurationInput
        description="Read-only - the sum of the tasks."
        label="Total for the day"
        readOnly
        value={total}
      />
    </div>
  );
}
