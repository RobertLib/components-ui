import { RichTextEditor } from "components-ui";

export default function Size() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RichTextEditor
        description="Grows up to 10 lines, then scrolls - drag its corner to resize it."
        label="Summary"
        maxRows={10}
        minRows={3}
        placeholder="A few sentences…"
        resize
        toolbar={["bold", "italic", "link"]}
      />
      <RichTextEditor
        defaultValue="<p>Typing, pasting and dropping stop at the limit.</p>"
        label="Short bio"
        maxLength={80}
        minRows={3}
        showCount
        toolbar={["bold", "italic", "link"]}
      />
    </div>
  );
}
