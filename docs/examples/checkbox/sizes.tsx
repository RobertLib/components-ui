import { Checkbox } from "components-ui";

export default function Sizes() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <Checkbox dim="xs" label="Extra small" />
        <Checkbox dim="sm" label="Small" />
        <Checkbox defaultChecked label="Medium (default)" />
        <Checkbox dim="lg" label="Large" />
      </div>
      <div className="space-y-3">
        <Checkbox
          checked
          description="Set by your organization - it cannot be changed here."
          label="Two-factor sign-in"
          name="twoFactor"
          readOnly
        />
        <Checkbox
          label={
            <>
              I agree to the{" "}
              <a
                className="text-primary-700 underline dark:text-primary-300"
                href="#terms"
              >
                terms of service
              </a>
            </>
          }
          name="terms"
        />
      </div>
    </div>
  );
}
