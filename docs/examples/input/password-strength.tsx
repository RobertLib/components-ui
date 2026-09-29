import { getPasswordStrength, Input } from "components-ui";

// A policy of the app on top of the default score: shorter than 12
// characters is weak at best
const scoreWithPolicy = (password: string) =>
  password.length < 12
    ? Math.min(1, getPasswordStrength(password))
    : getPasswordStrength(password);

export default function PasswordStrength() {
  return (
    <div className="grid max-w-md gap-4">
      <Input
        autoComplete="new-password"
        label="New password"
        passwordStrength
        type="password"
      />
      <Input
        autoComplete="new-password"
        description="At least 12 characters."
        label="With a scorer of your own"
        passwordStrength={scoreWithPolicy}
        type="password"
      />
    </div>
  );
}
