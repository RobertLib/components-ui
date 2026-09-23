import { useState } from "react";
import { RadioGroup } from "components-ui";

export default function Basic() {
  const [plan, setPlan] = useState<number>(2);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <RadioGroup
          label="Plan"
          name="plan"
          onChange={(event) => setPlan(Number(event.target.value))}
          options={[
            { label: "Free", value: 1 },
            { label: "Team", value: 2 },
            { label: "Enterprise", value: 3 },
          ]}
          value={plan}
        />
        <p className="mt-2 text-sm">
          Selected: <code>{plan}</code>
        </p>
      </div>
      <RadioGroup
        defaultValue="email"
        dim="sm"
        error="Pick how we should contact you."
        label="Contact (small, with an error)"
        options={[
          { label: "Email", value: "email" },
          { label: "Phone", value: "phone" },
        ]}
      />
    </div>
  );
}
