import { useState } from "react";
import { Button, ColorInput } from "components-ui";

export default function States() {
  const [submitted, setSubmitted] = useState<string>();

  return (
    <form
      className="grid gap-6 sm:grid-cols-2"
      onReset={() => setSubmitted(undefined)}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitted(JSON.stringify(Object.fromEntries(data)));
      }}
    >
      <ColorInput dim="sm" label="Small" name="small" placeholder="#000000" />
      <ColorInput defaultValue="#ea580c" dim="lg" label="Large" name="large" />
      <ColorInput
        defaultValue="#6b7280"
        label="Read-only"
        name="readOnly"
        readOnly
      />
      <ColorInput defaultValue="#6b7280" disabled label="Disabled" />
      <ColorInput
        error="Pick a darker color - the text on it would not be readable."
        label="Required, with an error"
        name="required"
        required
      />
      <div className="flex items-end gap-2 sm:col-span-2">
        <Button size="sm" type="submit">
          Submit
        </Button>
        <Button color="default" size="sm" type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {submitted && (
        <p className="text-sm sm:col-span-2">
          Submitted: <code>{submitted}</code>
        </p>
      )}
    </form>
  );
}
