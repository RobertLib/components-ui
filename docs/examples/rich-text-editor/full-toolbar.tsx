import { RichTextEditor, type RichTextToolbarItem } from "components-ui";

// Every tool - outside the component, so it is the same array on every render
const FULL_TOOLBAR: RichTextToolbarItem[] = [
  "undo",
  "redo",
  "|",
  "paragraph",
  "heading2",
  "heading3",
  "|",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "code",
  "|",
  "bulletList",
  "numberedList",
  "outdent",
  "indent",
  "|",
  "blockquote",
  "link",
  "table",
  "horizontalRule",
  "|",
  "clearFormatting",
];

export default function FullToolbar() {
  return (
    <RichTextEditor
      defaultValue={
        "<h2>Incident report</h2>" +
        "<p>The deploy of <code>api@2.4.1</code> failed at <strong>14:05</strong>.</p>" +
        "<blockquote><p>The rollback finished within 6 minutes.</p></blockquote>" +
        "<h3>Next steps</h3>" +
        "<ol><li>Fix the migration<ul><li>Add a test for empty tables</li></ul></li>" +
        "<li>Deploy again on <u>Monday</u></li></ol>"
      }
      label="Report"
      toolbar={FULL_TOOLBAR}
    />
  );
}
