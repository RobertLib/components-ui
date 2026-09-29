import { useState } from "react";
import { Button, Rating, Textarea } from "components-ui";

export default function Form() {
  const [submitted, setSubmitted] = useState<string>();

  return (
    <form
      className="max-w-md space-y-4"
      onReset={() => setSubmitted(undefined)}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitted(JSON.stringify(Object.fromEntries(data)));
      }}
    >
      <Rating label="Your rating" name="rating" required />
      <Textarea label="Review" name="review" />
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          Send
        </Button>
        <Button color="default" size="sm" type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {submitted && (
        <p className="text-sm">
          Submitted: <code>{submitted}</code>
        </p>
      )}
    </form>
  );
}
