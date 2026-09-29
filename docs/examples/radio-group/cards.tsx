import { Building, Rocket, User } from "lucide-react";
import { useState } from "react";
import { RadioGroup } from "components-ui";

const plans = [
  {
    description: "One user, 5 projects",
    icon: <User size={20} />,
    label: "Personal",
    value: "personal",
  },
  {
    description: "Up to 20 users, unlimited projects",
    icon: <Rocket size={20} />,
    label: "Team",
    value: "team",
  },
  {
    description: "Talk to sales first",
    disabled: true,
    icon: <Building size={20} />,
    label: "Enterprise",
    value: "enterprise",
  },
];

export default function Cards() {
  const [plan, setPlan] = useState("team");

  return (
    <div className="space-y-6">
      <RadioGroup
        columns={3}
        label="Plan"
        name="plan"
        onChange={(event) => setPlan(event.target.value)}
        options={plans}
        value={plan}
        variant="card"
      />
      <div className="max-w-sm">
        <RadioGroup
          defaultValue="standard"
          dim="sm"
          label="Shipping (small, vertical)"
          name="shipping"
          options={[
            {
              description: "2 - 3 business days, free",
              label: "Standard",
              value: "standard",
            },
            {
              description: "Next business day, 149 Kč",
              label: "Express",
              value: "express",
            },
          ]}
          variant="card"
        />
      </div>
    </div>
  );
}
