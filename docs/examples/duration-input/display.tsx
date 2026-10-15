import { useState } from "react";
import { DurationInput } from "components-ui";

// Switch the language of the docs to see the Czech units
export default function Display() {
  const [minutes, setMinutes] = useState<number | null>(135);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid gap-4">
        <DurationInput
          description="Hours and minutes - the default."
          label="Clock"
          onChange={setMinutes}
          value={minutes}
        />
        <DurationInput
          description="The units of the language."
          display="units"
          label="Units"
          onChange={setMinutes}
          value={minutes}
        />
        <DurationInput
          defaultUnit="hours"
          description='A whole number is hours - "8" is 8:00.'
          label="Shift length"
          step={30}
        />
      </div>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {JSON.stringify({ minutes }, null, 2)}
      </pre>
    </div>
  );
}
