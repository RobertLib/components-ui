import { useState } from "react";
import { Switch } from "components-ui";

export default function Basic() {
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="space-y-4">
      <Switch
        checked={notifications}
        label={`Notifications are ${notifications ? "on" : "off"}`}
        onChange={(event) => setNotifications(event.target.checked)}
      />
      <Switch defaultChecked label="Uncontrolled, on by default" name="beta" />
      <Switch disabled label="Disabled" />
      <Switch error="This setting is required." label="With an error" />
    </div>
  );
}
