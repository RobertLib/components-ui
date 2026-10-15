import { CircleDot } from "lucide-react";
import {
  Avatar,
  MentionInput,
  removeDiacritics,
  type MentionSuggestion,
} from "components-ui";
import { colleagues, delay, tickets } from "./colleagues";

const matches = (text: string, query: string) =>
  removeDiacritics(text)
    .toLowerCase()
    .includes(removeDiacritics(query).toLowerCase());

// The people - from an API that takes a while; the `signal` aborts the
// request of a query typed over
async function loadPeople(
  query: string,
  { signal }: { signal: AbortSignal },
): Promise<MentionSuggestion[]> {
  await delay(400, signal);
  return colleagues
    .filter((person) => matches(person.name, query))
    .map((person) => ({
      description: person.email,
      icon: <Avatar alt="" color="auto" name={person.name} size="sm" />,
      id: person.id,
      label: person.name,
    }));
}

async function loadTickets(
  query: string,
  { signal }: { signal: AbortSignal },
): Promise<MentionSuggestion[]> {
  await delay(300, signal);
  return tickets
    .filter((ticket) => matches(`${ticket.id} ${ticket.title}`, query))
    .map((ticket) => ({
      description: ticket.state,
      disabled: ticket.state === "Resolved",
      icon: <CircleDot className="text-primary-600" size={16} />,
      id: ticket.id,
      // Inserted after the trigger: "#1042 Invoice 2026-0042 not sent"
      label: `${ticket.id.replace("ticket:", "")} ${ticket.title}`,
    }));
}

// @ mentions people, # links a support ticket - each trigger loads its own
// suggestions, and a ticket number is one word
export default function Async() {
  return (
    <div className="max-w-xl">
      <MentionInput
        autosize
        label="Reply to the customer"
        loadSuggestions={loadPeople}
        placeholder="Type @ for a colleague, # for a ticket…"
        triggers={[
          "@",
          {
            allowSpaces: false,
            char: "#",
            label: "Tickets",
            loadSuggestions: loadTickets,
          },
        ]}
      />
    </div>
  );
}
