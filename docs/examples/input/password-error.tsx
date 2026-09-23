import { Input } from "components-ui";

export default function PasswordAndError() {
  return (
    <div className="grid max-w-md gap-4">
      <Input
        autoComplete="new-password"
        label="Password"
        name="password"
        type="password"
      />
      <Input
        defaultValue="not-an-email"
        error="Enter a valid email address."
        label="Email"
        name="email"
      />
      <Input defaultValue="Read only" disabled label="Disabled" />
    </div>
  );
}
