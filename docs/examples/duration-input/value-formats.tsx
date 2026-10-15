import { useState } from "react";
import { DurationInput } from "components-ui";

// The SLA of a service desk contract is stored as ISO 8601 durations, the
// length of a support call in seconds - as the telephony system reports it
export default function ValueFormats() {
  const [firstResponse, setFirstResponse] = useState<string | null>("PT4H");
  const [resolution, setResolution] = useState<string | null>("P1DT8H");
  const [callLength, setCallLength] = useState<number | null>(1260);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid gap-4">
        <DurationInput
          description="Up to 8 hours, in steps of 30 minutes."
          display="units"
          label="First response"
          max={8 * 60}
          onChange={setFirstResponse}
          step={30}
          value={firstResponse}
          valueFormat="iso"
        />
        <DurationInput
          display="units"
          label="Resolution"
          onChange={setResolution}
          value={resolution}
          valueFormat="iso"
        />
        <DurationInput
          label="Call length"
          onChange={setCallLength}
          step={1}
          value={callLength}
          valueFormat="seconds"
        />
      </div>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {JSON.stringify({ firstResponse, resolution, callLength }, null, 2)}
      </pre>
    </div>
  );
}
