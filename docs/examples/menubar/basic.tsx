import { Menubar } from "components-ui";
import { useState } from "react";
export default function Basic() {
  const [status, setStatus] = useState("Ready");
  const [checked, setChecked] = useState(true);
  return (
    <div className="space-y-4">
      <Menubar
        aria-label="Document commands"
        menus={[
          {
            id: "file",
            label: "File",
            items: [
              {
                label: "New document",
                shortcut: "Ctrl+N",
                onClick: () => setStatus("New document"),
              },
              {
                label: "Export",
                items: [
                  { label: "PDF", onClick: () => setStatus("Export PDF") },
                  { label: "Text", onClick: () => setStatus("Export text") },
                ],
              },
            ],
          },
          {
            id: "edit",
            label: "Edit",
            items: [
              { label: "Undo", onClick: () => setStatus("Undo") },
              { label: "Copy", onClick: () => setStatus("Copy") },
            ],
          },
          {
            id: "view",
            label: "View",
            items: [
              {
                type: "checkbox",
                label: "Show sidebar",
                checked,
                onCheckedChange: setChecked,
              },
            ],
          },
        ]}
      />
      <output>
        {status}
        {checked ? " · Sidebar visible" : ""}
      </output>
    </div>
  );
}
