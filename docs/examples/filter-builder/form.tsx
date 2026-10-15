import { useState } from "react";
import {
  Button,
  FilterBuilder,
  type FilterField,
  type FilterGroup,
} from "components-ui";

const fields: FilterField[] = [
  { key: "customer", label: "Customer", type: "text" },
  { key: "total", label: "Total (CZK)", type: "number" },
  { key: "issuedOn", label: "Issued on", type: "date" },
];

const savedFilter: FilterGroup = {
  combinator: "and",
  conditions: [
    {
      field: "issuedOn",
      operator: "between",
      value: { from: "2026-07-01", to: "2026-09-30" },
    },
  ],
};

// `name` submits the filter as JSON - Reset brings back `defaultValue`
export default function Form() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onReset={() => setSubmitted(null)}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitted(String(data.get("filter")));
      }}
    >
      <FilterBuilder
        defaultValue={savedFilter}
        fields={fields}
        label="Export the invoices where"
        name="filter"
      />
      <div className="flex gap-2">
        <Button type="submit">Export</Button>
        <Button color="default" type="reset" variant="outline">
          Reset
        </Button>
      </div>
      {submitted !== null && (
        <pre className="overflow-auto rounded-md bg-neutral-50 p-3 font-mono text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          filter={submitted}
        </pre>
      )}
    </form>
  );
}
