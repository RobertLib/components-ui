import { useState } from "react";
import { Button, NumberInput } from "components-ui";

// The form gets plain numbers ("1234.5") - whatever the language shows
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
        <NumberInput
          defaultValue={1234.5}
          formatOptions={{ currency: "EUR", style: "currency" }}
          label="Amount"
          min={0}
          name="amount"
          required
        />
        <NumberInput
          label="Installments"
          max={24}
          maximumFractionDigits={0}
          min={1}
          name="installments"
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
