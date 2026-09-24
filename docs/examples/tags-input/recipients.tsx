import { useState } from "react";
import { Button, TagsInput } from "components-ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Paste a list of addresses - separated by commas, semicolons, spaces or
// lines - and see what the form submits
export default function Recipients() {
  const [submitted, setSubmitted] = useState<FormDataEntryValue[]>();

  return (
    <form
      className="max-w-lg space-y-4"
      onReset={() => setSubmitted(undefined)}
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(new FormData(event.currentTarget).getAll("to"));
      }}
    >
      <TagsInput
        addOnBlur
        defaultValue={["anna.novakova@example.com"]}
        inputMode="email"
        label="To"
        maxTags={5}
        name="to"
        placeholder="Add recipients…"
        required
        separators={[",", ";", " "]}
        validate={(tag) =>
          EMAIL.test(tag) ? undefined : `${tag} is not an e-mail address.`
        }
      />
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          Send
        </Button>
        <Button color="default" size="sm" type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {submitted && (
        <p className="text-sm break-all">
          <code>getAll("to")</code>: <code>{JSON.stringify(submitted)}</code>
        </p>
      )}
    </form>
  );
}
