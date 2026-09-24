import { useState } from "react";
import { Button, PinInput } from "components-ui";

// The code is submitted as one value - `required` wants every cell filled
export default function Form() {
  const [submitted, setSubmitted] = useState<FormDataEntryValue | null>();

  return (
    <form
      className="space-y-4"
      onReset={() => setSubmitted(undefined)}
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(new FormData(event.currentTarget).get("pin"));
      }}
    >
      <PinInput
        label="Confirm the payment with your PIN"
        length={4}
        mask
        name="pin"
        required
      />
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          Pay
        </Button>
        <Button color="default" size="sm" type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {submitted !== undefined && (
        <p className="text-sm">
          <code>get("pin")</code>: <code>{JSON.stringify(submitted)}</code>
        </p>
      )}
    </form>
  );
}
