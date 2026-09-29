import { PinInput } from "components-ui";

export default function Groups() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <PinInput
        description="The 6 digits from the text message."
        groups={[3, 3]}
        label="Verification code"
        name="code"
      />
      <PinInput
        groups={[4, 4]}
        label="License key"
        separator="/"
        type="alphanumeric"
      />
      <PinInput
        defaultValue="482913"
        groups={[3, 3]}
        label="Your code (read-only)"
        name="shown"
        readOnly
      />
    </div>
  );
}
