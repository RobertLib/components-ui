import { useState } from "react";
import { Button, Select, Switch } from "components-ui";

const plans = [
  { label: "Basic", value: "basic" },
  { label: "Business", value: "business" },
  { label: "Enterprise", value: "enterprise" },
];

export default function ReadOnly() {
  const [locked, setLocked] = useState(true);
  const [submitted, setSubmitted] = useState<string>();

  return (
    <form
      className="grid max-w-md gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(
          JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
        );
      }}
    >
      <Switch
        checked={locked}
        label="Plan locked by the contract"
        onChange={(event) => setLocked(event.target.checked)}
      />
      <Select
        defaultValue="business"
        description={
          locked ? "Focusable and submitted, but it cannot be changed." : ""
        }
        label="Plan"
        name="plan"
        options={plans}
        readOnly={locked}
      />
      <Select
        defaultValue="basic"
        description="Disabled - left out of the form."
        disabled
        label="Previous plan"
        name="previous"
        options={plans}
      />
      <div className="flex items-center gap-3">
        <Button type="submit">Submit</Button>
        {submitted && <code className="text-sm">{submitted}</code>}
      </div>
    </form>
  );
}
