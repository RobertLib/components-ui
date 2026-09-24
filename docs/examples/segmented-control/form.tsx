import { useState } from "react";
import { Button, SegmentedControl } from "components-ui";

export default function Form() {
  const [submitted, setSubmitted] = useState<string>();

  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitted(JSON.stringify(Object.fromEntries(data)));
      }}
    >
      <SegmentedControl
        description="Yearly billing saves 15 %."
        label="Billing period"
        name="billing"
        options={[
          { label: "Monthly", value: "monthly" },
          { label: "Yearly", value: "yearly" },
        ]}
        required
      />
      <SegmentedControl
        defaultValue={1}
        error="The team plan needs at least 5 seats."
        label="Seats"
        name="seats"
        options={[1, 5, 10, 25].map((seats) => ({
          label: String(seats),
          value: seats,
        }))}
      />
      <Button size="sm" type="submit">
        Subscribe
      </Button>
      {submitted && (
        <p className="text-sm">
          Submitted: <code>{submitted}</code>
        </p>
      )}
    </form>
  );
}
