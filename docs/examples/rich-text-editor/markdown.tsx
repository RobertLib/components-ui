import { RichTextEditor, type RichTextToolbarItem } from "components-ui";

const TOOLBAR: RichTextToolbarItem[] = [
  "undo",
  "redo",
  "|",
  "heading2",
  "heading3",
  "|",
  "bold",
  "italic",
  "code",
  "|",
  "bulletList",
  "numberedList",
  "|",
  "blockquote",
  "codeBlock",
  "horizontalRule",
];

export default function Markdown() {
  return (
    <RichTextEditor
      defaultValue={
        "<p>Start a line with <code>## </code>, <code>- </code>, <code>1. </code> or <code>&gt; </code> - " +
        "or type <code>```</code> for a code block:</p>" +
        "<pre><code>npm install components-ui<br>npm run dev</code></pre>"
      }
      description="Ctrl+Z after a shortcut brings back what you typed."
      label="Release notes"
      toolbar={TOOLBAR}
    />
  );
}
