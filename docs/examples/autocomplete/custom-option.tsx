import { Check } from "lucide-react";
import { Autocomplete, Avatar, type LoadOptionsParams } from "components-ui";

interface Person {
  email: string;
  id: number;
  name: string;
}

async function loadPeople({
  offset,
  pageSize,
  search,
  signal,
}: LoadOptionsParams) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(offset),
    q: search,
  });
  const response = await fetch(`/api/people?${params}`, { signal });
  return (await response.json()) as { items: Person[]; total: number };
}

export default function CustomOption() {
  return (
    <div className="max-w-sm">
      <Autocomplete
        label="Assignee"
        loadOptions={loadPeople}
        placeholder="Search people…"
        renderOption={(option, { selected }) => {
          const person = option.data as Person;

          return (
            <div className="flex items-center gap-2 py-0.5">
              <Avatar alt="" name={person.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate">{person.name}</div>
                <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {person.email}
                </div>
              </div>
              {selected && <Check className="text-primary-500" size={16} />}
            </div>
          );
        }}
      />
    </div>
  );
}
