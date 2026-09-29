import { useState } from "react";
import { Input, TreeView, type TreeItem } from "components-ui";

const FIRST_NAMES = ["Jana", "Petr", "Eva", "Tomáš", "Lucie", "Jan", "Anna"];
const LAST_NAMES = ["Nováková", "Svoboda", "Dvořáková", "Černý", "Procházka"];

// 20 divisions × 10 teams × 49 people - 10 020 items
const divisions: TreeItem<string>[] = Array.from({ length: 20 }, (_, d) => ({
  children: Array.from({ length: 10 }, (_, t) => ({
    children: Array.from({ length: 49 }, (_, p) => {
      const n = d * 490 + t * 49 + p;
      const name = `${FIRST_NAMES[n % FIRST_NAMES.length]} ${LAST_NAMES[n % LAST_NAMES.length]}`;
      return { id: `person-${n}`, label: `${name} #${n + 1}` };
    }),
    id: `team-${d}-${t}`,
    label: `Team ${d + 1}.${t + 1}`,
  })),
  id: `division-${d}`,
  label: `Division ${d + 1}`,
}));

// Everything expanded - all 10 020 rows
const allParents = divisions.flatMap((division) => [
  division.id,
  ...(division.children ?? []).map((team) => team.id),
]);

export default function Virtualized() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-3">
      <div className="max-w-sm">
        <Input
          label="Find a person"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="e.g. novakova #12"
          type="search"
          value={search}
        />
      </div>
      {/* It scrolls itself - it needs a height */}
      <TreeView
        aria-label="People by team"
        className="h-80 rounded-md border border-neutral-200 p-1 dark:border-neutral-800"
        defaultExpanded={allParents}
        filter={search}
        items={divisions}
        selectionMode="multiple"
        virtualized
      />
    </div>
  );
}
