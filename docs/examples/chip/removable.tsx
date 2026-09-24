import { useState } from "react";
import { Button, Chip } from "components-ui";

const initialFilters = [
  { id: "status", label: "Status: Unpaid" },
  { id: "customer", label: "Customer: Acme s.r.o." },
  { id: "due", label: "Due: this month" },
];

export default function Removable() {
  const [filters, setFilters] = useState(initialFilters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Chip
          color="primary"
          key={filter.id}
          onRemove={() =>
            setFilters((current) =>
              current.filter(({ id }) => id !== filter.id),
            )
          }
          variant="outline"
        >
          {filter.label}
        </Chip>
      ))}
      {filters.length === 0 && (
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          No filters
        </span>
      )}
      <Button
        onClick={() => setFilters(initialFilters)}
        size="sm"
        variant="ghost"
      >
        Reset
      </Button>
    </div>
  );
}
