import { useState } from "react";
import { SearchX } from "lucide-react";
import { Button, EmptyState, Input } from "components-ui";

const customers = ["Acme s.r.o.", "Globex a.s.", "Initech"];

export default function Search() {
  const [search, setSearch] = useState("Umbrella");
  const found = customers.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-md">
      <Input
        label="Search customers"
        onChange={(event) => setSearch(event.target.value)}
        value={search}
      />
      {found.length > 0 ? (
        <ul className="mt-3 divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          {found.map((name) => (
            <li className="py-2" key={name}>
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          action={
            <Button onClick={() => setSearch("")} size="sm" variant="outline">
              Clear search
            </Button>
          }
          description={`No customer matches “${search}”.`}
          icon={<SearchX />}
          size="sm"
          title="No results"
        />
      )}
    </div>
  );
}
