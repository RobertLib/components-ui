import { useState } from "react";
import { Checkbox } from "components-ui";

export default function Basic() {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="space-y-4">
      <Checkbox
        defaultChecked
        label="Send me a weekly summary"
        name="summary"
      />
      <Checkbox
        description="We only use it to answer your questions."
        label="Allow contacting me by email"
        name="contact"
      />
      <Checkbox
        checked={accepted}
        error={accepted ? undefined : "You have to accept the terms."}
        label="I accept the terms"
        onChange={(event) => setAccepted(event.target.checked)}
        required
      />
      <Checkbox disabled label="Disabled" />
    </div>
  );
}
