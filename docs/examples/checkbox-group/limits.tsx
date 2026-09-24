import { useState } from "react";
import { Button, CheckboxGroup } from "components-ui";

const colleagues = [
  { label: "Anna Nováková", value: "anna" },
  { label: "Petr Svoboda", value: "petr" },
  { label: "Jana Dvořáková", value: "jana" },
  { label: "Tomáš Černý", value: "tomas" },
  { label: "Eva Procházková", value: "eva" },
];

// The browser refuses to submit fewer than `min` - `max` disables the rest
export default function Limits() {
  const [submitted, setSubmitted] = useState<FormDataEntryValue[]>();

  return (
    <form
      className="max-w-md space-y-4"
      onReset={() => setSubmitted(undefined)}
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(new FormData(event.currentTarget).getAll("reviewers"));
      }}
    >
      <CheckboxGroup
        description="Pick two or three colleagues."
        label="Reviewers"
        max={3}
        min={2}
        name="reviewers"
        options={colleagues}
      />
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          Request review
        </Button>
        <Button color="default" size="sm" type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {submitted && (
        <p className="text-sm">
          <code>getAll("reviewers")</code>:{" "}
          <code>{JSON.stringify(submitted)}</code>
        </p>
      )}
    </form>
  );
}
