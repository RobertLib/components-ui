import { Autocomplete, type LoadOptionsParams } from "components-ui";

// Static options with a `group` - listed under its heading
const airports = [
  { group: "Czechia", label: "Praha (PRG)", value: "PRG" },
  { group: "Czechia", label: "Brno (BRQ)", value: "BRQ" },
  { group: "Austria", label: "Wien (VIE)", value: "VIE" },
  { group: "Austria", label: "Salzburg (SZG)", value: "SZG" },
  { group: "Germany", label: "München (MUC)", value: "MUC" },
  { group: "Germany", label: "Berlin (BER)", value: "BER" },
  { group: "Czechia", label: "Ostrava (OSR)", value: "OSR" },
];

interface Person {
  department: string;
  id: number;
  name: string;
}

// The people of the mock API, a page at a time - each under its department
async function loadPeople({
  offset,
  pageSize,
  search,
  signal,
}: LoadOptionsParams) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(offset),
    order: "asc",
    q: search,
    sortBy: "department",
  });
  const response = await fetch(`/api/people?${params}`, { signal });
  return (await response.json()) as { items: Person[]; total: number };
}

export default function Groups() {
  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <Autocomplete
        label="Airport"
        name="airport"
        options={airports}
        placeholder="Type a city…"
      />
      <Autocomplete
        getOptionGroup={(person: Person) => person.department}
        label="Reviewers"
        loadOptions={loadPeople}
        multiple
        name="reviewers"
        pageSize={20}
        placeholder="Search people…"
      />
    </div>
  );
}
