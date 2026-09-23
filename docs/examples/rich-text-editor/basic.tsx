import { useState } from "react";
import { RichTextEditor } from "components-ui";

export default function Basic() {
  const [html, setHtml] = useState(
    "<p>Hello <strong>world</strong>! Select text and use the toolbar.</p>",
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RichTextEditor
        label="Message"
        onChange={setHtml}
        placeholder="Write something…"
        value={html}
      />
      <div>
        <div className="mb-1.5 text-sm font-medium">
          Rendered with .rich-text
        </div>
        {/* The HTML is user input - sanitize it (e.g. with DOMPurify) before
            rendering it anywhere else */}
        <div
          className="rich-text rounded-md border border-dashed border-neutral-300 p-3 text-sm dark:border-neutral-700"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="mt-3 mb-1.5 text-sm font-medium">HTML</div>
        <code className="block text-xs break-all text-neutral-500">{html}</code>
      </div>
    </div>
  );
}
