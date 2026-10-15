import { ChangeHistory, type ChangeHistoryEntry } from "components-ui";

const before =
  "The contractor delivers and installs 24 office chairs and 12 desks at the client's premises in Brno within 30 days of signing. " +
  "The price includes transport, assembly and the removal of the packaging. " +
  "Defects reported within 24 months are fixed free of charge within 10 working days.";

const after =
  "The contractor delivers and installs 24 office chairs and 16 height-adjustable desks at the client's premises in Brno within 45 days of signing. " +
  "The price includes transport, assembly and the removal of the packaging. " +
  "Defects reported within 36 months are fixed free of charge within 5 working days.";

const entries: ChangeHistoryEntry[] = [
  {
    action: "updated",
    author: { name: "Lucie Králová" },
    changes: [
      // Longer than `longTextLength` (120) - compared word by word
      { field: "scope", from: before, to: after },
      // `diff: true` in `fields` - a short text compared word by word too
      {
        field: "title",
        from: "Office furniture",
        to: "Office furniture - 2nd floor",
      },
    ],
    comment: "The client added the meeting room.",
    id: 2,
    time: new Date(Date.now() - 50 * 60_000),
  },
];

export default function LongText() {
  return (
    <ChangeHistory
      entries={entries}
      fields={{
        scope: { label: "Scope of work" },
        title: { diff: true, label: "Title" },
      }}
    />
  );
}
