import { Bell, ChartColumn, CloudUpload, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { CheckboxGroup } from "components-ui";

const addOns = [
  {
    description: "Nightly backups, kept for 30 days",
    icon: <CloudUpload size={20} />,
    label: "Backups",
    value: "backups",
  },
  {
    description: "Reports of every team, weekly",
    icon: <ChartColumn size={20} />,
    label: "Analytics",
    value: "analytics",
  },
  {
    description: "Alerts by email and SMS",
    icon: <Bell size={20} />,
    label: "Monitoring",
    value: "monitoring",
  },
  {
    description: "Part of every plan",
    icon: <ShieldCheck size={20} />,
    label: "Security updates",
    value: "security",
  },
];

export default function Cards() {
  const [picked, setPicked] = useState(["backups"]);

  return (
    <div className="space-y-6">
      <div>
        <CheckboxGroup
          columns={2}
          label="Add-ons"
          name="addOns"
          onChange={setPicked}
          options={addOns.slice(0, 3)}
          value={picked}
          variant="card"
        />
        <p className="mt-2 text-sm">
          Picked: <code>{JSON.stringify(picked)}</code>
        </p>
      </div>
      <CheckboxGroup
        defaultValue={["security"]}
        description="Included in your plan - they cannot be turned off."
        label="Included (read-only)"
        name="included"
        options={addOns.slice(3)}
        readOnly
        variant="card"
      />
    </div>
  );
}
