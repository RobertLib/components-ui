import {
  Autocomplete,
  type AutocompleteValue,
  type LoadOptionsParams,
} from "components-ui";

interface Person {
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

// The labels of the saved ids, before the list has ever been opened
async function loadSelectedPeople(
  ids: AutocompleteValue[],
  { signal }: { signal: AbortSignal },
) {
  const response = await fetch(`/api/people?ids=${ids.join(",")}`, { signal });
  const { items } = (await response.json()) as { items: Person[] };
  return items;
}

export default function EditForm() {
  // e.g. the record being edited: { teamMemberIds: [3, 7, 12] }
  const savedIds = [3, 7, 12];

  return (
    <div className="max-w-md">
      <Autocomplete
        defaultValue={savedIds}
        label="Team members"
        loadOptions={loadPeople}
        loadSelectedOptions={loadSelectedPeople}
        multiple
        name="teamMemberIds"
        placeholder="Add a person…"
      />
    </div>
  );
}
