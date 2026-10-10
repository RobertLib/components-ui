import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RichTextEditor, UIProvider, en } from "../../src";
import type { RichTextToolbarItem } from "../../src";
import "./fixture.css";

// The editor's own editing in each browser - what `execCommand` and typing
// leave differs between them (Safari breaks preformatted lines with "\n")
const TOOLS: RichTextToolbarItem[] = [
  "undo",
  "redo",
  "|",
  "paragraph",
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
  "link",
  "table",
];

/** An editor of `?value=` - its value shown as it is reported. */
export function RichTextFixture({ value }: { value: string }) {
  const [html, setHtml] = useState(value);

  return (
    <>
      <RichTextEditor
        defaultValue={value}
        label="Note"
        onChange={setHtml}
        toolbar={TOOLS}
      />
      <output aria-label="Value">{html}</output>
    </>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("The browser fixture root is missing.");

createRoot(container).render(
  <UIProvider locale={en}>
    <main>
      <RichTextFixture
        value={new URLSearchParams(window.location.search).get("value") ?? ""}
      />
    </main>
  </UIProvider>,
);
