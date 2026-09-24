import { useState } from "react";
import { Autocomplete, type LoadOptionsParams } from "components-ui";

interface Person {
  email: string;
  id: number;
  name: string;
}

// GET /api/people?q=…&offset=…&limit=… -> { items, total }
async function loadPeople({
  offset,
  pageSize,
  search,
  signal,
}: LoadOptionsParams) {
  const params = new URLSearchParams({
    q: search,
    offset: String(offset),
    limit: String(pageSize),
  });
  const response = await fetch(`/api/people?${params}`, { signal });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const { items, total } = (await response.json()) as {
    items: Person[];
    total: number;
  };

  // `total` tells the list whether to load another page on scroll
  return { items, total };
}

export default function Rest() {
  const [person, setPerson] = useState<Person | null>(null);

  return (
    <div className="max-w-sm space-y-2">
      <Autocomplete
        label="Person (REST)"
        loadOptions={loadPeople}
        onChange={(_, item) => setPerson(item)}
        pageSize={20}
        placeholder="Type a name…"
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Selected: {person ? `${person.name} <${person.email}>` : "nobody"}
      </p>
    </div>
  );
}
