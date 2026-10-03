import { RichTextEditor } from "components-ui";
import { Stamp } from "lucide-react";
export default function CustomTools() {
  return (
    <RichTextEditor
      label="Message"
      toolbar={["bold", "italic", "link", "|", "undo", "redo"]}
      additionalFormats={["blockquote"]}
      defaultValue="<p>Hello,</p>"
      customTools={[
        {
          id: "signature",
          label: "Insert signature",
          icon: <Stamp size={16} />,
          shortcut: "Ctrl+Shift+S",
          onClick: (context) =>
            context.insertHtml(
              "<p><strong>Customer support</strong><br>Example company</p>",
            ),
        },
        {
          id: "quote",
          label: "Quote selection",
          onClick: (context) =>
            context.insertHtml(
              `<blockquote>${context.selectedText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</blockquote>`,
            ),
        },
      ]}
      maxLength={500}
      showCount
    />
  );
}
