import { useState } from "react";
import { Button, RadioGroup } from "components-ui";

export default function ReadOnly() {
  const [submitted, setSubmitted] = useState<string>();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitted(JSON.stringify(Object.fromEntries(data)));
      }}
    >
      <RadioGroup
        defaultValue="monthly"
        description="Billing can be changed once the current period ends."
        label="Billing"
        name="billing"
        options={[
          { label: "Monthly", value: "monthly" },
          { label: "Yearly", value: "yearly" },
        ]}
        orientation="horizontal"
        readOnly
      />
      <Button size="sm" type="submit">
        Submit
      </Button>
      {submitted && (
        <p className="text-sm">
          Submitted: <code>{submitted}</code>
        </p>
      )}
    </form>
  );
}
