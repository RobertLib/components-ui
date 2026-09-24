import { User, Users } from "lucide-react";
import { useState } from "react";
import {
  Button,
  CommandPalette,
  useSnackbar,
  type CommandPaletteItem,
  type CommandPaletteLoadParams,
} from "components-ui";

interface Person {
  email: string;
  id: number;
  name: string;
}

// GET /api/people?q=…&limit=5 -> { items, total }
async function searchPeople(query: string, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query, limit: "5" });
  const response = await fetch(`/api/people?${params}`, { signal });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const { items } = (await response.json()) as { items: Person[] };
  return items;
}

export default function Async() {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // Called with the search once typing pauses - an older request is aborted
  const loadPeople = async (
    query: string,
    { signal }: CommandPaletteLoadParams,
  ): Promise<CommandPaletteItem[]> => {
    if (!query) return [];

    const people = await searchPeople(query, signal);
    return people.map((person) => ({
      description: person.email,
      group: "People",
      icon: <User size={16} />,
      id: person.id,
      label: person.name,
      onSelect: () => enqueueSnackbar(`Opening ${person.name}…`),
    }));
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Find a person
      </Button>
      <CommandPalette
        items={[
          {
            group: "People",
            href: "/components/data-table",
            icon: <Users size={16} />,
            id: "all",
            keywords: ["everyone", "list"],
            label: "All people",
          },
        ]}
        loadItems={loadPeople}
        onOpenChange={setOpen}
        open={open}
        placeholder="Name, e-mail or city…"
        shortcut={null}
        title="Find a person"
      />
    </>
  );
}
