import { useState } from "react";
import { DateCalendar } from "components-ui";

// Several days - a click adds a day or removes it
export default function Multiple() {
  const [days, setDays] = useState<string[]>(["2026-09-24", "2026-09-25"]);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <DateCalendar
        label="Days off"
        multiple
        name="daysOff"
        onChange={setDays}
        value={days}
      />
      <p className="text-sm">
        Value: <code>{JSON.stringify(days)}</code>
      </p>
    </div>
  );
}
