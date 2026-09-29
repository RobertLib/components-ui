import { useState } from "react";
import { Button, DateCalendar } from "components-ui";

export default function Controlled() {
  const [day, setDay] = useState<string | null>("2026-09-24");

  return (
    <div className="flex flex-wrap items-start gap-6">
      <DateCalendar label="Meeting day" onChange={setDay} value={day} />
      <div className="space-y-2 text-sm">
        <p>
          Value: <code>{JSON.stringify(day)}</code>
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => setDay("2026-12-24")}
            size="sm"
            variant="outline"
          >
            Christmas Eve
          </Button>
          <Button onClick={() => setDay(null)} size="sm" variant="ghost">
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
