import { useState } from "react";
import { DateTimePicker } from "components-ui";

export default function Controlled() {
  const [startsAt, setStartsAt] = useState("2026-09-24T09:30");

  return (
    <div className="max-w-xs space-y-3">
      <DateTimePicker
        label="Starts at"
        onChange={(event) => setStartsAt(event.target.value)}
        type="datetime-local"
        value={startsAt}
      />
      <p className="text-sm">
        Value: <code>{JSON.stringify(startsAt)}</code>
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        The value keeps the native format whatever the display format - switch
        the component language (EN / CS) in the top bar.
      </p>
    </div>
  );
}
