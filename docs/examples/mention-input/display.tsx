import {
  MentionText,
  renderMentions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components-ui";

const triggers = ["@", "#"];

const notes = [
  {
    id: 1,
    text: "Credit note sent, @[Jana Nováková](user:12) will book it.\nSee #[1043 Wrong VAT on credit note](ticket:1043).",
  },
  { id: 2, text: "Waiting for @[Martin Procházka](user:3)." },
];

// A stored value shown with its mentions - as links to the person or the
// ticket, through the router. Text is never read as HTML.
export default function Display() {
  return (
    <div className="max-w-xl space-y-6">
      <p className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-700">
        <MentionText
          getMentionHref={(mention) =>
            mention.trigger === "@"
              ? `/people/${mention.id.replace("user:", "")}`
              : `/tickets/${mention.id.replace("ticket:", "")}`
          }
          triggers={triggers}
          value={notes[0].text}
        />
      </p>

      {/* renderMentions puts them into any element - chips here */}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Note</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {notes.map((note) => (
            <TableRow key={note.id}>
              <TableCell>{note.id}</TableCell>
              <TableCell className="whitespace-pre-line">
                {renderMentions(note.text, { triggers })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
