import { PhoneInput } from "components-ui";
import { useState } from "react";
export default function States() {
  const [value, setValue] = useState("+421905123456");
  return (
    <div className="max-w-xl space-y-4">
      <PhoneInput label="Controlled phone" onChange={setValue} value={value} />
      <PhoneInput
        defaultValue="+420777123456"
        label="Read-only phone"
        readOnly
      />
      <PhoneInput disabled label="Disabled phone" />
    </div>
  );
}
