import { useState } from "react";
import { CheckboxGroup } from "components-ui";

const channels = [
  { description: "A summary every morning", label: "Email", value: "email" },
  { description: "Only for urgent alerts", label: "SMS", value: "sms" },
  { label: "Push notification", value: "push" },
  {
    description: "Connect Slack in the integrations first",
    disabled: true,
    label: "Slack",
    value: "slack",
  },
];

const days = [
  { label: "Mon", value: "mon" },
  { label: "Tue", value: "tue" },
  { label: "Wed", value: "wed" },
  { label: "Thu", value: "thu" },
  { label: "Fri", value: "fri" },
];

export default function Basic() {
  const [picked, setPicked] = useState(["email"]);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <CheckboxGroup
          description="We never send more than one message a day."
          label="Notify me by"
          name="channels"
          onChange={setPicked}
          options={channels}
          value={picked}
        />
        <p className="mt-2 text-sm">
          Picked: <code>{JSON.stringify(picked)}</code>
        </p>
      </div>
      <CheckboxGroup
        dim="sm"
        error="Pick at least one working day."
        label="Working days (horizontal, small)"
        name="days"
        options={days}
        orientation="horizontal"
      />
    </div>
  );
}
