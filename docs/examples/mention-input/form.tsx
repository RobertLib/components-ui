import { useState } from "react";
import { Button, MentionInput, mentionsToText } from "components-ui";
import { colleagues } from "./colleagues";

const suggestions = colleagues.map((person) => ({
  id: person.id,
  label: person.name,
}));

// In a form: the hidden input submits the value with the tokens, the
// textarea is validated (`required`, `maxLength` - "@Jana Nováková" counts
// as 14 characters), and a reset brings back the default value
export default function Form() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get("note"));
        setSubmitted(value);
      }}
    >
      <MentionInput
        defaultValue="@[Martin Procházka](user:3) approve, please."
        label="Approval request"
        maxLength={280}
        name="note"
        required
        showCount
        suggestions={suggestions}
      />
      <div className="flex gap-2">
        <Button type="submit">Send</Button>
        <Button type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {submitted !== null && (
        <dl className="space-y-1 text-sm">
          <dt className="font-medium">Submitted</dt>
          <dd>
            <code className="break-all">{submitted}</code>
          </dd>
          <dt className="font-medium">As plain text (for the e-mail)</dt>
          <dd>{mentionsToText(submitted)}</dd>
        </dl>
      )}
    </form>
  );
}
