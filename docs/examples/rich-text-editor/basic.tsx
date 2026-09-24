import { useState } from "react";
import { RichTextEditor, sanitizeRichText } from "components-ui";

export default function Basic() {
  const [html, setHtml] = useState(
    "<h2>Weekly update</h2><p>Hello <strong>team</strong>! Select text and use the toolbar.</p>" +
      "<ul><li>Release 2.4 is out</li><li>Next up: the <em>customer portal</em></li></ul>",
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RichTextEditor
        description="Shown to the whole team on the dashboard."
        label="Message"
        onChange={setHtml}
        placeholder="Write something…"
        value={html}
      />
      <div className="min-w-0">
        <div className="mb-1.5 text-sm font-medium">
          Rendered with .rich-text
        </div>
        {/* The HTML is user input - stored HTML is rendered sanitized */}
        <div
          className="rich-text rounded-md border border-dashed border-neutral-300 p-3 text-sm dark:border-neutral-700"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
        />
        <div className="mt-3 mb-1.5 text-sm font-medium">HTML</div>
        <code className="block text-xs break-all text-neutral-500 dark:text-neutral-400">
          {html}
        </code>
      </div>
    </div>
  );
}
