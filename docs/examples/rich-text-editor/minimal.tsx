import { RichTextEditor } from "components-ui";

export default function Minimal() {
  return (
    <RichTextEditor
      label="Comment"
      placeholder="Add a comment…"
      toolbar={["bold", "italic", "link"]}
    />
  );
}
