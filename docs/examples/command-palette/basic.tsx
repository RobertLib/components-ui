import {
  CalendarPlus,
  FilePlus,
  Keyboard,
  LogOut,
  Palette,
  Search,
  Table,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import {
  Button,
  CommandPalette,
  Kbd,
  useHotkeys,
  useSnackbar,
  type CommandPaletteItem,
} from "components-ui";

export default function Basic() {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const newInvoice = () => enqueueSnackbar("New invoice…");
  const newCustomer = () => enqueueSnackbar("New customer…");

  const commands: CommandPaletteItem[] = [
    {
      group: "Create",
      icon: <FilePlus size={16} />,
      id: "invoice",
      keywords: ["bill"],
      label: "New invoice",
      onSelect: newInvoice,
      shortcut: "n",
    },
    {
      group: "Create",
      icon: <UserPlus size={16} />,
      id: "customer",
      keywords: ["client", "contact"],
      label: "New customer",
      onSelect: newCustomer,
      shortcut: "c",
    },
    {
      disabled: true,
      group: "Create",
      icon: <CalendarPlus size={16} />,
      id: "meeting",
      label: "Schedule a meeting",
    },
    // Pages of these docs - they open through the router
    {
      group: "Go to",
      href: "/components/data-table",
      icon: <Table size={16} />,
      id: "data-table",
      keywords: ["grid", "list"],
      label: "DataTable",
    },
    {
      group: "Go to",
      href: "/theming",
      icon: <Palette size={16} />,
      id: "theming",
      keywords: ["dark mode", "colors"],
      label: "Theming",
    },
    {
      group: "Go to",
      href: "/components/kbd",
      icon: <Keyboard size={16} />,
      id: "kbd",
      keywords: ["hotkeys"],
      label: "Keyboard shortcuts",
    },
    {
      group: "Account",
      icon: <LogOut size={16} />,
      id: "log-out",
      label: "Log out",
      onSelect: () => enqueueSnackbar("Logged out - not really"),
    },
  ];

  // The shortcuts the palette shows work outside of it too
  useHotkeys([
    ["n", newInvoice],
    ["c", newCustomer],
  ]);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        <Search className="mr-2" size={16} />
        Search…
        <Kbd className="ml-3" shortcut="mod+k" size="sm" />
      </Button>
      {/* ⌘K / Ctrl+K opens it from anywhere on this page */}
      <CommandPalette items={commands} onOpenChange={setOpen} open={open} />
    </>
  );
}
