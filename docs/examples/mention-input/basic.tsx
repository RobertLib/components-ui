import { useState } from "react";
import {
  Avatar,
  MentionInput,
  parseMentions,
  type MentionSuggestion,
} from "components-ui";
import { colleagues } from "./colleagues";

const suggestions: MentionSuggestion[] = colleagues.map((person) => ({
  description: person.role,
  icon: <Avatar alt="" color="auto" name={person.name} size="sm" />,
  id: person.id,
  // Found by the e-mail too
  keywords: [person.email],
  label: person.name,
}));

// Type @ and a name - "nova" finds "Nováková". The value keeps each
// mention as a token; parseMentions reads them, e.g. to notify the people.
export default function Basic() {
  const [value, setValue] = useState(
    "@[Jana Nováková](user:12) please check the credit note before Friday.",
  );
  const mentioned = parseMentions(value);

  return (
    <div className="max-w-xl space-y-4">
      <MentionInput
        autosize
        description="Type @ to mention a colleague - they get a notification."
        label="Note to the order"
        maxRows={8}
        onChange={setValue}
        suggestions={suggestions}
        value={value}
      />
      <dl className="space-y-1 text-sm">
        <dt className="font-medium">Stored value</dt>
        <dd>
          <code className="break-all">{value}</code>
        </dd>
        <dt className="font-medium">Notified</dt>
        <dd>
          {mentioned.length
            ? mentioned.map((mention) => mention.id).join(", ")
            : "nobody"}
        </dd>
      </dl>
    </div>
  );
}
