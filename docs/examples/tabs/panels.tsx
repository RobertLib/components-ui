import { useState } from "react";
import { Input, Switch, Tabs } from "components-ui";

export default function Panels() {
  const [keepMounted, setKeepMounted] = useState(true);

  return (
    <div className="space-y-4">
      <Switch
        checked={keepMounted}
        description="Type a name, switch the tab and come back"
        label="Keep the panels mounted"
        onChange={(event) => setKeepMounted(event.target.checked)}
      />
      {/* Uncontrolled - it selects the tabs itself, starting at defaultValue */}
      <Tabs
        aria-label="Account"
        defaultValue="profile"
        items={[
          {
            content: (
              <Input className="max-w-sm" label="Display name" name="name" />
            ),
            label: "Profile",
            value: "profile",
          },
          {
            content: (
              <p className="text-sm">Two-factor authentication is on.</p>
            ),
            label: "Security",
            value: "security",
          },
          {
            content: <p className="text-sm">No invoices yet.</p>,
            label: "Billing",
            value: "billing",
          },
        ]}
        keepMounted={keepMounted}
      />
    </div>
  );
}
