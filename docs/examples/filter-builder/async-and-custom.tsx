import { useMemo, useState } from "react";
import {
  FilterBuilder,
  matchesFilter,
  Rating,
  type AutocompleteValue,
  type FilterField,
  type FilterGroup,
  type LoadOptionsParams,
} from "components-ui";
import { people, type Person } from "../../mocks/data";

interface Supplier {
  id: number;
  managerId: number;
  name: string;
  rating: number;
}

const suppliers: Supplier[] = [
  { id: 1, managerId: 3, name: "Stavby Novák s.r.o.", rating: 4 },
  { id: 2, managerId: 7, name: "Elektro Dvořák a.s.", rating: 5 },
  { id: 3, managerId: 12, name: "Pekárna U Mlýna s.r.o.", rating: 3 },
  { id: 4, managerId: 3, name: "Autodoprava Horák", rating: 2 },
  { id: 5, managerId: 7, name: "Tiskárna Svoboda s.r.o.", rating: 4 },
  { id: 6, managerId: 15, name: "Kovo Procházka s.r.o.", rating: 5 },
  { id: 7, managerId: 12, name: "IT Servis Král", rating: 1 },
  { id: 8, managerId: 15, name: "Zahradnictví Zelený", rating: 3 },
];

// GET /api/people?q=…&offset=…&limit=… -> { items, total }
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
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as { items: Person[]; total: number };
}

// The names of the ids of `defaultValue`
async function loadSelectedPeople(
  ids: AutocompleteValue[],
  { signal }: { signal: AbortSignal },
) {
  const response = await fetch(`/api/people?ids=${ids.join(",")}`, { signal });
  const { items } = (await response.json()) as { items: Person[] };
  return items;
}

const fields: FilterField<Supplier>[] = [
  { key: "name", label: "Supplier", type: "text" },
  {
    key: "managerId",
    label: "Account manager",
    loadOptions: loadPeople,
    loadSelectedOptions: loadSelectedPeople,
    placeholder: "Type a name…",
    type: "select",
  },
  {
    key: "rating",
    label: "Rating",
    // A field of the app - and how it matches
    match: (value, condition) => {
      const rating = Number(value);
      const wanted = Number(condition.value);
      if (condition.operator === "greaterThanOrEqual") return rating >= wanted;
      if (condition.operator === "lessThanOrEqual") return rating <= wanted;
      return rating === wanted;
    },
    operators: ["greaterThanOrEqual", "lessThanOrEqual", "equals"],
    render: ({ "aria-label": label, dim, disabled, onChange, value }) => (
      <Rating
        aria-label={label}
        className="py-1.5"
        dim={dim}
        disabled={disabled}
        onChange={(rating) => onChange(rating || undefined)}
        value={typeof value === "number" ? value : 0}
      />
    ),
    type: "custom",
  },
];

const initialFilter: FilterGroup = {
  combinator: "and",
  conditions: [
    { field: "managerId", operator: "in", value: [3, 7] },
    { field: "rating", operator: "greaterThanOrEqual", value: 4 },
  ],
};

export default function AsyncAndCustom() {
  const [filter, setFilter] = useState(initialFilter);
  const found = useMemo(
    () =>
      suppliers.filter((supplier) => matchesFilter(supplier, filter, fields)),
    [filter],
  );

  return (
    <div className="space-y-4">
      <FilterBuilder
        fields={fields}
        label="Suppliers where"
        onChange={setFilter}
        value={filter}
      />
      <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
        {found.map((supplier) => (
          <li
            className="flex justify-between gap-4 px-3 py-2"
            key={supplier.id}
          >
            <span>
              {supplier.name}
              <span className="block text-neutral-500 dark:text-neutral-400">
                {
                  people.find((person) => person.id === supplier.managerId)
                    ?.name
                }
              </span>
            </span>
            <span className="text-warning-500">
              <span aria-hidden="true">{"★".repeat(supplier.rating)}</span>
              <span className="sr-only">{supplier.rating} of 5</span>
            </span>
          </li>
        ))}
        {found.length === 0 && (
          <li className="px-3 py-2 text-neutral-500 dark:text-neutral-400">
            No supplier matches.
          </li>
        )}
      </ul>
    </div>
  );
}
