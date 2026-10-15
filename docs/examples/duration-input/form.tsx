import { useState } from "react";
import { Button, DurationInput, Input } from "components-ui";

// The form gets minutes ("90") - whatever the field shows
export default function Form() {
  const [submitted, setSubmitted] = useState<Record<string, string>>();

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <form
        className="grid gap-4"
        onReset={() => setSubmitted(undefined)}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(
            Object.fromEntries(new FormData(event.currentTarget)) as Record<
              string,
              string
            >,
          );
        }}
      >
        <Input defaultValue="Server room inspection" label="Task" name="task" />
        <DurationInput
          defaultValue={45}
          label="Travel time"
          max={240}
          name="travel"
        />
        <DurationInput
          description="From 15 minutes to 12 hours."
          label="Work time"
          max={12 * 60}
          min={15}
          name="work"
          required
        />
        <div className="flex gap-2">
          <Button type="submit">Submit</Button>
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
