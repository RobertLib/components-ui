import { useState } from "react";
import { Button, DateRangePicker } from "components-ui";

// No state for the field: the days go to the form as `from` and `to`
export default function Form() {
  const [submitted, setSubmitted] = useState<Record<string, unknown>>();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-4"
        onReset={() => setSubmitted(undefined)}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <DateRangePicker
          defaultValue={{ end: "2026-09-30", start: "2026-09-01" }}
          endName="to"
          label="Invoice date"
          required
          startName="from"
        />
        <div className="flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="reset" variant="outline">
            Reset
          </Button>
        </div>
      </form>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {submitted
          ? JSON.stringify(submitted, null, 2)
          : "Submit the form to see its FormData"}
      </pre>
    </div>
  );
}
