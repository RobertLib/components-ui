import { useState } from "react";
import { Input, removeDiacritics, useDebouncedValue } from "components-ui";

const customers = [
  "Anna Dvořáková",
  "Jana Nováková",
  "Jiří Černý",
  "Martin Svoboda",
  "Petra Horáková",
  "Tomáš Procházka",
];

const normalize = (text: string) => removeDiacritics(text).toLowerCase();

export default function DebouncedValue() {
  const [search, setSearch] = useState("");
  // In an app, this is what a request is made for - once, not per keystroke
  const debouncedSearch = useDebouncedValue(search, 400);

  const results = customers.filter((name) =>
    normalize(name).includes(normalize(debouncedSearch)),
  );

  return (
    <div className="max-w-sm space-y-3">
      <Input
        label="Search customers"
        onChange={(event) => setSearch(event.target.value)}
        value={search}
      />
      <p
        className="text-sm text-neutral-500 dark:text-neutral-400"
        role="status"
      >
        {search === debouncedSearch
          ? `${results.length} of ${customers.length} customers`
          : "Waiting for you to stop typing…"}
      </p>
      <ul className="list-inside list-disc text-sm">
        {results.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
