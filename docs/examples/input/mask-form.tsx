import { useState } from "react";
import { Button, Input } from "components-ui";

// Uppercase letters and digits - typed letters are made uppercase
const plateTokens = {
  A: { pattern: /[A-Z0-9]/, transform: (char: string) => char.toUpperCase() },
};

export default function MaskForm() {
  const [submitted, setSubmitted] = useState<Record<string, string>>();

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <form
        className="grid gap-4"
        onReset={() => setSubmitted(undefined)}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(
            Object.fromEntries(new FormData(event.currentTarget)) as Record<
              string,
              string
            >,
          );
        }}
      >
        {/* The country code as a prefix - the value is the number alone */}
        <Input
          autoComplete="tel-national"
          defaultValue="777123456"
          label="Mobile"
          mask="### ### ###"
          name="phone"
          prefix="+420"
          type="tel"
          unmask
        />
        <Input
          description="Incomplete, it cannot be submitted."
          label="Postal code"
          mask="### ##"
          name="zip"
          required
        />
        <Input
          description="E.g. 1AB 2345."
          label="Licence plate"
          mask="#AA ####"
          maskTokens={plateTokens}
          name="plate"
        />
        <div className="flex gap-2">
          <Button type="submit">Submit</Button>
          <Button type="reset" variant="outline">
            Reset
          </Button>
        </div>
      </form>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {submitted
          ? JSON.stringify(submitted, null, 2)
          : "Submit the form to see its FormData"}
      </pre>
    </div>
  );
}
