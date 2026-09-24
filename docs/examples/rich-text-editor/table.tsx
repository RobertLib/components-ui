import { RichTextEditor, type RichTextToolbarItem } from "components-ui";

const TOOLBAR: RichTextToolbarItem[] = [
  "undo",
  "redo",
  "|",
  "bold",
  "italic",
  "|",
  "bulletList",
  "table",
  "|",
  "clearFormatting",
];

export default function Table() {
  return (
    <RichTextEditor
      defaultValue={
        "<p>Shifts for the week of <strong>October 5</strong>:</p>" +
        "<table><thead><tr><th>Day</th><th>Morning</th><th>Afternoon</th></tr></thead>" +
        "<tbody><tr><td>Monday</td><td>Jana</td><td>Petr</td></tr>" +
        "<tr><td>Tuesday</td><td>Petr</td><td>Eva</td></tr></tbody></table>" +
        "<p>Swap a shift only with the lead's approval.</p>"
      }
      label="Shift plan"
      toolbar={TOOLBAR}
    />
  );
}
