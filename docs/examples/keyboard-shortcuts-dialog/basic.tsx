import { Keyboard } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Kbd,
  KeyboardShortcutsDialog,
  Switch,
  useHotkeys,
  useSnackbar,
} from "components-ui";

/** The invoice editor - its shortcuts are listed while it is shown. */
function InvoiceEditor() {
  const { enqueueSnackbar } = useSnackbar();

  useHotkeys([
    [
      "mod+s",
      () => enqueueSnackbar("Invoice FV-2026-0418 saved", "success"),
      {
        allowInFields: true,
        description: "Save the invoice",
        group: "Invoice",
      },
    ],
    [
      "alt+n",
      () => enqueueSnackbar("A new line was added"),
      { description: "Add a line", group: "Invoice" },
    ],
    [
      "mod+p",
      () => enqueueSnackbar("Printing the invoice…"),
      { description: "Print", group: "Invoice" },
    ],
  ]);

  return (
    <div className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      Invoice FV-2026-0418 · Stavebniny Novák s.r.o. · 48 620 Kč
    </div>
  );
}

export default function Basic() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [editing, setEditing] = useState(true);
  const { enqueueSnackbar } = useSnackbar();

  // Shortcuts of the whole app - two keys for one action share a line
  useHotkeys([
    [
      "mod+k",
      () => enqueueSnackbar("Search opened"),
      { allowInFields: true, description: "Search" },
    ],
    ["/", () => enqueueSnackbar("Search opened"), { description: "Search" }],
    // Not described - not listed
    ["mod+shift+d", () => enqueueSnackbar("Diagnostics copied")],
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          onClick={() => setHelpOpen(true)}
          startIcon={<Keyboard size={16} />}
          variant="outline"
        >
          Keyboard shortcuts
        </Button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          or press <Kbd>?</Kbd>
        </span>
        <Switch
          checked={editing}
          label="Editing an invoice"
          onChange={(event) => setEditing(event.target.checked)}
        />
      </div>
      {editing && <InvoiceEditor />}

      <KeyboardShortcutsDialog
        onOpenChange={setHelpOpen}
        open={helpOpen}
        // Keys a component handles itself - listed by the app
        shortcuts={[
          {
            description: "Move between the rows",
            group: "Lists",
            shortcut: ["arrowup", "arrowdown"],
          },
          { description: "Open the row", group: "Lists", shortcut: "enter" },
        ]}
      />
    </div>
  );
}
